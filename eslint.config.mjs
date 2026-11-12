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
        ignores: [
            ".claude/**",
            "**/build/**",
            "**/dist/**",
            "**/node_modules/**",
            "docs/**",
            "examples/**",
            "features/**",
            "fixtures/vault/**",
            "**/src/test/**",
        ],
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
        // manifest-beta.json is what BRAT reads and what the build ships; hold it to the store's rules too. `checkId`
        // adds the id rules for unpublished plugins (no "obsidian", must not end in "plugin").
        files: ["packages/*/manifest.json", "packages/*/manifest-beta.json"],
        language: "json/json",
        plugins: { json, obsidianmd },
        rules: { "obsidianmd/validate-manifest": ["warn", { checkId: true }] },
    },
    {
        files: ["LICENSE.txt"],
        language: "obsidianmd/plain-text",
        plugins: { obsidianmd },
        rules: { "obsidianmd/validate-license": "warn" },
    },
];
