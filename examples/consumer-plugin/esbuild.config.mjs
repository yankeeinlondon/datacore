// Adapted from the Obsidian sample plugin (https://github.com/obsidianmd/obsidian-sample-plugin).
import { builtinModules } from "node:module";
import process from "node:process";
import esbuild from "esbuild";

const production = process.argv[2] === "production";

const context = await esbuild.context({
    entryPoints: ["main.ts"],
    bundle: true,
    external: [
        "obsidian",
        "electron",
        "@codemirror/autocomplete",
        "@codemirror/collab",
        "@codemirror/commands",
        "@codemirror/language",
        "@codemirror/lint",
        "@codemirror/search",
        "@codemirror/state",
        "@codemirror/view",
        "@lezer/common",
        "@lezer/highlight",
        "@lezer/lr",
        ...builtinModules,
    ],
    format: "cjs",
    target: "es2020",
    logLevel: "info",
    sourcemap: production ? false : "inline",
    treeShaking: true,
    minify: production,
    outfile: "main.js",
});

if (production) {
    await context.rebuild();
    process.exit(0);
} else {
    await context.watch();
}
