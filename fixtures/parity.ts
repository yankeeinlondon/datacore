/**
 * Parity check driver: syncs the parity vault into a running Obsidian vault and snapshots how each parity note
 * renders, so the output of two builds (e.g. P1's in-engine views vs. P2's datacore-view-preact) can be compared.
 *
 * Everything goes through `obsidian-cli eval`, and rendering happens off-screen in the `datacore-parity` helper
 * plugin, so the driver never opens a leaf, a modal, or the settings, and never takes focus.
 *
 * Usage (from `fixtures/`, with Obsidian running and the target vault open):
 *   node parity.ts sync                 # copy vault/ into the target vault, (re)load the helper plugin
 *   node parity.ts snapshot <name>      # render every Parity/*.md note into parity/<name>/
 *   node parity.ts compare <a> <b>      # diff two snapshots; exits 1 when they differ
 *
 * Options: --vault <name> (default: $PARITY_VAULT or "Test Vault"); $OBSIDIAN_CLI overrides the CLI binary.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const VAULT_DIR = join(ROOT, "vault");
const PLUGIN_DIR = join(ROOT, "parity-plugin");
const SNAPSHOT_DIR = join(ROOT, "parity");
const PLUGIN_ID = "datacore-parity";
const OBSIDIAN_CLI = process.env["OBSIDIAN_CLI"] ?? "/Applications/Obsidian.app/Contents/MacOS/obsidian-cli";
/** Keep each eval's code argument well below macOS's ARG_MAX. */
const MAX_BATCH_BYTES = 200_000;

interface Options {
    vault: string;
    positional: string[];
}

function parseArgs(argv: string[]): Options {
    const positional: string[] = [];
    let vault = process.env["PARITY_VAULT"] ?? "Test Vault";
    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index];
        if (arg === "--vault") {
            const value = argv[++index];
            if (!value) throw new Error("--vault needs a value");
            vault = value;
        } else if (arg !== undefined) {
            positional.push(arg);
        }
    }
    return { vault, positional };
}

/** Per-call limit: `obsidian-cli` occasionally never returns a response, even though the app finished the work. */
const EVAL_TIMEOUT_MS = 60_000;

/** Run JavaScript in the live app and return its (string) result. Retries timed-out calls (pass idempotent code). */
function evaluate(vault: string, code: string, attempts = 2): string {
    for (let attempt = 1; ; attempt++) {
        let output: string;
        try {
            output = execFileSync(OBSIDIAN_CLI, [`vault=${vault}`, "eval", `code=${code}`], {
                encoding: "utf8",
                maxBuffer: 64 * 1024 * 1024,
                timeout: EVAL_TIMEOUT_MS,
            }).trimEnd();
        } catch (error) {
            const timedOut = (error as { code?: string }).code === "ETIMEDOUT";
            if (timedOut && attempt < attempts) {
                console.warn(`obsidian-cli did not answer within ${EVAL_TIMEOUT_MS / 1000}s; retrying.`);
                continue;
            }
            throw error;
        }
        // The CLI echoes console output captured during the eval (e.g. `[error] ...` lines) before the result line.
        const resultLine = output.split("\n").findLast((line) => line.startsWith("=> "));
        if (resultLine === undefined) throw new Error(`obsidian-cli eval failed: ${output.slice(0, 500)}`);
        return resultLine.slice(3);
    }
}

/** Evaluate an async function body that receives `payload` (any JSON value) and returns a JSON-serializable value. */
function evaluateJson<T>(vault: string, body: string, payload: unknown = null): T {
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
    const code =
        `(async () => { const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob("${encoded}"), ` +
        `(c) => c.charCodeAt(0)))); const result = await (async (payload) => { ${body} })(payload); ` +
        `return JSON.stringify(result ?? null); })()`;
    return JSON.parse(evaluate(vault, code)) as T;
}

