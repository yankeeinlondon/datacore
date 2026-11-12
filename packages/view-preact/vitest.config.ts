import { fileURLToPath } from "node:url";
import { defaultClientConditions } from "vite";
import { defineConfig } from "vitest/config";

const source = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
    resolve: {
        // Resolve workspace packages to their TypeScript sources (the "source" export condition).
        conditions: ["source", ...defaultClientConditions],
        alias: [
            // `obsidian` ships types only; tests get a minimal runtime shim.
            { find: /^obsidian$/, replacement: `${source}/test/shims/obsidian.ts` },
        ],
    },
    test: {
        environment: "jsdom",
        include: ["src/test/**/*.test.ts"],
    },
});
