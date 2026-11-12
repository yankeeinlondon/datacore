/** Typing for the engine global that the engine plugin installs for scripts and the console. */
import type { DatacoreApi } from "@yankeeinlondon/datacore-contract";

declare global {
    interface Window {
        /**
         * The Datacore engine API, for scripts (Templater, QuickAdd), the developer console, and code blocks.
         * Plugins should use `getDatacore()` instead: it handles load order, versions, and engine reloads.
         */
        dc?: DatacoreApi;
    }
}
