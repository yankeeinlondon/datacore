import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const source = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
    resolve: {
        alias: [
            // The engine imports its own modules bare, relative to `baseUrl: "src"` (e.g. "index/datacore"); mirror that.
            {
                find: /^(api|expression|index|test|ui|utils|settings|main)(\/.*)?$/,
                replacement: `${source}/$1$2`,
            },
            // `obsidian` ships types only; tests get a minimal runtime shim.
            { find: /^obsidian$/, replacement: `${source}/test/shims/obsidian.ts` },
        ],
    },
    test: {
        environment: "jsdom",
        include: ["src/test/**/*.test.ts"],
        setupFiles: ["src/test/setup.ts"],
    },
});
