#!/usr/bin/env node
/**
 * Keep each Obsidian plugin package's manifest in step with its package.json version.
 *
 * Changesets bumps `package.json` versions; Obsidian reads `manifest.json` (and `versions.json`, a map of plugin
 * version → minimum Obsidian app version). Run after `changeset version`:
 *
 *   node scripts/sync-plugin-manifests.mjs          # write manifest.json / manifest-beta.json / versions.json
 *   node scripts/sync-plugin-manifests.mjs --check  # exit 1 if anything is out of sync (for CI)
 *
 * A plugin package is any `packages/*` directory with a `manifest.json`.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const checkOnly = process.argv.includes("--check");

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
    fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

const problems = [];
const changes = [];

const packagesDir = path.join(root, "packages");
for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const packageDir = path.join(packagesDir, entry.name);
    const manifestPath = path.join(packageDir, "manifest.json");
    if (!fs.existsSync(manifestPath)) continue;

    const { name, version } = readJson(path.join(packageDir, "package.json"));
    const isPrerelease = version.includes("-");
    // 0.0.0 marks a scaffold that has never been released; there is nothing to record yet.
    if (version === "0.0.0") continue;

    // Stable versions go to manifest.json; prereleases only to manifest-beta.json (BRAT's channel), when present.
    const manifestTargets = [];
    if (!isPrerelease) manifestTargets.push(manifestPath);
    const betaPath = path.join(packageDir, "manifest-beta.json");
    if (fs.existsSync(betaPath)) manifestTargets.push(betaPath);
    else if (isPrerelease) {
        // A prerelease with nowhere to record it would ship a manifest that disagrees with the package version.
        problems.push(`${path.relative(root, packageDir)}: prerelease ${version} needs a manifest-beta.json`);
    }

    for (const target of manifestTargets) {
        const manifest = readJson(target);
        if (manifest.version === version) continue;

        const label = path.relative(root, target);
        if (checkOnly) problems.push(`${label}: version ${manifest.version} != ${name}@${version}`);
        else {
            writeJson(target, { ...manifest, version });
            changes.push(`${label}: ${manifest.version} -> ${version}`);
        }
    }

    // versions.json records every released version with the minimum app version it requires.
    const versionsPath = path.join(packageDir, "versions.json");
    if (!isPrerelease && fs.existsSync(versionsPath)) {
        const versions = readJson(versionsPath);
        const { minAppVersion } = readJson(manifestPath);
        if (versions[version] !== minAppVersion) {
            const label = path.relative(root, versionsPath);
            if (checkOnly) problems.push(`${label}: missing ${version} -> ${minAppVersion}`);
            else {
                writeJson(versionsPath, { ...versions, [version]: minAppVersion });
                changes.push(`${label}: + ${version} -> ${minAppVersion}`);
            }
        }
    }
}

if (checkOnly) {
    if (problems.length > 0) {
        console.error("Plugin manifests are out of sync with package.json versions:\n  " + problems.join("\n  "));
        console.error("Run: node scripts/sync-plugin-manifests.mjs");
        process.exit(1);
    }
    console.log("Plugin manifests are in sync.");
} else {
    console.log(changes.length > 0 ? changes.join("\n") : "Plugin manifests already in sync.");
    if (problems.length > 0) {
        console.error("Could not sync:\n  " + problems.join("\n  "));
        process.exit(1);
    }
}
