import type { DisplaySettings } from "@yankeeinlondon/datacore-contract";
import { deferred, Deferred } from "utils/deferred";
import { Datastore, Substorer } from "index/datastore";
import { FileCache, INDEX_SCHEMA_VERSION, LocalStorageCache } from "index/persister";
import { Indexable, INDEXABLE_EXTENSIONS } from "index/types/indexable";
import { FileImporter, FileImportService, ImportThrottle } from "index/web-worker/importer";
import { ImportResult } from "index/web-worker/message";
import { App, Component, EventRef, Events, MetadataCache, TAbstractFile, TFile, Vault } from "obsidian";
import { Settings } from "settings";
import { MarkdownListBlock, MarkdownListItem, MarkdownPage } from "./types/markdown";
import { GenericFile } from "./types/files";
import { DateTime } from "luxon";
import { JsonMarkdownPage } from "./types/json/markdown";
import { Canvas, CanvasTextCard } from "./types/canvas";

/**
 * Services Datacore depends on that need a browser/Obsidian environment. Defaults are the production implementations
 * (web-worker importer, IndexedDB cache); tests and alternative hosts can substitute their own.
 */
export interface DatacoreServices {
    /** Imports files into their JSON representation. Default: background web workers. */
    importer: FileImportService;
    /** Persistent metadata cache. Default: IndexedDB via localforage. */
    persister: FileCache;
}

/** Central API object; handles initialization, events, debouncing, and access to datacore functionality. */
export class Datacore extends Component {
    /** Access to the obsidian vault. */
    vault: Vault;
    /** Provides access to per-(markdown)-file metadata. */
    metadataCache: MetadataCache;
    /** Datacore events, mainly used to update downstream views. This object is shadowed by the Datacore object itself. */
    events: Events;

    /** @internal In-memory index over all stored metadata. */
    datastore: Datastore;
    /** @internal Asynchronous multi-threaded file importer with throttling. */
    importer: FileImportService;
    /** @internal Local-storage backed cache of metadata objects. */
    persister: FileCache;
    /** @internal Only set when datacore is in the midst of initialization; tracks current progress. */
    initializer?: DatacoreInitializer;
    /** If true, datacore is fully hydrated and all files have been indexed. */
    initialized: boolean;

    constructor(
        public app: App,
        public version: string,
        public settings: Settings,
        services: Partial<DatacoreServices> = {}
    ) {
        super();

        this.vault = app.vault;
        this.metadataCache = app.metadataCache;
        // Vault-scoped cache, validated by index schema version (not plugin version).
        this.persister = services.persister ?? new LocalStorageCache(app.appId ?? "default", INDEX_SCHEMA_VERSION);
        this.events = new Events();

        this.datastore = new Datastore(app.vault, app.metadataCache, settings);
        this.initialized = false;

        if (services.importer) {
            this.importer = services.importer;
        } else {
            const workerImporter = new FileImporter(app.vault, app.fileManager, app.metadataCache, () => {
                return {
                    workers: settings.importerNumThreads,
                    utilization: Math.max(0.1, Math.min(1.0, settings.importerUtilization)),
                } as ImportThrottle;
            });
            this.addChild(workerImporter);
            this.importer = workerImporter;
        }
    }

    /** Obtain the current index revision, for determining if anything has changed. */
    get revision() {
        return this.datastore.revision;
    }

    /** Initialize datacore by scanning persisted caches and all available files, and queueing parses as needed. */
    initialize() {
        // Metadata cache handles markdown file updates.
        this.registerEvent(this.metadataCache.on("resolve", (file) => this.reload(file)));

        // Renames do not set off the metadata cache; catch these explicitly.
        this.registerEvent(this.vault.on("rename", this.rename, this));

        // Handle generic file creates and updates; resolve generally only applies to markdown files
        // but we do keep basic metadata about all files.
        this.registerEvent(
            this.vault.on("create", (file) => {
                if (!(file instanceof TFile)) return;

                // Handled by the metadata cache.
                if (INDEXABLE_EXTENSIONS.has(file.extension.toLowerCase())) return;

                this.reload(file);
            })
        );

        this.registerEvent(
            this.vault.on("modify", (file) => {
                if (!(file instanceof TFile)) return;

                // Handled by the metadata cache.
                if (INDEXABLE_EXTENSIONS.has(file.extension.toLowerCase())) return;

                this.reload(file);
            })
        );

        // File creation does cause a metadata change, but deletes do not. Clear the caches for this.
        this.registerEvent(
            this.vault.on("delete", (file) => {
                if (!(file instanceof TFile)) return;

                if (this.datastore.delete(file.path)) {
                    this.trigger("update", this.revision);
                }
            })
        );

        this.index();
    }

