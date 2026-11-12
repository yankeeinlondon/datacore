import type { DatacoreHandle } from "@yankeeinlondon/datacore-client";
import { Plugin } from "obsidian";
import { PreactViewApi } from "./api/api";
import { DatacoreBlock } from "./block";
import { EngineConnection } from "./connection";
import { EmbedQueue } from "./ui/embed-queue";
import type { ScriptLanguage } from "./ui/scripting";

/** Code block languages and the script type each one runs. */
const LANGUAGES: Readonly<Record<string, ScriptLanguage>> = {
    datacorejs: "js",
    datacorejsx: "jsx",
    datacorets: "ts",
    datacoretsx: "tsx",
};

/** CodeMirror (legacy) modes used to highlight each script type. */
const HIGHLIGHT_MODES: Readonly<Record<ScriptLanguage, string>> = {
    js: "javascript",
    jsx: "jsx",
    ts: "text/typescript",
    tsx: "text/typescript-jsx",
};

/**
 * Datacore View: Preact. Renders Datacore's script blocks with Preact, reaching the engine only through
 * `@yankeeinlondon/datacore-client` (Engine Room spec §9).
 */
export default class DatacoreViewPreactPlugin extends Plugin {
    private readonly views = new WeakMap<DatacoreHandle, PreactViewApi>();

    onload(): void {
        const reader = this.addChild(new EmbedQueue(this.app.vault, () => 8));
        const connection = new EngineConnection(this.app, this);
        this.register(() => connection.stop());
        void connection.start();

        for (const [language, scriptType] of Object.entries(LANGUAGES)) {
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
        }

        this.register(this.registerCodeblockHighlighting());
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
