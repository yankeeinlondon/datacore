/** What the views need from their host plugin. */
import type { DatacoreApi } from "@yankeeinlondon/datacore-contract";
import type { App } from "obsidian";
import type { EmbedQueue } from "./embed-queue";

/**
 * Services for the views: the engine (through the contract API only), Obsidian's app, and a throttled file reader.
 * The views never touch engine internals; in P2 this is all `datacore-view-preact` receives.
 */
export interface ViewServices {
    /** The engine, via the public contract. */
    readonly engine: DatacoreApi;
    /** Obsidian's app (workspace, vault, metadata cache) for rendering and navigation. */
    readonly app: App;
    /** Reads files with limited concurrency, de-duplicating concurrent reads of the same file. */
    readonly reader: EmbedQueue;
}
