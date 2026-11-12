import { defaultClientConditions, defaultServerConditions } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
    // Resolve workspace packages to their TypeScript sources (the "source" export condition). These tests run in the
    // Node environment, which resolves through the SSR conditions, so both lists need it; otherwise a fresh checkout
    // (CI) fails until the contract's dist is built.
    resolve: { conditions: ["source", ...defaultClientConditions] },
    ssr: { resolve: { conditions: ["source", ...defaultServerConditions] } },
});