function walk(directory: string): string[] {
    return readdirSync(directory).flatMap((name) => {
        const path = join(directory, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

function vaultPath(path: string): string {
    return relative(VAULT_DIR, path).split(sep).join("/");
}

function batches<T extends { content: string }>(items: T[]): T[][] {
    const result: T[][] = [];
    let current: T[] = [];
    let size = 0;
    for (const item of items) {
        if (current.length > 0 && size + item.content.length > MAX_BATCH_BYTES) {
            result.push(current);
            current = [];
            size = 0;
        }
        current.push(item);
        size += item.content.length;
    }
    if (current.length > 0) result.push(current);
    return result;
}

/** Copy `vault/` into the target vault (writing only changed files, trashing stale ones) and reload the helper. */
function sync(vault: string): void {
    const files = walk(VAULT_DIR).map((path) => ({ path: vaultPath(path), content: readFileSync(path, "utf8") }));
    let created = 0;
    let modified = 0;
    for (const batch of batches(files)) {
        const result = evaluateJson<{ created: number; modified: number }>(
            vault,
            `let created = 0, modified = 0;
            for (const { path, content } of payload) {
                const folder = path.split("/").slice(0, -1).join("/");
                if (folder && !app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder).catch(() => {});
                const existing = app.vault.getAbstractFileByPath(path);
                if (!existing) { await app.vault.create(path, content); created++; }
                else if ((await app.vault.read(existing)) !== content) { await app.vault.modify(existing, content); modified++; }
            }
            return { created, modified };`,
            batch
        );
        created += result.created;
        modified += result.modified;
    }

    const roots = [...new Set(files.map((file) => file.path.split("/")[0]))];
    const trashed = evaluateJson<string[]>(
        vault,
        `const { roots, keep } = payload; const keepSet = new Set(keep); const trashed = [];
        for (const file of app.vault.getFiles()) {
            if (roots.includes(file.path.split("/")[0]) && !keepSet.has(file.path)) {
                await app.fileManager.trashFile(file); trashed.push(file.path);
            }
        }
        return trashed;`,
        { roots, keep: files.map((file) => file.path) }
    );

    const plugin = {
        main: readFileSync(join(PLUGIN_DIR, "main.js"), "utf8"),
        manifest: readFileSync(join(PLUGIN_DIR, "manifest.json"), "utf8"),
    };
    evaluateJson(
        vault,
        `const dir = app.vault.configDir + "/plugins/${PLUGIN_ID}";
        if (!(await app.vault.adapter.exists(dir))) await app.vault.adapter.mkdir(dir);
        await app.vault.adapter.write(dir + "/main.js", payload.main);
        await app.vault.adapter.write(dir + "/manifest.json", payload.manifest);
        await app.plugins.loadManifests();
        await app.plugins.disablePlugin("${PLUGIN_ID}");
        await app.plugins.enablePlugin("${PLUGIN_ID}");
        return true;`,
        plugin
    );

    console.log(
        `Synced ${files.length} files into "${vault}": ${created} created, ${modified} modified, ` +
            `${trashed.length} trashed${trashed.length ? ` (${trashed.join(", ")})` : ""}; helper plugin reloaded.`
    );
}

/** Make snapshots diffable: one tag per line, volatile attributes and stack frames removed. */
function normalize(html: string): string {
    return (
        html
            // Obsidian/Preact generated ids and per-render keys.
            .replace(/\s(id|data-id|data-heading-id|aria-controls|aria-labelledby)="[^"]*"/g, "")
            // Stack frames carry bundle line numbers, which change with every build; keep only the error message.
            .replace(/\n\s+at [^\n<]*/g, "")
            .replace(/></g, ">\n<")
            .trim() + "\n"
    );
}

function snapshot(vault: string, name: string): void {
    const notes = readdirSync(join(VAULT_DIR, "Parity"))
        .filter((file) => file.endsWith(".md"))
        .sort();
    const out = join(SNAPSHOT_DIR, name);
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });

    const status = evaluateJson<{ engine: string; revision: number; plugins: string[] }>(
        vault,
        `if (!window.__datacoreParity) throw new Error("The datacore-parity helper is not loaded; run 'sync' first.");
        if (!window.dc) throw new Error("window.dc is not defined; is Datacore Engine enabled?");
        await window.dc.ready();
        // Let pending index updates land: wait for the revision to stay put for a second.
        let revision = -1;
        while (revision !== window.dc.revision) { revision = window.dc.revision; await new Promise((r) => setTimeout(r, 1000)); }
        return { engine: window.dc.engineVersion, revision, plugins: Object.keys(app.plugins.plugins).sort() };`
    );

    const unsettled: string[] = [];
    for (const note of notes) {
        const path = `Parity/${note}`;
        const result = evaluateJson<{ html: string; settled: boolean }>(
            vault,
            `return await window.__datacoreParity.render(payload);`,
            path
        );
        if (!result.settled) unsettled.push(note);
        writeFileSync(join(out, note.replace(/\.md$/, ".html")), normalize(result.html));
    }

    writeFileSync(
        join(out, "_meta.json"),
        JSON.stringify({ engine: status.engine, plugins: status.plugins, notes }, null, 2) + "\n"
    );
    console.log(`Snapshot "${name}": ${notes.length} notes rendered (engine ${status.engine}) → ${out}`);
    if (unsettled.length > 0) {
        console.error(`Warning: still changing after the timeout: ${unsettled.join(", ")}`);
        process.exitCode = 2;
    }
}

/** Compare the rendered notes of two snapshots (`_meta.json` describes the environment and is only printed). */
function compare(first: string, second: string): void {
    const [a, b] = [join(SNAPSHOT_DIR, first), join(SNAPSHOT_DIR, second)];
    for (const dir of [a, b]) if (!existsSync(dir)) throw new Error(`No snapshot at ${dir}`);
    for (const [name, dir] of [
        [first, a],
        [second, b],
    ] as const) {
        const metaPath = join(dir, "_meta.json");
        if (existsSync(metaPath)) {
            const meta = JSON.parse(readFileSync(metaPath, "utf8")) as { engine?: string; plugins?: string[] };
            console.log(`${name}: engine ${meta.engine ?? "?"}; plugins ${(meta.plugins ?? []).join(", ")}`);
        }
    }

    const notes = [...new Set([...readdirSync(a), ...readdirSync(b)])].filter((file) => file.endsWith(".html")).sort();
    const differing: string[] = [];
    for (const note of notes) {
        const diff = spawnSync("git", ["diff", "--no-index", "--exit-code", "--", join(a, note), join(b, note)], {
            stdio: "inherit",
        });
        if (diff.status !== 0) differing.push(note);
    }

    if (differing.length === 0)
        console.log(`Snapshots "${first}" and "${second}" are identical (${notes.length} notes).`);
    else console.error(`${differing.length} of ${notes.length} notes differ: ${differing.join(", ")}`);
    process.exitCode = differing.length === 0 ? 0 : 1;
}

const { vault, positional } = parseArgs(process.argv.slice(2));
const [command, ...rest] = positional;
switch (command) {
    case "sync":
        sync(vault);
        break;
    case "snapshot":
        if (!rest[0]) throw new Error("Usage: node parity.ts snapshot <name>");
        snapshot(vault, rest[0]);
        break;
    case "compare":
        if (!rest[0] || !rest[1]) throw new Error("Usage: node parity.ts compare <a> <b>");
        compare(rest[0], rest[1]);
        break;
    default:
        console.error("Usage: node parity.ts sync | snapshot <name> | compare <a> <b> [--vault <name>]");
        process.exitCode = 1;
}
