//! Utilities for running javascript.

import { transform } from "sucrase";
import builtinModules from "builtin-modules/static";

export type ScriptLanguage = "js" | "ts" | "jsx" | "tsx";

/**
 * JSX options for script blocks. `production` matters: in development mode sucrase adds `__self`/`__source` props to
 * every element, and Preact renders them as DOM attributes.
 */
const JSX_OPTIONS = { jsxPragma: "h", jsxFragmentPragma: "Fragment", production: true } as const;

/** Converts a raw script in the given language to plain javascript.  */
export function transpile(script: string, language: ScriptLanguage): string {
    switch (language) {
        case "js":
            return script;
        case "jsx":
            return transform(script, { transforms: ["jsx"], ...JSX_OPTIONS }).code;
        case "ts":
            return transform(script, { transforms: ["typescript"] }).code;
        case "tsx":
            return transform(script, { transforms: ["typescript", "jsx"], ...JSX_OPTIONS }).code;
    }
}

/**
 * Evaluate a script where 'this' for the script is set to the given context. Allows you to define global variables.
 */
export function evalInContext(script: string, variables: Record<string, unknown>): unknown {
    const pairs = Object.entries(variables);
    const keys = pairs.map(([key, _]) => key);
    const values = pairs.map(([_, value]) => value);

    // Executing user-authored view scripts is the feature; this is the single sanctioned dynamic-code entry point.
    // oxlint-disable-next-line no-new-func, typescript/no-implied-eval
    return new Function(...keys, script)(...values);
}

/**
 * Evaluate a script possibly asynchronously, if the script contains `async/await` blocks.
 */
export async function asyncEvalInContext(script: string, variables: Record<string, unknown>): Promise<unknown> {
    if (script.includes("await")) {
        return evalInContext("return (async () => { " + script + " })()", variables) as Promise<unknown>;
    } else {
        return Promise.resolve(evalInContext(script, variables));
    }
}

/** Module specifier prefixes that are provided by the host (Obsidian's plugin loader) rather than the vault. */
const HOST_MODULE_PREFIXES: readonly string[] = ["@codemirror/", "@lezer/"];
/** Exact module specifiers provided by the host: Obsidian, Electron, and Node built-ins (desktop only). */
const HOST_MODULES: ReadonlySet<string> = new Set(["obsidian", "electron", ...builtinModules]);

/**
 * Whether a `dc.require` specifier names a host-provided module (e.g. `obsidian`, `@codemirror/state`, `fs`,
 * `node:path`) that should be loaded via the plugin's own `require`, rather than a script in the vault.
 */
export function isHostModule(specifier: string): boolean {
    const bare = specifier.startsWith("node:") ? specifier.substring("node:".length) : specifier;
    return HOST_MODULES.has(bare) || HOST_MODULE_PREFIXES.some((prefix) => specifier.startsWith(prefix));
}
