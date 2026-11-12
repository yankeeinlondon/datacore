import type { DatacorePlugin } from "main";
import type { CanvasMetadataIndex } from "index/types/json/canvas";

import "obsidian";

/** Provides extensions used by datacore or provider to other plugins via datacore. */
declare module "obsidian" {
    interface FileManager {
        linkUpdaters?: {
            canvas?: {
                canvas?: {
                    index?: {
                        index?: CanvasMetadataIndex;
                    };
                };
            };
        };
    }

    interface App {
        appId?: string;

        plugins: {
            enabledPlugins: Set<string>;
            plugins: {
                datacore?: DatacorePlugin;
            };
        };
    }
}

/** The engine API global for scripts and the console (installed by EngineHost; see the client for consumer typings). */
declare global {
    interface Window {
        dc?: import("@yankeeinlondon/datacore-contract").DatacoreApi;
    }
}
