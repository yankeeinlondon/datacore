#!/usr/bin/env node
/**
 * Stage the library packages for publishing to JSR (jsr.io).
 *
 * JSR publishes TypeScript source, and every file in a JSR package must live inside the published directory. The
 * client imports the private `@yankeeinlondon/datacore-shared` workspace package (bundled into the npm build), which is
 * never published (Engine Room spec, D9). So instead of publishing a package directory as-is, this script builds a
 * self-contained copy under `build/jsr/<pkg>/` (gitignored):
 *
 *   - `src/` — the package's non-test sources, with relative imports given explicit `.ts` extensions (JSR/Deno does not
 *     resolve extensionless specifiers);
 *   - for the client, `src/_shared/` — shared's non-test sources, with the client's `@yankeeinlondon/datacore-shared`
 *     imports rewritten to relative paths into it (shared stays an implementation detail, exactly as in the npm bundle);
 *   - `jsr.json` — name and version from package.json, the entry point, and an import map for the bare specifiers
 *     (`luxon` is type-only; the contract maps to its JSR package);
 *   - `README.md` and `LICENSE.txt`.
 *
 * It also writes `build/jsr/deno.json`, a Deno workspace of the staged packages, so the client's
 * `jsr:@yankeeinlondon/datacore-contract` import resolves to the staged contract (needed for a dry run before the
 * contract's first JSR release, and keeps both checked against the same source).
 *
 *   node scripts/stage-jsr.mjs                    # stage contract and client
 *   node scripts/stage-jsr.mjs contract           # stage one
 *
 * Then: `cd build/jsr && npx jsr publish --dry-run`, or publish one package from `build/jsr/<pkg>`.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PACKAGES = ["contract", "client"];
const SHARED_SPECIFIER = "@yankeeinlondon/datacore-shared";
const CONTRACT_SPECIFIER = "@yankeeinlondon/datacore-contract";
const jsrRoot = path.join(root, "build", "jsr");
const sharedSrcDir = path.join(root, "packages", "shared", "src");

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
    fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function isSourceFile(file) {
    return file.endsWith(".ts") && !/\.(test|spec)\.ts$/.test(file);
}

/** Every non-test `.ts` file under `dir`, as paths relative to it. */
function listSources(dir, base = dir) {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...listSources(full, base));
        else if (isSourceFile(entry.name)) files.push(path.relative(base, full));
    }
    return files.sort((left, right) => left.localeCompare(right));
}

/** Resolve an extensionless relative specifier to `./x.ts` or `./x/index.ts`, checked against the source tree. */
function withExtension(specifier, fromFile) {
    if (/\.(ts|js|mjs|cjs|json)$/.test(specifier)) return specifier;
    const target = path.resolve(path.dirname(fromFile), specifier);
    if (fs.existsSync(`${target}.ts`)) return `${specifier}.ts`;
    if (fs.existsSync(path.join(target, "index.ts"))) return `${specifier.replace(/\/$/, "")}/index.ts`;
    throw new Error(`cannot resolve "${specifier}" from ${path.relative(root, fromFile)}`);
}

