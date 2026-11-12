#!/usr/bin/env node
/**
 * Publish an Obsidian plugin package to its release repo (one plugin per GitHub repo, as the community store and BRAT
 * expect).
 *
 *   node scripts/release-plugin.mjs <engine|view-preact> [--dry-run] [--skip-build]
 *
 * Steps:
 *   1. Preflight: clean working tree, a releasable version (`x.y.z` or `x.y.z-<pre>.N`), plugin manifests in sync with
 *      package.json (`sync-plugin-manifests.mjs --check`), and the channel manifest (`manifest.json` for stable,
 *      `manifest-beta.json` for prereleases) at the package version.
 *   2. Build: `pnpm --filter <package> build`, then check `build/plugin/` (main.js, manifest.json at the package
 *      version, optional styles.css).
 *   3. Release repo: clone (`gh repo clone`) into a temp dir; refuse if a release or tag for the version exists; write
 *      the root files (stable: `manifest.json`, plus `manifest-beta.json` if the repo has one; prerelease:
 *      `manifest-beta.json` only), `versions.json`, `README.md` and `LICENSE`; commit and push to the default branch.
 *   4. GitHub release tagged with the bare version (no `v`), `--prerelease` for prerelease versions, with main.js,
 *      manifest.json and styles.css attached.
 *
 * `--dry-run` runs the local steps and the read-only network ones (clone, release/tag lookup) and prints every
 * mutating action (commit, push, release) without running it; the prepared working copy is left in place to inspect.
 * `--skip-build` reuses an existing `build/plugin/` (still validated).
 *
 * The release repo is `releaseRepo` in the package's package.json (default `yankeeinlondon/<manifest id>`).
 * Authentication is whatever `gh` uses: `gh auth login` locally, `GH_TOKEN` in CI (see release-plugins.yml).
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PLUGINS = ["engine", "view-preact"];
const DEFAULT_OWNER = "yankeeinlondon";
/** Assets Obsidian downloads from a release; styles.css is optional. */
const REQUIRED_ASSETS = ["main.js", "manifest.json"];
const OPTIONAL_ASSETS = ["styles.css"];
/** Obsidian accepts `x.y.z`; BRAT also takes prereleases such as `0.1.0-beta.1`. */
const VERSION_PATTERN = /^\d+\.\d+\.\d+(-[0-9A-Za-z]+(\.[0-9A-Za-z]+)*)?$/;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const skipBuild = args.includes("--skip-build");
const positional = args.filter((arg) => !arg.startsWith("--"));
const unknownFlags = args.filter((arg) => arg.startsWith("--") && !["--dry-run", "--skip-build"].includes(arg));

function usage(message) {
    if (message) console.error(`error: ${message}`);
    console.error(`Usage: node scripts/release-plugin.mjs <${PLUGINS.join("|")}> [--dry-run] [--skip-build]`);
    process.exit(2);
}

function fail(message) {
    console.error(`\nrelease-plugin: ${message}`);
    process.exit(1);
}

function step(title) {
    console.log(`\n== ${title}`);
}