    /** Clears all current state and caches and reindexes the entire vault from scratch. */
    async reindex() {
        this.initialized = false;
        this.datastore.clear();

        await this.persister.recreate();

        await this.index();
    }

    /** Indexes all documents in the vault. Wait on this if you want to wait for the whole index to be ready. */
    async index() {
        // Asynchronously initialize actual content in the background using a lifecycle-respecting object.
        const init = (this.initializer = new DatacoreInitializer(this));
        this.addChild(init);

        await init.finished();

        this.initialized = true;
        this.initializer = undefined;
        this.removeChild(init);

        this.datastore.touch();
        this.trigger("update", this.revision);
        this.trigger("initialized");

        // Clean up any documents which no longer exist in the vault.
        // TODO: I think this may race with other concurrent operations, so
        // this may need to happen at the start of init and not at the end.
        const currentFiles = this.vault.getFiles().map((file) => file.path);
        this.persister.synchronize(currentFiles);
    }

    private async rename(file: TAbstractFile, oldPath: string) {
        if (!(file instanceof TFile)) {
            return;
        }

        // Delete the file at the old path, then request a reload at the new path.
        // This is less optimal than what can probably be done, but paths are used in a bunch of places
        // (for sections, tasks, etc to refer to their parent file) and it requires some finesse to fix.
        this.datastore.delete(oldPath);
        await this.reload(file);

        this.trigger("rename", file.path, oldPath);

        // TODO: For correctness, probably have to either fix links in all linked files OR
        // just stop normalizing links in the store. We can traverse the links index to do so
        // but it is fairly painful.
    }

    /** Queue a file for reloading; this is done asynchronously in the background and may take a few seconds. */
    public async reload(file: TFile): Promise<Indexable> {
        // Filter files by file extensions.
        if (!INDEXABLE_EXTENSIONS.has(file.extension)) {
            const result = new GenericFile(
                file.path,
                DateTime.fromMillis(file.stat.ctime),
                DateTime.fromMillis(file.stat.mtime),
                file.stat.size
            );

            this.datastore.store(result);
            return result;
        }

        const result = await this.importer.import<ImportResult>(file);

        if (result.type === "error") {
            throw new Error(`Failed to import file '${file.name}': ${result.$error}`);
        } else if (result.type === "markdown") {
            // Parse the file and normalize metadata from it.
            const parsed = MarkdownPage.from(result.result, (link) => {
                const rpath = this.metadataCache.getFirstLinkpathDest(link.path, result.result.$path!);
                if (rpath) return link.withPath(rpath.path);
                else return link;
            });

            // Store it recursively into the datastore for querying.
            this.storeMarkdown(parsed);

            // Write it to the file cache for faster loads in the future.
            this.persister.storeFile(parsed.$path, parsed.json());

            // And finally trigger an update.
            this.trigger("update", this.revision);
            return parsed;
        } else if (result.type === "canvas") {
            const parsed = Canvas.from(result.result, (link) => {
                const rpath = this.metadataCache.getFirstLinkpathDest(link.path, result.result.$path!);
                if (rpath) return link.withPath(rpath.path);
                else return link;
            });

            // Store it recursively into the datastore for querying.
            this.storeCanvas(parsed);

            // Write it to the file cache for faster loads in the future.
            this.persister.storeFile(parsed.$path, parsed.json());

            // And finally trigger an update.
            this.trigger("update", this.revision);
            return parsed;
        }

        throw new Error("Encountered unrecognized import result type: " + (result as { type: unknown }).type);
    }

    /** Store a canvas document. */
    public storeCanvas(data: Canvas) {
        this.datastore.store(data, (object, store) => {
            store(object.$cards, (card, store) => {
                if (card instanceof CanvasTextCard) {
                    store(card.$sections, (section, store) => {
                        store(section.$blocks, (block, store) => {
                            if (block instanceof MarkdownListBlock) {
                                // Recursive store function for storing list heirarchies.
                                const storeRec: Substorer<MarkdownListItem> = (item, store) =>
                                    store(item.$elements, storeRec);

                                store(block.$elements, storeRec);
                            }
                        });
                    });
                }
            });
        });
    }

