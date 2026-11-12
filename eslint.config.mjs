/**
 * Minimal ESLint config: only the Obsidian community-guideline rules that oxlint cannot run.
 *
 * Everything else is linted by oxlint (.oxlintrc.json), including the untyped `eslint-plugin-obsidianmd` rules via
 * `jsPlugins`. The rules here need TypeScript type information (typescript-eslint `projectService`) or lint non-JS
 * files (manifest.json, LICENSE), which oxlint's JS-plugin bridge does not support yet.
 */
import json from "@eslint/json";
import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

/** Type-aware rules from obsidianmd's `recommended` preset (same severities). */
const TYPED_OBSIDIAN_RULES = {
    "obsidianmd/no-plugin-as-component": "error",
    "obsidianmd/no-view-references-in-plugin": "error",
    "obsidianmd/no-misused-promises": "error",
    "obsidianmd/no-unsupported-api": "error",
    "obsidianmd/prefer-create-el": "warn",
    "obsidianmd/prefer-instanceof": "warn",
    "obsidianmd/prefer-file-manager-trash-file": "warn",
};

export default [
    {
        ignores: ["**/build/**", "**/dist/**", "**/node_modules/**", "docs/**", "features/**", "**/src/test/**"],
    },
    {
        files: ["packages/*/src/**/*.{ts,tsx}"],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
        },
        plugins: { obsidianmd },
        rules: TYPED_OBSIDIAN_RULES,
    },
    {
        // Upstream code with known violations, fixed when these files are reworked in P1/P2 (Engine Room spec,
        // §4.2). Downgraded per file, not globally, so new code is held to the full rule.
        files: [
            "packages/engine/src/api/ui/embed.tsx",
            "packages/engine/src/index/datacore.ts",
            "packages/engine/src/ui/javascript.tsx",
        ],
        rules: { "obsidianmd/no-misused-promises": "warn" },
    },
    {
        files: ["packages/*/manifest.json"],
        language: "json/json",
        plugins: { json, obsidianmd },
        rules: { "obsidianmd/validate-manifest": "warn" },
    },
    {
        files: ["LICENSE.txt"],
        language: "obsidianmd/plain-text",
        plugins: { obsidianmd },
        rules: { "obsidianmd/validate-license": "warn" },
    },
];
