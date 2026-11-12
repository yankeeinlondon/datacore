/** The engine API: what `getDatacore()` returns and what `window.dc` exposes. */
import type { Capability } from "./constants";
import type { Coerce } from "./coerce";
import type { DataArray } from "./data-array";
import type { Expression } from "./expression";
import type { Indexable, MarkdownPage } from "./indexables";
import type { IndexQuery, SearchResult } from "./query";
import type { Result } from "./result";
import type { DisplaySettings } from "./settings";
import type { Link, Literal } from "./values";

/** Something that can be stopped: a subscription, an event listener. */
export interface Disposable {
    dispose(): void;
}

/** Options for reactive subscriptions. */
export interface SubscribeOptions {
    /**
     * Wait this many milliseconds after the last index change before calling back (default 500). `0` calls back
     * immediately on every relevant change.
     */
    debounce?: number;
}

/** Context passed to subscription callbacks. */
export interface SubscriptionMeta {
    /** The index revision the results were computed at. */
    revision: number;
    /** True for the initial call made when subscribing. */
    initial: boolean;
}

/** Progress of the engine's initial index. */
export interface IndexProgress {
    /** Files processed so far (imported, loaded from cache, or skipped). */
    initialized: number;
    /** Total files being indexed. */
    total: number;
}

/** A snapshot of engine state. */
export interface EngineStatus {
    /** True once the initial index has finished. */
    initialized: boolean;
    /** The current index revision. */
    revision: number;
    /** Initial-index progress (complete once `initialized` is true). */
    progress: IndexProgress;
    /** Number of indexed objects. */
    objects: number;
}

/** Identifies a consumer of the engine (usually a plugin). */
export interface ConsumerInfo {
    /** A stable identifier, normally the consumer's Obsidian plugin id. */
    id: string;
    /** A human-readable name, for diagnostics. */
    name?: string;
}

/** Querying, expressions, and links: shared by the global API and the path-scoped API. */
export interface DatacoreQueryApi {
    /** Load a markdown page by path or link. */
    page<T extends MarkdownPage = MarkdownPage>(path: string | Link): T | undefined;

    /** Run a query; throws a `DatacoreError` (`invalid-query`) on invalid queries. */
    query<T extends Indexable = Indexable>(query: string | IndexQuery): T[];
    /** Run a query, returning a failure instead of throwing. */
    tryQuery<T extends Indexable = Indexable>(query: string | IndexQuery): Result<T[], string>;
    /** Run a query, returning results plus metadata (revision, duration). */
    fullquery<T extends Indexable = Indexable>(query: string | IndexQuery): SearchResult<T>;
    /** Like `fullquery`, returning a failure instead of throwing. */
    tryFullQuery<T extends Indexable = Indexable>(query: string | IndexQuery): Result<SearchResult<T>, string>;
    /** Parse a query string; throws on invalid queries. */
    parseQuery(query: string | IndexQuery): IndexQuery;
    /** Parse a query string, returning a failure instead of throwing. */
    tryParseQuery(query: string | IndexQuery): Result<IndexQuery, string>;

    /** Evaluate an expression; throws on failure. */
    evaluate(expression: string | Expression, variables?: Record<string, Literal>, sourcePath?: string): Literal;
    /** Evaluate an expression, returning a failure instead of throwing. */
    tryEvaluate(
        expression: string | Expression,
        variables?: Record<string, Literal>,
        sourcePath?: string
    ): Result<Literal, string>;

    /** Resolve a link or (relative) path to an absolute vault path. */
    resolvePath(path: string | Link, sourcePath?: string): string;
    /** Create a link to a file. */
    fileLink(path: string): Link;
    /** Create a link to a header in a file. */
    headerLink(path: string, header: string): Link;
    /** Create a link to a block in a file. */
    blockLink(path: string, block: string): Link;
    /** Parse link text (`[[Note#Header|Display]]`); throws on invalid links. */
    parseLink(linktext: string): Link;
    /** Parse link text, returning a failure instead of throwing. */
    tryParseLink(linktext: string): Result<Link, string>;

