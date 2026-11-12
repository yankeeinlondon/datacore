import { Notice, Plugin } from "obsidian";
import {
    getDatacore,
    isDatacoreError,
    isMarkdownPage,
    type DatacoreHandle,
    type Indexable,
} from "@yankeeinlondon/datacore-client";

/**
 * Reference example of a third-party plugin that uses Datacore Engine through the published client package.
 *
 * - Connects with `getDatacore()` and reports why when it cannot.
 * - Keeps a live page count in the status bar with a subscription.
 * - Follows the engine going away (`onRevoked`) and coming back (`onReconnected`).
 * - Adds a command that runs a one-off query and filters the results with a guard.
 */
export default class DatacoreExampleConsumer extends Plugin {
    /** The engine handle, once connected. Public so it can be inspected from the developer console. */
    public engine?: DatacoreHandle;

    private statusBar?: HTMLElement;

    async onload(): Promise<void> {
        this.statusBar = this.addStatusBarItem();
        this.setStatus("Datacore: connecting…");

        this.addCommand({
            id: "show-tagged-page-count",
            name: "Show tagged page count",
            callback: () => this.showTaggedPageCount(),
        });

        // Never rejects: a missing engine is reported as `{ ok: false, reason, message }`.
        const result = await getDatacore(this.app, { consumer: this, minApi: "1.0" });
        if (!result.ok) {
            this.setStatus(`Datacore: ${result.reason}`);
            new Notice(`Datacore Example Consumer: Datacore Engine unavailable (${result.reason}). ${result.message}`);
            return;
        }

        const engine = result.engine;
        this.engine = engine;

        // Called immediately with the current results, then whenever the set of pages changes. Disposed automatically
        // when this plugin unloads, and replayed by the client after the engine reloads.
        engine.subscribe("@page", (pages) => {
            this.setStatus(`Datacore: ${pages.length} pages`);
        });

        engine.onRevoked(() => this.setStatus("Datacore: engine off"));
        engine.onReconnected(() => {
            // The replayed subscription will report again; show a fresh count right away in the meantime.
            this.setStatus(`Datacore: ${engine.query("@page").length} pages`);
        });
    }

    private showTaggedPageCount(): void {
        const engine = this.engine;
        if (!engine) {
            new Notice("Datacore Example Consumer: not connected to Datacore Engine.");
            return;
        }

        let results: Indexable[];
        try {
            results = engine.query("@page and #book");
        } catch (error) {
            if (isDatacoreError(error)) {
                new Notice(`Datacore Example Consumer: query failed (${error.code}). ${error.message}`);
                return;
            }
            throw error;
        }

        // Engine objects come from another plugin's bundle: use the client's guards, never `instanceof`.
        const pages = results.filter(isMarkdownPage);
        const paths = pages.slice(0, 3).map((page) => page.$path);
        const sample = paths.length > 0 ? ` (e.g. ${paths.join(", ")})` : "";
        new Notice(`${pages.length} pages tagged #book${sample}`);
    }

    private setStatus(text: string): void {
        this.statusBar?.setText(text);
    }
}
