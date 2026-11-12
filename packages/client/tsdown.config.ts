import { defineConfig } from "tsdown";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    platform: "neutral",
    // Eager tsc emit: the lazy per-file mode fails to emit declarations for shared files reached through re-exports.
    dts: { tsc: { eager: true } },
    clean: true,
    // datacore-shared is private: bundle it into the client instead of depending on it at runtime.
    noExternal: ["@yankeeinlondon/datacore-shared"],
});