    /** The engine's copy of luxon (create dates/durations with this so they match engine values). */
    readonly luxon: typeof import("luxon");
    /** Convert values into specific types. */
    readonly coerce: Coerce;
    /** Wrap an array (or `DataArray`) in the engine's chainable `DataArray`. */
    array<T>(input: T[] | DataArray<T>): DataArray<T>;
}

/** The query API scoped to a source file (relative links, `this` in expressions resolve against it). */
export interface DatacoreLocalQueryApi extends DatacoreQueryApi {
    /** The path of the file this API is scoped to. */
    readonly path: string;
    /** The path of the file this API is scoped to. */
    currentPath(): string;
    /** The page this API is scoped to, if it is an indexed markdown page. */
    currentFile<T extends MarkdownPage = MarkdownPage>(): T | undefined;
}

/** The engine API. */
export interface DatacoreApi extends DatacoreQueryApi {
    /** The API (contract) version this engine implements. */
    readonly apiVersion: string;
    /** The engine's own version (diagnostics only). */
    readonly engineVersion: string;
    /** Whether the engine supports an optional capability. */
    has(capability: Capability): boolean;

    /** True once the initial index has finished. */
    readonly initialized: boolean;
    /** The current index revision. Increases on every index change; see `subscribe` for the revision rule. */
    readonly revision: number;
    /** Resolves once the initial index has finished. */
    ready(): Promise<void>;
    /** A snapshot of engine state. */
    status(): EngineStatus;

    /** Load any indexed object by id. */
    load(id: string): Indexable | undefined;

    /**
     * Run a query now and again whenever its results change. The callback is called once immediately, then only when
     * the result set changes (compared by `$id` and `$revision`), debounced per `options`.
     *
     * Revision rule: every object stored at index revision N has `$revision === N`.
     */
    subscribe<T extends Indexable = Indexable>(
        query: string | IndexQuery,
        callback: (results: T[], meta: SubscriptionMeta) => void,
        options?: SubscribeOptions
    ): Disposable;
    /** Watch a single file's indexed object (undefined once deleted). Called immediately, then on changes. */
    watchFile(
        path: string,
        callback: (value: Indexable | undefined, meta: SubscriptionMeta) => void,
        options?: SubscribeOptions
    ): Disposable;
    /** Called with the new revision whenever the index changes (debounced per `options`). */
    onRevision(callback: (revision: number) => void, options?: SubscribeOptions): Disposable;

    /** A file was renamed and re-indexed. */
    on(event: "rename", callback: (newPath: string, oldPath: string) => void): Disposable;
    /** The initial index finished. */
    on(event: "initialized", callback: () => void): Disposable;
    /** Initial-index progress (periodically, and once on completion). */
    on(event: "index-progress", callback: (progress: IndexProgress) => void): Disposable;
    /** Display settings changed. */
    on(event: "display-settings", callback: (display: DisplaySettings) => void): Disposable;

    /** Shared presentation preferences (read-only). */
    readonly settings: { readonly display: DisplaySettings };

    /** A query API scoped to a source file. */
    local(sourcePath: string): DatacoreLocalQueryApi;

    /** Drop the index and cache and re-index the whole vault. */
    reindex(): Promise<void>;
}

/** The engine API as handed to one consumer: subscriptions are disposed when the consumer unloads. */
export interface ScopedDatacore extends DatacoreApi {
    /** The consumer this handle belongs to. */
    readonly consumer: ConsumerInfo;
    /** True once the engine unloaded; every call then throws a `DatacoreError` with code `revoked`. */
    readonly revoked: boolean;
    /** Called when this handle is revoked (the engine unloaded). */
    onRevoked(callback: () => void): Disposable;
    /** Dispose every subscription made through this handle. */
    disposeAll(): void;
}
