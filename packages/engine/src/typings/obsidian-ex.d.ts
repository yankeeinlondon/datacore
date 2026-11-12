import type { DatacorePlugin } from "main";
import type { CanvasMetadataIndex } from "index/types/json/canvas";

import "obsidian";

/** Provides extensions used by datacore or provider to other plugins via datacore. */
declare module "obsidian" {
    /** Context Obsidian passes to an embed creator (private API). */
    interface EmbedContext {
        app: App;
        linktext: string;
        sourcePath: string;
        showInline: boolean;
        depth: number;
        containerEl: HTMLElement;
        displayMode: boolean;
    }

    /** A rendered file embed (private API). */
    type FileEmbed = FileView & { loadFile: (file: TFile) => void };

    /** An embed creator: a class in older Obsidian versions, a factory function in Obsidian 1.15+. */
    type EmbedCreator =
        | (new (context: EmbedContext, file: TFile, subpath?: string) => FileEmbed)
        | ((context: EmbedContext, file: TFile, subpath?: string) => FileEmbed);

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

        embedRegistry: {
            embedByExtension: {
                [key: string]: unknown;
                md: MarkdownRenderer;
            };

            /** Private API. Returned a class up to some 1.x release; Obsidian 1.15 returns a factory function. */
            getEmbedCreator: (arg: TFile) => EmbedCreator;
        };
    }
}

/** The engine API global for scripts and the console (installed by EngineHost; see the client for consumer typings). */
declare global {
    interface Window {
        dc?: import("@yankeeinlondon/datacore-contract").DatacoreApi;
    }
}