    /** Store a markdown document. */
    public storeMarkdown(data: MarkdownPage) {
        this.datastore.store(data, (object, store) => {
            store(object.$sections, (section, store) => {
                store(section.$blocks, (block, store) => {
                    if (block instanceof MarkdownListBlock) {
                        // Recursive store function for storing list heirarchies.
                        const storeRec: Substorer<MarkdownListItem> = (item, store) => store(item.$elements, storeRec);

                        store(block.$elements, storeRec);
                    }
                });
            });
        });
    }

    ///////////////////////
    // Event propogation //
    ///////////////////////

    /** Called whenever the index updates to a new revision. This is the broadest possible datacore event. */
    public on(evt: "update", callback: (revision: number) => void, context?: unknown): EventRef;
    /** Called whenever datacore records a file rename and has finished reindexing the rename. */
    public on(evt: "rename", callback: (newPath: string, oldPath: string) => void, context?: unknown): EventRef;
    /** Called when datacore has initialized and is querable. */
    public on(evt: "initialized", callback: () => void, context?: unknown): EventRef;
    /** Called periodically while datacore is performing its initial index, and once more when it finishes. */
    public on(evt: "index-progress", callback: (progress: IndexProgress) => void, context?: unknown): EventRef;
    /** Called when the shared display settings change. */
    public on(evt: "display-settings", callback: (display: DisplaySettings) => void, context?: unknown): EventRef;

    on<T extends Function>(evt: string, callback: T, context?: unknown): EventRef {
        return this.events.on(evt, callback as unknown as (...args: unknown[]) => unknown, context);
    }

    /** Unsubscribe from an event using the event and original callback. */
    off(evt: string, callback: (...data: unknown[]) => void) {
        this.events.off(evt, callback);
    }

    /** Unsubscribe from an event using the event reference.  */
    offref(ref: EventRef) {
        this.events.offref(ref);
    }

    /** Trigger an update event. */
    private trigger(evt: "update", revision: number): void;
    /** Trigger a rename event. */
    private trigger(evt: "rename", newPath: string, oldPath: string): void;
    /** Trigger an initialization event. */
    private trigger(evt: "initialized"): void;
    /** Trigger an initial-index progress event. */
    private trigger(evt: "index-progress", progress: IndexProgress): void;
    /** Trigger a display-settings change event. */
    private trigger(evt: "display-settings", display: DisplaySettings): void;

    /** Trigger an event. */
    private trigger(evt: string, ...args: unknown[]): void {
        this.events.trigger(evt, ...args);
    }

    /** @internal Publish a display-settings change; called when settings are updated. */
    public notifyDisplaySettings(display: DisplaySettings): void {
        this.trigger("display-settings", display);
    }

    /** @internal Publish initial-index progress; called by the initializer. */
    public notifyIndexProgress(progress: IndexProgress): void {
        this.trigger("index-progress", progress);
    }
}

/** @public Progress of the initial vault index. */
export interface IndexProgress {
    /** Number of files processed so far (imported, loaded from cache, or skipped). */
    initialized: number;
    /** Total number of files being indexed. */
    total: number;
}

/** Lifecycle-respecting file queue which will import files, reading them from the file cache if needed. */
export class DatacoreInitializer extends Component {
    /** Number of concurrent operations the initializer will perform. */
    static BATCH_SIZE: number = 8;
    /** Number of completed files between yields to the renderer. */
    static YIELD_INTERVAL: number = 32;
    /** Time yielded to the renderer between initialization batches. */
    static YIELD_DELAY_MS: number = 16;

    /** Whether the initializer should continue to run. */
    active: boolean;

    /** Queue of files to still import. */
    queue: TFile[];
    /** The files actively being imported. */
    current: TFile[];
    /** Whether the initializer is currently yielding to the renderer. */
    yielding: boolean;
    /** Handle of the pending renderer-yield timer, if any. */
    yieldTimer?: number;
    /** Deferred promise which resolves when importing is done. */
    done: Deferred<InitializationStats>;

    /** The total number of target files to import. */
    targetTotal: number;
    /** The time that init started in milliseconds. */
    start: number;
    /** Total number of files to import. */
    files: number;
    /** Total number of imported files so far. */
    initialized: number;
    /** Total number of imported files. */
    imported: number;
    /** Total number of skipped files. */
    skipped: number;
    /** Total number of cached files. */
    cached: number;

