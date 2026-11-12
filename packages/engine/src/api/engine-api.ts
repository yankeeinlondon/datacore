/** The engine's implementation of the contract API (`DatacoreApi`), independent of any UI. */
import type * as Contract from "@yankeeinlondon/datacore-contract";
import { CAPABILITIES } from "@yankeeinlondon/datacore-contract";
import { Expression } from "expression/expression";
import { Link } from "expression/link";
import { Literal } from "expression/literal";
import { Datacore } from "index/datacore";
import { IndexQuery } from "index/types/index-query";
import { Indexable } from "index/types/indexable";
import { MarkdownPage } from "index/types/markdown";
import type { EventRef } from "obsidian";
import { Settings } from "settings";
import { DatacoreError } from "./errors";
import { QueryApi } from "./query-api";
import { Result } from "./result";

/** Default debounce for reactive callbacks, matching the UI hooks' historical default. */
export const DEFAULT_DEBOUNCE_MS = 500;

/** Capabilities advertised by API 1.0 (write and functions are reserved for later minor versions). */
const ENGINE_CAPABILITIES: ReadonlySet<Contract.Capability> = new Set([CAPABILITIES.query, CAPABILITIES.subscribe]);

/** Versions reported by the engine. */
export interface EngineVersions {
    /** The contract version this engine implements. */
    apiVersion: string;
    /** The engine's own version. */
    engineVersion: string;
}

/** The contract's shared display settings, from the engine's settings (a copy, so callers cannot mutate them). */
export function displaySettings(settings: Settings): Contract.DisplaySettings {
    return { ...settings.display };
}

/** Change-detection key for a result set: object identity plus the revision each object was stored at. */
function signature(objects: readonly Indexable[]): string {
    return objects.map((object) => `${object.$id}@${object.$revision ?? ""}`).join("|");
}

/** The query API scoped to a source file: relative paths and `this` resolve against it. */
export class LocalQueryApi extends QueryApi implements Contract.DatacoreLocalQueryApi {
    public constructor(
        core: Datacore,
        public readonly path: string
    ) {
        super(core);
    }

    public currentPath(): string {
        return this.path;
    }

    public currentFile<T extends Contract.MarkdownPage = Contract.MarkdownPage>(): T | undefined {
        return this.page<MarkdownPage>(this.path) as Contract.MarkdownPage | undefined as T | undefined;
    }

    public override resolvePath(path: string | Link, sourcePath?: string): string {
        return super.resolvePath(path, sourcePath ?? this.path);
    }

    public override resolveLink(link: string | Link, sourcePath?: string): Contract.Indexable | undefined {
        return super.resolveLink(link, sourcePath ?? this.path);
    }

    public override tryEvaluate(
        expression: string | Expression,
        variables?: Record<string, Literal>,
        sourcePath?: string
    ): Result<Literal, string> {
        return super.tryEvaluate(expression, variables, sourcePath ?? this.path);
    }
}

/** The engine API: queries plus lifecycle, status, reactivity, events and shared settings. */
export class EngineApi extends QueryApi implements Contract.DatacoreApi {
    public readonly apiVersion: string;
    public readonly engineVersion: string;

    /** Live subscriptions and listeners, disposed together when the engine unloads. */
    private readonly disposables = new Set<Contract.Disposable>();
    /** Latest initial-index progress. */
    private progress: Contract.IndexProgress = { initialized: 0, total: 0 };
    /** Query results shared by subscriptions to the same query within one revision. */
    private sharedResults: { revision: number; byQuery: Map<string, Result<Indexable[], string>> } = {
        revision: -1,
        byQuery: new Map(),
    };
    private readonly progressRef: EventRef;

    public constructor(core: Datacore, versions: EngineVersions) {
        super(core);
        this.apiVersion = versions.apiVersion;
        this.engineVersion = versions.engineVersion;
        this.progressRef = core.on("index-progress", (progress) => (this.progress = progress));
    }

    public has(capability: Contract.Capability): boolean {
        return ENGINE_CAPABILITIES.has(capability);
    }

    public get initialized(): boolean {
        return this.core.initialized;
    }

    public get revision(): number {
        return this.core.revision;
    }

    public ready(): Promise<void> {
        if (this.core.initialized) return Promise.resolve();
        return new Promise((resolve) => {
            const ref = this.core.on("initialized", () => {
                this.core.offref(ref);
                resolve();
            });
        });
    }

    public status(): Contract.EngineStatus {
        const progress = this.core.initializer?.progress() ?? this.progress;
        return {
            initialized: this.core.initialized,
            revision: this.core.revision,
            progress: { ...progress },
            objects: this.core.datastore.size,
        };
    }

    public load(id: string): Indexable | undefined {
        return this.core.datastore.load(id) as Indexable | undefined;
    }

