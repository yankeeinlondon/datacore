#!/usr/bin/env node
/**
 * Check the published client as an outside consumer would see it, at the version in packages/client/package.json:
 *   - npm: install from the registry, strict `tsc` (skipLibCheck off), import the ESM build;
 *   - JSR from an npm project (`npx jsr add`): `tsc` with skipLibCheck on (JSR's d.ts imports `@types/luxon`, TS6137);
 *   - Deno (`jsr:` import), when `deno` is installed.
 * Each probe contains a deliberate misuse of a luxon type behind `@ts-expect-error`, so it fails if luxon's types
 * degrade to `any`. Waits up to 10 minutes for a just-published version to appear on npm.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const version = JSON.parse(fs.readFileSync(path.join(root, "packages/client/package.json"), "utf8")).version;
const work = fs.mkdtempSync(path.join(os.tmpdir(), "datacore-verify-"));
const TSC = "--noEmit --strict --module esnext --moduleResolution bundler --target es2022 --lib es2022,dom";

function run(command, cwd) {
    return execSync(command, { cwd, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
}

function probe(specifier) {
    return `import { isLink, satisfiesApi, type DatacoreApi } from "${specifier}";
type Now = ReturnType<DatacoreApi["luxon"]["DateTime"]["now"]>;
const year: number = (null as unknown as Now).year;
// @ts-expect-error luxon's types must be real: year is a number
const wrong: string = (null as unknown as Now).year;
console.log(satisfiesApi("1.0.0", "1.0"), isLink({}), year, wrong);
`;
}

function project(name) {
    const dir = path.join(work, name);
    fs.mkdirSync(dir);
    run("npm init -y", dir);
    return dir;
}

const results = [];
function check(label, fn) {
    try {
        fn();
        results.push(`ok    ${label}`);
    } catch (error) {
        results.push(`FAIL  ${label}\n${String(error.stdout ?? "") + String(error.stderr ?? "") || error.message}`);
    }
}

// Wait for npm to serve the version (new publishes are invisible for a few minutes).
for (let attempt = 0; ; attempt++) {
    try {
        if (
            run(`npm view @yankeeinlondon/datacore-client@${version} version --prefer-online`, work).trim() === version
        ) {
            break;
        }
    } catch {
        // 404 while npm scans the new version
    }
    if (attempt >= 60) throw new Error(`@yankeeinlondon/datacore-client@${version} did not appear on npm`);
    if (attempt === 0) console.log(`Waiting for npm to serve datacore-client@${version}…`);
    await new Promise((resolve) => setTimeout(resolve, 10_000));
}

check(`npm  @yankeeinlondon/datacore-client@${version} (strict, skipLibCheck off, ESM import)`, () => {
    const dir = project("npm");
    run(`npm i @yankeeinlondon/datacore-client@${version} typescript@5.9.3 --prefer-online`, dir);
    fs.writeFileSync(path.join(dir, "probe.ts"), probe("@yankeeinlondon/datacore-client"));
    run(`npx tsc ${TSC} --skipLibCheck false probe.ts`, dir);
    run(
        `node --input-type=module -e "import('@yankeeinlondon/datacore-client').then(m => { if (!m.satisfiesApi('1.0.0', '1.0')) process.exit(1); })"`,
        dir
    );
});

check(`jsr  @yankeeinlondon/datacore-client@${version} via npm (skipLibCheck on)`, () => {
    const dir = project("jsr-npm");
    run(`npx --yes jsr add @yankeeinlondon/datacore-client@${version}`, dir);
    run("npm i typescript@5.9.3", dir);
    fs.writeFileSync(path.join(dir, "probe.ts"), probe("@yankeeinlondon/datacore-client"));
    run(`npx tsc ${TSC} --skipLibCheck true probe.ts`, dir);
});

let hasDeno = true;
try {
    run("deno --version", work);
} catch {
    hasDeno = false;
}
if (hasDeno) {
    check(`deno jsr:@yankeeinlondon/datacore-client@${version}`, () => {
        const dir = path.join(work, "deno");
        fs.mkdirSync(dir);
        fs.writeFileSync(path.join(dir, "probe.ts"), probe(`jsr:@yankeeinlondon/datacore-client@${version}`));
        run("deno check --minimum-dependency-age=0 probe.ts", dir);
    });
} else {
    results.push("skip deno (not installed)");
}

console.log(results.join("\n"));
fs.rmSync(work, { recursive: true, force: true });
if (results.some((line) => line.startsWith("FAIL"))) process.exit(1);
