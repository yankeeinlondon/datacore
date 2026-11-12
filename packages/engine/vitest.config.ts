import { fileURLToPath } from "node:url";
import { defaultClientConditions } from "vite";
import { defineConfig } from "vitest/config";

const source = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
    resolve: {
        // Resolve workspace packages to their TypeScript sources (the "source" export condition).
        conditions: ["source", ...defaultClientConditions],
        alias: [
            // Tests never start web workers; keep the real worker source (which installs a global handler) out.
            { find: /^index\/web-worker\/importer\.worker$/, replacement: `${source}/test/shims/importer-worker.ts` },
            // The engine imports its own modules bare, relative to `baseUrl: "src"` (e.g. "index/datacore"); mirror that.
            {
                find: /^(api|expression|index|test|utils|settings|settings-tab|main)(\/.*)?$/,
                replacement: `${source}/$1$2`,
            },
            // `obsidian` ships types only; tests get a minimal runtime shim.
            { find: /^obsidian$/, replacement: `${source}/test/shims/obsidian.ts` },
        ],
    },
    test: {
        environment: "jsdom",
        include: ["src/test/**/*.test.ts"],
    },
});
