import type { DatacoreHandle } from "@yankeeinlondon/datacore-client";
import { MarkdownPreviewRenderer, Plugin } from "obsidian";
import { PreactViewApi } from "./api/api";
import { DatacoreBlock } from "./block";
import { EngineConnection } from "./connection";
import { CONVERT_COMMAND_NAME, startConversion } from "./migrate/modal";
import { rebuildViewsWithCodeBlocks } from "./refresh";
import { installDataArrayChildren } from "./ui/data-array-children";
import { EmbedQueue } from "./ui/embed-queue";
import type { ScriptLanguage } from "./ui/scripting";

/**
 * Code block languages and the script type each one runs (Engine Room spec §9.3). Upstream Datacore's `datacore*`
 * languages are never registered, so both plugins can run side by side; the migration command converts old blocks.
 */
const LANGUAGES: Readonly<Record<string, ScriptLanguage>> = {
    dc: "js",
    dct: "ts",
    dcx: "jsx",
    dctx: "tsx",
};

/** CodeMirror (legacy) modes used to highlight each script type. */
const HIGHLIGHT_MODES: Readonly<Record<ScriptLanguage, string>> = {
    js: "javascript",
    jsx: "jsx",
    ts: "text/typescript",
    tsx: "text/typescript-jsx",
};

function warnLanguageTaken(language: string, error?: unknown): void {
    console.warn(
        `Datacore View: Preact: the '${language}' code block language is already registered by another plugin; ` +
            "those blocks will not render as Datacore views.",
        ...(error === undefined ? [] : [error])
    );
}

/**
 * Whether another plugin already registered a code block processor for `language`. Checked before registering because
 * Obsidian (1.15) adds a post-processor before it rejects a duplicate language, and that post-processor is never
 * removed: it would keep rendering the other plugin's blocks with our handler until Obsidian restarts. Reads a private
 * registry; if it is missing, registration falls back to catching the error.
 */
function isCodeBlockLanguageTaken(language: string): boolean {
    const registry = (MarkdownPreviewRenderer as unknown as { codeBlockPostProcessors?: Record<string, unknown> })
        .codeBlockPostProcessors;
    return registry !== undefined && Object.prototype.hasOwnProperty.call(registry, language);
}

/**
 * Datacore View: Preact. Renders Datacore's script blocks with Preact, reaching the engine only through
 * `@yankeeinlondon/datacore-client` (Engine Room spec §9).
 */
export default class DatacoreViewPreactPlugin extends Plugin {
    private readonly views = new WeakMap<DatacoreHandle, PreactViewApi>();

    onload(): void {
        this.register(installDataArrayChildren());
        const reader = this.addChild(new EmbedQueue(this.app.vault, () => 8));
        const connection = new EngineConnection(this.app, this);
        this.register(() => connection.stop());
        void connection.start();

        for (const [language, scriptType] of Object.entries(LANGUAGES)) {
            if (isCodeBlockLanguageTaken(language)) {
                warnLanguageTaken(language);
                continue;
            }
            try {
                this.registerMarkdownCodeBlockProcessor(
                    language,
                    (source, element, context) => {
                        context.addChild(
                            new DatacoreBlock(
                                element,
                                connection,
                                (engine, ...args) => this.view(engine, reader).renderScript(...args),
                                source,
                                context.sourcePath,
                                scriptType
                            )
                        );
                    },
                    -100
                );
            } catch (error) {
                // Obsidian throws if another plugin registered this language first; skip it so the others still work.
                warnLanguageTaken(language, error);
            }
        }

        this.register(this.registerCodeblockHighlighting());
        // Enabled or reloaded while notes are open: their editors parsed the dc* blocks before our modes and
        // processors existed, so rebuild them (at startup the layout loads after us, and this is skipped).
        if (this.app.workspace.layoutReady) void rebuildViewsWithCodeBlocks(this.app, Object.keys(LANGUAGES));

        this.addCommand({
            id: "convert-datacore-code-blocks",
            name: CONVERT_COMMAND_NAME,
            callback: () => void startConversion(this.app),
        });
    }

    /** One view API per engine handle (the handle survives engine reloads, so in practice one per plugin load). */
    private view(engine: DatacoreHandle, reader: EmbedQueue): PreactViewApi {
        let view = this.views.get(engine);
        if (!view) {
            view = new PreactViewApi({ engine, app: this.app, reader });
            this.views.set(engine, view);
        }
        return view;
    }

    /** Register code block highlighting; returns a closure which reverts it. */
    private registerCodeblockHighlighting(): () => void {
        for (const [language, scriptType] of Object.entries(LANGUAGES)) {
            window.CodeMirror.defineMode(language, (config) =>
                window.CodeMirror.getMode(config, HIGHLIGHT_MODES[scriptType])
            );
        }

        return () => {
            for (const language of Object.keys(LANGUAGES)) {
                window.CodeMirror.defineMode(language, (config) => window.CodeMirror.getMode(config, "null"));
            }
        };
    }
}
