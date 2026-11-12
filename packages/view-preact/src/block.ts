/**
 * One rendered code block. While the engine is connected it hosts the script renderer; otherwise it shows why the view
 * cannot run. Every transition (including reconnecting after the engine reloads) rebuilds the content, so the script
 * runs again against the live engine.
 */
import type { DatacoreHandle } from "@yankeeinlondon/datacore-client";
import { MarkdownRenderChild } from "obsidian";
import type { EngineConnection } from "./connection";
import { unavailableMessage } from "./connection";
import type { ScriptLanguage } from "./ui/scripting";

/** Renders a script into a container on behalf of a parent component; returns the child to remove later. */
export type ScriptRenderer = (
    engine: DatacoreHandle,
    source: string,
    container: HTMLElement,
    parent: MarkdownRenderChild,
    sourcePath: string,
    language: ScriptLanguage
) => MarkdownRenderChild & { path?: string };

export class DatacoreBlock extends MarkdownRenderChild {
    private content: (MarkdownRenderChild & { path?: string }) | undefined;

    public constructor(
        container: HTMLElement,
        private readonly connection: EngineConnection,
        private readonly renderScript: ScriptRenderer,
        private readonly source: string,
        private sourcePath: string,
        private readonly language: ScriptLanguage
    ) {
        super(container);
    }

    public onload(): void {
        this.render();
        const changes = this.connection.onChange(() => this.render());
        this.register(() => changes.dispose());
    }

    private render(): void {
        if (this.content) {
            // The renderer tracks renames; keep its latest path for the next render.
            this.sourcePath = this.content.path ?? this.sourcePath;
            this.removeChild(this.content);
            this.content = undefined;
        }
        this.containerEl.empty();

        const state = this.connection.state;
        if (state.status === "connected") {
            this.content = this.renderScript(
                state.engine,
                this.source,
                this.containerEl,
                this,
                this.sourcePath,
                this.language
            );
        } else {
            this.containerEl.createDiv({
                cls: [
                    "datacore-engine-unavailable",
                    state.status === "connecting" ? "is-connecting" : "is-unavailable",
                ],
                text: unavailableMessage(state),
            });
        }
    }
}