function info(message) {
    console.log(`   ${message}`);
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function jsonText(value) {
    return JSON.stringify(value, null, 2) + "\n";
}

function quote(arg) {
    return /^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`;
}

/** Run a command and return its trimmed stdout; throws (with stderr shown) on a non-zero exit. */
function run(command, commandArgs, options = {}) {
    info(`$ ${[command, ...commandArgs].map(quote).join(" ")}${options.cwd ? `   (in ${options.cwd})` : ""}`);
    return execFileSync(command, commandArgs, {
        cwd: options.cwd ?? root,
        encoding: "utf8",
        stdio: options.inherit ? "inherit" : ["ignore", "pipe", "inherit"],
    })?.trim();
}

/** Run a command that changes something outside this machine (push, release); printed only under --dry-run. */
function mutate(command, commandArgs, options = {}) {
    if (dryRun) {
        info(`[dry-run] would run: ${[command, ...commandArgs].map(quote).join(" ")}`);
        return "";
    }
    return run(command, commandArgs, { ...options, inherit: true });
}

/** Run a command only to learn whether it succeeds (e.g. "does this release exist?"). */
function succeeds(command, commandArgs, options = {}) {
    return spawnSync(command, commandArgs, { cwd: options.cwd ?? root, stdio: "ignore" }).status === 0;
}

// ---------------------------------------------------------------------------------------------------------------------

if (unknownFlags.length > 0) usage(`unknown option ${unknownFlags.join(", ")}`);
if (positional.length !== 1 || !PLUGINS.includes(positional[0])) usage();
const plugin = positional[0];
const packageDir = path.join(root, "packages", plugin);
const buildDir = path.join(packageDir, "build", "plugin");

const pkg = readJson(path.join(packageDir, "package.json"));
const stableManifest = readJson(path.join(packageDir, "manifest.json"));
const version = pkg.version;
const isPrerelease = version.includes("-");
const releaseRepo = pkg.releaseRepo ?? `${DEFAULT_OWNER}/${stableManifest.id}`;
const channelManifestName = isPrerelease ? "manifest-beta.json" : "manifest.json";

console.log(
    `release-plugin: ${pkg.name}@${version} -> ${releaseRepo} (${isPrerelease ? "prerelease, BRAT" : "stable"})` +
        (dryRun ? " [DRY RUN]" : "")
);

// 1. Preflight ---------------------------------------------------------------------------------------------------------
step("Preflight");
if (!VERSION_PATTERN.test(version) || version === "0.0.0") {
    fail(`version '${version}' is not releasable (expected x.y.z or x.y.z-beta.N, not 0.0.0).`);
}
if (isPrerelease && !/-beta\.\d+$/.test(version)) {
    info(`note: prerelease '${version}' is not of the form x.y.z-beta.N; publishing it as a GitHub prerelease anyway.`);
}

const dirty = run("git", ["status", "--porcelain"]);
if (dirty) fail(`working tree is dirty; commit or stash first:\n${dirty}`);
const sourceSha = run("git", ["rev-parse", "HEAD"]);
const sourceBranch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
info(`source: ${sourceBranch} @ ${sourceSha}`);
if (sourceBranch !== "master") info(`warning: releasing from '${sourceBranch}', not master.`);

try {
    run("node", [path.join(root, "scripts", "sync-plugin-manifests.mjs"), "--check"], { inherit: true });
} catch {
    fail("plugin manifests are out of sync with package.json (run `node scripts/sync-plugin-manifests.mjs`).");
}
const channelPath = path.join(packageDir, channelManifestName);
if (!fs.existsSync(channelPath)) fail(`${path.relative(root, channelPath)} is missing.`);
const channelManifest = readJson(channelPath);
if (channelManifest.version !== version) {
    fail(`${path.relative(root, channelPath)} version ${channelManifest.version} != package version ${version}.`);
}
info(`${path.relative(root, channelPath)} is at ${version}`);

// 2. Build -------------------------------------------------------------------------------------------------------------
step("Build");
if (skipBuild) info("--skip-build: reusing the existing build output");
else run("pnpm", ["--filter", pkg.name, "build"], { inherit: true });

for (const asset of REQUIRED_ASSETS) {
    if (!fs.existsSync(path.join(buildDir, asset)))
        fail(`build output is missing ${path.relative(root, buildDir)}/${asset}.`);
}
const assets = [...REQUIRED_ASSETS, ...OPTIONAL_ASSETS.filter((asset) => fs.existsSync(path.join(buildDir, asset)))];
const builtManifest = readJson(path.join(buildDir, "manifest.json"));
if (builtManifest.version !== version) {
    fail(`built manifest.json version ${builtManifest.version} != package version ${version}.`);
}
if (builtManifest.id !== stableManifest.id) {
    fail(`built manifest.json id ${builtManifest.id} != ${stableManifest.id}.`);
}
for (const asset of assets) {
    const { size } = fs.statSync(path.join(buildDir, asset));
    info(`asset ${asset} (${size.toLocaleString("en-US")} bytes)`);
}

// 3. Release repo --------------------------------------------------------------------------------------------------------
step(`Release repo ${releaseRepo}`);
let defaultBranch;
try {
    defaultBranch = JSON.parse(run("gh", ["repo", "view", releaseRepo, "--json", "defaultBranchRef"])).defaultBranchRef
        ?.name;
} catch {
    fail(`cannot read ${releaseRepo}; create it first (and check \`gh auth status\` / GH_TOKEN).`);
}
defaultBranch ||= "main";
info(`default branch: ${defaultBranch}`);

if (succeeds("gh", ["release", "view", version, "--repo", releaseRepo])) {
    fail(`${releaseRepo} already has a release ${version}; bump the version first.`);
}
if (succeeds("gh", ["api", `repos/${releaseRepo}/git/ref/tags/${version}`])) {
    fail(`${releaseRepo} already has a tag ${version} (without a release); delete it or bump the version.`);
}
info(`no release or tag ${version} yet`);

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `release-${stableManifest.id}-`));
const repoDir = path.join(workDir, "repo");
run("gh", ["repo", "clone", releaseRepo, repoDir, "--", "--quiet"]);
if (succeeds("git", ["rev-parse", "--verify", "HEAD"], { cwd: repoDir })) {
    run("git", ["checkout", "--quiet", defaultBranch], { cwd: repoDir });
} else {
    // A repo with no commits yet: start the default branch.
    run("git", ["checkout", "--quiet", "-b", defaultBranch], { cwd: repoDir });
}

