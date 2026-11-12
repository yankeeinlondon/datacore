import { defaultClientConditions } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
    // Resolve workspace packages to their TypeScript sources (the "source" export condition).
    resolve: { conditions: ["source", ...defaultClientConditions] },
});