/** `from "x"`, `import("x")`, and side-effect `import "x"` specifiers. */
const SPECIFIER_PATTERN = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])([^"']+)\2/g;

/** Bare specifiers (anything not relative, not `jsr:`/`npm:`/`node:`) in the sources under `dir`. */
function bareSpecifiers(dir) {
    const found = new Set();
    for (const file of listSources(dir)) {
        const code = fs.readFileSync(path.join(dir, file), "utf8");
        for (const [, , , specifier] of code.matchAll(SPECIFIER_PATTERN)) {
            if (!specifier.startsWith(".") && !/^(jsr|npm|node):/.test(specifier)) found.add(specifier);
        }
    }
    return [...found].sort((left, right) => left.localeCompare(right));
}

const contractMajor = readJson(path.join(root, "packages", "contract", "package.json")).version.split(".")[0];

/** Import map for every bare specifier the staged sources may use. */
const IMPORTS = {
    // luxon is type-only in the contract, shared, and the client. luxon ships no types, so every luxon import gets a
    // `@ts-types` directive pointing at `@types/luxon` (see LUXON_TYPES); without it the types resolve to `any`.
    luxon: "npm:luxon@^2.4.0",
    [CONTRACT_SPECIFIER]: `jsr:${CONTRACT_SPECIFIER}@^${contractMajor}.0.0`,
};

/** Deno's directive for an npm package whose types live in a separate `@types` package. */
const LUXON_TYPES = '// @ts-types="npm:@types/luxon@^2.4.0"';
/** A whole `import ... from "luxon";` line (every luxon import in the sources is a top-level type-only import). */
const LUXON_IMPORT = /^import\s[^;]*\sfrom\s["']luxon["'];$/gm;

function stage(pkgName) {
    const packageDir = path.join(root, "packages", pkgName);
    const stageDir = path.join(jsrRoot, pkgName);
    const stageSrcDir = path.join(stageDir, "src");
    const stageSharedEntry = path.join(stageSrcDir, "_shared", "index.ts");
    const packageJson = readJson(path.join(packageDir, "package.json"));

    /** Relative specifiers get explicit extensions; the shared package becomes a relative path into `_shared/`. */
    function rewrite(code, sourceFile, stagedFile) {
        code = code.replace(LUXON_IMPORT, (line) => `${LUXON_TYPES}\n${line}`);
        return code.replace(SPECIFIER_PATTERN, (match, prefix, quote, specifier) => {
            let next = specifier;
            if (specifier.startsWith(".")) {
                next = withExtension(specifier, sourceFile);
            } else if (specifier === SHARED_SPECIFIER) {
                next = path.relative(path.dirname(stagedFile), stageSharedEntry).split(path.sep).join("/");
                if (!next.startsWith(".")) next = `./${next}`;
            }
            return `${prefix}${quote}${next}${quote}`;
        });
    }

    function copySources(fromDir, toDir) {
        for (const file of listSources(fromDir)) {
            const sourceFile = path.join(fromDir, file);
            const stagedFile = path.join(toDir, file);
            fs.mkdirSync(path.dirname(stagedFile), { recursive: true });
            fs.writeFileSync(stagedFile, rewrite(fs.readFileSync(sourceFile, "utf8"), sourceFile, stagedFile));
        }
    }

    fs.rmSync(stageDir, { recursive: true, force: true });
    fs.mkdirSync(stageSrcDir, { recursive: true });
    copySources(path.join(packageDir, "src"), stageSrcDir);
    if (pkgName === "client") {
        copySources(sharedSrcDir, path.dirname(stageSharedEntry));
        // JSR rejects global type augmentation ("modifying global types is not allowed"), which the dry run does not
        // check. `global.ts` only types `window.dc` for scripts; the JSR build leaves it out (see the client README).
        fs.rmSync(path.join(stageSrcDir, "global.ts"));
        const indexFile = path.join(stageSrcDir, "index.ts");
        const index = fs.readFileSync(indexFile, "utf8");
        const withoutGlobal = index.replace(/^import\s+["']\.\/global\.ts["'];\r?\n/m, "");
        if (withoutGlobal === index) throw new Error('staged client: expected `import "./global.ts";` in index.ts');
        fs.writeFileSync(indexFile, withoutGlobal);
    }
    for (const file of listSources(stageSrcDir)) {
        const staged = fs.readFileSync(path.join(stageSrcDir, file), "utf8");
        if (/import\(\s*["']luxon["']\s*\)/.test(staged)) {
            throw new Error(`staged ${pkgName}: ${file} has an inline import("luxon"), which cannot carry @ts-types`);
        }
        if (/^\s*declare\s+global\b/m.test(staged)) {
            throw new Error(`staged ${pkgName}: ${file} augments global types, which JSR rejects`);
        }
    }

    const used = bareSpecifiers(stageSrcDir);
    const unmapped = used.filter((specifier) => !(specifier in IMPORTS));
    if (unmapped.length > 0) {
        throw new Error(`unmapped bare imports in staged ${pkgName}: ${unmapped.join(", ")}`);
    }

    writeJson(path.join(stageDir, "jsr.json"), {
        name: packageJson.name,
        version: packageJson.version,
        license: packageJson.license,
        exports: "./src/index.ts",
        imports: Object.fromEntries(used.map((specifier) => [specifier, IMPORTS[specifier]])),
        // The repo's tsconfig settings, so `deno publish` type-checks against the DOM (Obsidian) rather than the
        // Deno/Node globals (e.g. `window.setTimeout` returns a number). Only affects local checking, not consumers.
        compilerOptions: {
            lib: ["es2022", "dom", "dom.iterable"],
            strict: true,
            noUncheckedIndexedAccess: true,
            noImplicitOverride: true,
        },
        publish: {
            include: ["src/**/*.ts", "README.md", "LICENSE.txt", "jsr.json"],
            exclude: ["src/**/*.test.ts", "src/**/*.spec.ts"],
        },
    });
    for (const file of ["README.md", "LICENSE.txt"]) {
        fs.copyFileSync(path.join(packageDir, file), path.join(stageDir, file));
    }

    console.log(`staged ${packageJson.name}@${packageJson.version} → ${path.relative(root, stageDir)}/`);
    for (const file of [...listSources(stageDir), "README.md", "LICENSE.txt", "jsr.json"].sort((left, right) =>
        left.localeCompare(right)
    )) {
        console.log(`  ${file}`);
    }
}

const requested = process.argv.slice(2);
const unknown = requested.filter((name) => !PACKAGES.includes(name));
if (unknown.length > 0) {
    console.error(`usage: node scripts/stage-jsr.mjs [${PACKAGES.join("|")}]...  (unknown: ${unknown.join(", ")})`);
    process.exit(1);
}

for (const pkgName of requested.length > 0 ? requested : PACKAGES) stage(pkgName);

// Workspace of whatever is staged, in dependency order (contract first).
const members = PACKAGES.filter((name) => fs.existsSync(path.join(jsrRoot, name, "jsr.json"))).map(
    (name) => `./${name}`
);
writeJson(path.join(jsrRoot, "deno.json"), { workspace: members });