    constructor(public core: Datacore) {
        super();

        this.active = false;
        this.queue = this.core.vault.getFiles();
        this.targetTotal = this.queue.length;
        this.files = this.queue.length;
        this.start = Date.now();
        this.current = [];
        this.yielding = false;
        this.done = deferred();

        this.initialized = this.imported = this.skipped = this.cached = 0;
    }

    onload() {
        // Queue BATCH_SIZE elements from the queue to import.
        this.active = true;

        // Cancel any pending renderer yield if the initializer is unloaded mid-index.
        this.register(() => {
            if (this.yieldTimer !== undefined) window.clearTimeout(this.yieldTimer);
            this.yieldTimer = undefined;
        });

        this.runNext();
    }

    /** Current progress of this initializer. */
    progress(): IndexProgress {
        return { initialized: this.initialized, total: this.targetTotal };
    }

    /** Promise which resolves when the initialization completes. */
    finished(): Promise<InitializationStats> {
        return this.done;
    }

    /** Cancel initialization. */
    onunload() {
        if (this.active) {
            this.active = false;
            this.done.reject("Initialization was cancelled before completing.");
        }
    }

    /** Poll for another task to execute from the queue. */
    private runNext() {
        // Do nothing if max number of concurrent operations already running.
        if (!this.active || this.current.length >= DatacoreInitializer.BATCH_SIZE) {
            return;
        }

        // There is space available to execute another.
        const next = this.queue.pop();
        if (next) {
            this.current.push(next);

            // Run asynchronously to allow for concurrency.
            (async () => {
                try {
                    const result = await this.init(next);
                    this.handleResult(next, result);
                } catch (_error) {
                    this.handleResult(next, { status: "skipped" });
                }
            })();

            this.runNext();
        } else if (!next && this.current.length == 0) {
            this.active = false;

            // All work is done, resolve.
            this.done.resolve({
                durationMs: Date.now() - this.start,
                files: this.files,
                imported: this.imported,
                skipped: this.skipped,
                cached: this.cached,
            });
        }
    }

    /** Process the result of an initialization and queue more runs. */
    private handleResult(file: TFile, result: InitializationResult) {
        const index = this.current.indexOf(file);
        if (index !== -1) this.current.splice(index, 1);
        this.initialized++;

        if (result.status === "skipped") this.skipped++;
        else if (result.status === "imported") this.imported++;
        else if (result.status === "cached") this.cached++;

        // Always publish the terminal state, even if the final import completes during a yield.
        if (this.initialized == this.targetTotal) {
            this.core.notifyIndexProgress(this.progress());
            this.runNext();
        } else if (this.initialized % DatacoreInitializer.YIELD_INTERVAL == 0 && !this.yielding) {
            this.core.notifyIndexProgress(this.progress());
            this.yielding = true;
            this.yieldTimer = window.setTimeout(() => {
                this.yieldTimer = undefined;
                this.yielding = false;
                this.runNext();
            }, DatacoreInitializer.YIELD_DELAY_MS);
        } else if (!this.yielding) {
            this.runNext();
        }
    }

    /** Initialize a specific file. */
    private async init(file: TFile): Promise<InitializationResult> {
        try {
            // Handle loading markdown files from cache.
            const cached = await this.core.persister.loadFile(file.path);
            if (cached && cached.time >= file.stat.mtime && cached.version == INDEX_SCHEMA_VERSION) {
                if (file.extension === "md") {
                    const data = MarkdownPage.from(cached.data as JsonMarkdownPage, (link) => link);
                    this.core.storeMarkdown(data);
                    return { status: "cached" };
                }
            }

            // Does not match an existing import type, just reload normally.
            await this.core.reload(file);
            return { status: "imported" };
        } catch (ex) {
            console.warn("Datacore: Failed to import file: ", ex);
            return { status: "skipped" };
        }
    }
}

/** Statistics about a successful vault initialization. */
export interface InitializationStats {
    /** How long initializaton took in miliseconds. */
    durationMs: number;
    /** Total number of files that were imported */
    files: number;
    /** The number of files that were loaded and imported via background workers. */
    imported: number;
    /** The number of files that were skipped due to no longer existing or not being ready. */
    skipped: number;
    /** The number of files loaded from the IndexedDB cache. */
    cached: number;
}

/** The result of initializing a file. */
interface InitializationResult {
    status: "skipped" | "imported" | "cached";
}