/** The repo's root files, keyed by name. */
const files = new Map();
if (isPrerelease) {
    files.set("manifest-beta.json", jsonText(builtManifest));
} else {
    files.set("manifest.json", jsonText(builtManifest));
    // Keep BRAT's beta channel from pointing at a version older than the stable one.
    if (fs.existsSync(path.join(repoDir, "manifest-beta.json")))
        files.set("manifest-beta.json", jsonText(builtManifest));
}
files.set("versions.json", fs.readFileSync(path.join(packageDir, "versions.json"), "utf8"));

// README/LICENSE: tools/release-repo/<plugin>/ overrides the package README and the root LICENSE.txt.
const templateDir = path.join(root, "tools", "release-repo", plugin);
const firstExisting = (...candidates) => candidates.find((candidate) => fs.existsSync(candidate));
const readmeSource = firstExisting(path.join(templateDir, "README.md"), path.join(packageDir, "README.md"));
const licenseSource = firstExisting(path.join(templateDir, "LICENSE"), path.join(root, "LICENSE.txt"));
if (!readmeSource)
    fail(`no README: add ${path.relative(root, templateDir)}/README.md or packages/${plugin}/README.md.`);
files.set("README.md", fs.readFileSync(readmeSource, "utf8"));
files.set("LICENSE", fs.readFileSync(licenseSource, "utf8"));
info(`README.md <- ${path.relative(root, readmeSource)}; LICENSE <- ${path.relative(root, licenseSource)}`);

for (const [name, content] of files) fs.writeFileSync(path.join(repoDir, name), content);
run("git", ["add", "--", ...files.keys()], { cwd: repoDir });
const staged = run("git", ["diff", "--cached", "--stat"], { cwd: repoDir });
if (staged) {
    for (const line of staged.split("\n")) info(`  ${line}`);
    const message = `release: ${version}\n\nBuilt from yankeeinlondon/datacore@${sourceSha} (${pkg.name}).`;
    mutate("git", ["commit", "--quiet", "-m", message], { cwd: repoDir });
    mutate("git", ["push", "origin", `HEAD:${defaultBranch}`], { cwd: repoDir });
} else info("root files already up to date; nothing to commit");

// 4. GitHub release --------------------------------------------------------------------------------------------------------
step(`GitHub release ${version}`);
const notesPath = path.join(workDir, "notes.md");
fs.writeFileSync(notesPath, releaseNotes());
info(`release notes: ${notesPath}`);
mutate("gh", [
    "release",
    "create",
    version,
    "--repo",
    releaseRepo,
    "--target",
    defaultBranch,
    "--title",
    version,
    "--notes-file",
    notesPath,
    ...(isPrerelease ? ["--prerelease"] : ["--latest"]),
    ...assets.map((asset) => path.join(buildDir, asset)),
]);

step("Done");
if (dryRun) {
    info(`dry run: nothing was committed, pushed or released. Prepared working copy: ${repoDir}`);
} else {
    info(`released https://github.com/${releaseRepo}/releases/tag/${version}`);
    fs.rmSync(workDir, { recursive: true, force: true });
}

/** The package CHANGELOG section for this version when there is one, plus where the build came from. */
function releaseNotes() {
    const changelogPath = path.join(packageDir, "CHANGELOG.md");
    let section = "";
    if (fs.existsSync(changelogPath)) {
        const lines = fs.readFileSync(changelogPath, "utf8").split("\n");
        const start = lines.findIndex((line) => line.trim() === `## ${version}`);
        if (start !== -1) {
            const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
            section = lines
                .slice(start + 1, end === -1 ? undefined : end)
                .join("\n")
                .trim();
        }
    }
    const install = isPrerelease
        ? `Beta: install with [BRAT](https://github.com/TfTHacker/obsidian42-brat) using \`${releaseRepo}\`.`
        : "Install from Obsidian's Community plugins browser, or with BRAT.";
    return [section, install, `Built from yankeeinlondon/datacore@${sourceSha}.`].filter(Boolean).join("\n\n") + "\n";
}