    public subscribe<T extends Contract.Indexable = Contract.Indexable>(
        query: string | IndexQuery,
        callback: (results: T[], meta: Contract.SubscriptionMeta) => void,
        options: Contract.SubscribeOptions = {}
    ): Contract.Disposable {
        const parsed = this.tryParseQuery(query);
        if (!parsed.successful) throw new DatacoreError("invalid-query", `Failed to parse query: ${parsed.error}`);
        // Only textual queries are shared; structured queries are evaluated per subscription.
        const shareKey = typeof query === "string" ? query : undefined;

        let lastSignature: string | undefined;
        const run = (initial: boolean) => {
            const result = this.sharedSearch(shareKey, parsed.value);
            if (!result.successful) {
                console.warn(`Datacore: subscription query failed: ${result.error}`);
                return;
            }
            const next = signature(result.value);
            if (!initial && next === lastSignature) return;
            lastSignature = next;
            callback(result.value as Contract.Indexable[] as T[], { revision: this.core.revision, initial });
        };

        run(true);
        return this.onIndexChange(() => run(false), options.debounce);
    }

    public watchFile(
        path: string,
        callback: (value: Indexable | undefined, meta: Contract.SubscriptionMeta) => void,
        options: Contract.SubscribeOptions = {}
    ): Contract.Disposable {
        let lastSignature: string | undefined;
        const run = (initial: boolean) => {
            const value = this.load(path);
            const next = value ? signature([value]) : "";
            if (!initial && next === lastSignature) return;
            lastSignature = next;
            callback(value, { revision: this.core.revision, initial });
        };

        run(true);
        return this.onIndexChange(() => run(false), options.debounce);
    }

    public onRevision(
        callback: (revision: number) => void,
        options: Contract.SubscribeOptions = {}
    ): Contract.Disposable {
        return this.onIndexChange(() => callback(this.core.revision), options.debounce);
    }

    public on(event: "rename", callback: (newPath: string, oldPath: string) => void): Contract.Disposable;
    public on(event: "initialized", callback: () => void): Contract.Disposable;
    public on(event: "index-progress", callback: (progress: Contract.IndexProgress) => void): Contract.Disposable;
    public on(event: "display-settings", callback: (display: Contract.DisplaySettings) => void): Contract.Disposable;
    public on(event: string, callback: (...args: never[]) => void): Contract.Disposable {
        const ref = this.core.on(event as "rename", callback as (newPath: string, oldPath: string) => void);
        return this.track(() => this.core.offref(ref));
    }

    public get settings(): { readonly display: Contract.DisplaySettings } {
        const core = this.core;
        return {
            get display() {
                return displaySettings(core.settings);
            },
        };
    }

    public local(sourcePath: string): LocalQueryApi {
        return new LocalQueryApi(this.core, sourcePath);
    }

    public reindex(): Promise<void> {
        return this.core.reindex();
    }

    /** Dispose every subscription and listener created through this API (called when the engine unloads). */
    public disposeAll(): void {
        for (const disposable of [...this.disposables]) disposable.dispose();
        this.core.offref(this.progressRef);
    }

    /** Run `listener` after index changes, debounced (`0` = synchronously on every change). */
    private onIndexChange(listener: () => void, debounceMs: number = DEFAULT_DEBOUNCE_MS): Contract.Disposable {
        let timer: number | undefined;
        const ref = this.core.on("update", () => {
            if (debounceMs <= 0) return listener();
            if (timer !== undefined) window.clearTimeout(timer);
            timer = window.setTimeout(() => {
                timer = undefined;
                listener();
            }, debounceMs);
        });

        return this.track(() => {
            if (timer !== undefined) window.clearTimeout(timer);
            this.core.offref(ref);
        });
    }

    /** Register a cleanup as a tracked disposable (idempotent). */
    private track(cleanup: () => void): Contract.Disposable {
        let disposed = false;
        const disposable: Contract.Disposable = {
            dispose: () => {
                if (disposed) return;
                disposed = true;
                this.disposables.delete(disposable);
                cleanup();
            },
        };
        this.disposables.add(disposable);
        return disposable;
    }

    /** Search, sharing results between identical textual queries within a revision. */
    private sharedSearch(shareKey: string | undefined, query: IndexQuery): Result<Indexable[], string> {
        const compute = () => this.core.datastore.search(query).map((result) => result.results);
        if (shareKey === undefined) return compute();

        if (this.sharedResults.revision !== this.core.revision) {
            this.sharedResults = { revision: this.core.revision, byQuery: new Map() };
        }
        const cached = this.sharedResults.byQuery.get(shareKey);
        if (cached) return cached;

        const result = compute();
        this.sharedResults.byQuery.set(shareKey, result);
        return result;
    }
}
