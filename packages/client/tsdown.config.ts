import { defineConfig } from "tsdown";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm"],
    platform: "neutral",
    dts: true,
    clean: true,
    // datacore-shared is private: bundle it into the client instead of depending on it at runtime.
    noExternal: ["@yankeeinlondon/datacore-shared"],
});
