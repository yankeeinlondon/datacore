/**
 * Find the shared Datacore engine from any Obsidian plugin: `getDatacore()` waits for it (load order does not matter),
 * checks API compatibility, and returns a handle that stays usable across engine reloads.
 */
import {
    ENGINE_PLUGIN_ID,
    type ConsumerInfo,
    type Disposable,
    type EngineProvider,
    type ScopedDatacore,
} from "@yankeeinlondon/datacore-contract";
import { getOrCreateRegistry, onProviderEvent, whenProviderActive } from "@yankeeinlondon/datacore-shared";
import { datacoreError } from "./errors";
import { satisfiesApi } from "./version";

/**
 * Obsidian's `App`. Typed as any object because the part the client reads, `app.plugins` (installed and enabled
 * plugins), is not in Obsidian's public typings; a stricter type would reject `this.app`.
 */
export type AppLike = object;

/** The private `app.plugins` registry: installed manifests and enabled plugin ids. */
interface PluginRegistryLike {
    manifests?: Record<string, unknown>;
    enabledPlugins?: Set<string>;
}

/** Something that runs cleanup when it unloads (an Obsidian `Component` or `Plugin`). */
export interface ComponentLike {
    register(callback: () => unknown): void;
}

/** Who is asking: an Obsidian plugin (recommended), or an explicit id plus an optional owning component. */
export type ConsumerLike =
    | (ComponentLike & { manifest: { id: string; name?: string } })
    | { id: string; name?: string; component?: ComponentLike };

/** Options for `getDatacore()`. */
export interface GetDatacoreOptions {
    /** The plugin (or component + id) using the engine. Its unload disposes everything made through the handle. */
    consumer: ConsumerLike;
    /** The lowest API version this consumer supports (caret semantics). Default: accept any version. */
    minApi?: string;
    /** How long to wait for an engine that has not loaded yet, in milliseconds (default 10000). */
    timeoutMs?: number;
    /** Reconnect and replay subscriptions when the engine reloads (default true). */
    reconnect?: boolean;
    /** Where the registry lives (default: the main `window`). For tests. */
    host?: object;
}

/**
 * The engine handle `getDatacore()` returns: a `ScopedDatacore` that survives engine reloads. While the engine is
 * unloaded it is `revoked` (calls throw); when the engine comes back it reconnects and replays your subscriptions.
 */
export interface DatacoreHandle extends ScopedDatacore {
    /** Called after the handle reconnects to a reloaded engine (subscriptions are already replayed). */
    onReconnected(callback: () => void): Disposable;
}

/** Why the engine could not be obtained. */
export type GetDatacoreFailure = "not-installed" | "disabled" | "incompatible" | "timeout";

/** The outcome of `getDatacore()`. */
export type GetDatacoreResult =
    | { ok: true; engine: DatacoreHandle }
    | { ok: false; reason: GetDatacoreFailure; message: string };

const DEFAULT_TIMEOUT_MS = 10_000;
const TRACKED_METHODS = new Set<PropertyKey>(["subscribe", "watchFile", "onRevision", "on"]);

function consumerInfo(consumer: ConsumerLike): ConsumerInfo {
    return "manifest" in consumer
        ? { id: consumer.manifest.id, name: consumer.manifest.name }
        : { id: consumer.id, name: consumer.name };
}

function consumerComponent(consumer: ConsumerLike): ComponentLike | undefined {
    return "manifest" in consumer ? consumer : consumer.component;
}

/** Fail fast when Obsidian already knows the engine plugin is missing or disabled. */
function installationProblem(app: AppLike): { reason: GetDatacoreFailure; message: string } | undefined {
    const plugins = (app as { plugins?: PluginRegistryLike }).plugins;
    if (!plugins?.manifests) return undefined;
    if (!(ENGINE_PLUGIN_ID in plugins.manifests)) {
        return { reason: "not-installed", message: `The '${ENGINE_PLUGIN_ID}' plugin is not installed.` };
    }
    if (plugins.enabledPlugins && !plugins.enabledPlugins.has(ENGINE_PLUGIN_ID)) {
        return { reason: "disabled", message: `The '${ENGINE_PLUGIN_ID}' plugin is installed but not enabled.` };
    }
    return undefined;
}

function compatibility(provider: EngineProvider, minApi: string | undefined) {
    if (minApi === undefined || satisfiesApi(provider.apiVersion, minApi)) return undefined;
    return {
        reason: "incompatible" as const,
        message: `Datacore engine API ${provider.apiVersion} does not satisfy the required ^${minApi}.`,
    };
}

/** A subscription made through the client handle, replayed onto each new engine connection. */
interface Replayable {
    method: PropertyKey;
    args: unknown[];
    current: Disposable | undefined;
}

/**
 * A handle that forwards to the engine's scoped handle for the active provider and reconnects when the engine
 * reloads, replaying the consumer's subscriptions so they keep working.
 */
function reconnectingHandle(
    host: object,
    initial: EngineProvider,
    info: ConsumerInfo,
    options: Pick<GetDatacoreOptions, "minApi" | "reconnect">
): { handle: DatacoreHandle; dispose: () => void } {
    const registry = getOrCreateRegistry(host);
    const replayables = new Set<Replayable>();
    const revokedListeners = new Set<() => void>();
    const reconnectedListeners = new Set<() => void>();
    let provider: EngineProvider | undefined = initial;
    let inner: ScopedDatacore | undefined = initial.connect(info);

    const attach = (next: EngineProvider) => {
        if (compatibility(next, options.minApi)) return; // stay disconnected rather than talk to an incompatible engine
        provider = next;
        inner = next.connect(info);
        for (const replayable of replayables) {
            const method = (inner as unknown as Record<PropertyKey, (...args: unknown[]) => Disposable>)[
                replayable.method
            ]!;
            replayable.current = method.apply(inner, replayable.args);
        }
        for (const listener of Array.from(reconnectedListeners)) listener();
    };

    const stopListening = onProviderEvent(registry, (event) => {
        if (event.type === "deactivating" && event.provider === provider) {
            inner = undefined;
            provider = undefined;
            for (const replayable of replayables) replayable.current = undefined; // the engine revokes these
            for (const listener of Array.from(revokedListeners)) listener();
        } else if (event.type === "activated" && inner === undefined && options.reconnect !== false) {
            attach(event.provider);
        }
    });

    const live = (): ScopedDatacore => {
        if (!inner) throw datacoreError("revoked", `The Datacore engine is not available (consumer '${info.id}').`);
        return inner;
    };

    const extras: Partial<Record<keyof DatacoreHandle, unknown>> = {
        consumer: info,
        onRevoked: (callback: () => void): Disposable => {
            revokedListeners.add(callback);
            return { dispose: () => revokedListeners.delete(callback) };
        },
        onReconnected: (callback: () => void): Disposable => {
            reconnectedListeners.add(callback);
            return { dispose: () => reconnectedListeners.delete(callback) };
        },
        disposeAll: () => {
            for (const replayable of Array.from(replayables)) {
                replayable.current?.dispose();
                replayables.delete(replayable);
            }
        },
    };

    const handle = new Proxy({} as DatacoreHandle, {
        get(_target, property) {
            if (property === "revoked") return inner === undefined;
            if (property in extras) return extras[property as keyof typeof extras];

            const target = live();
            const value = Reflect.get(target, property);
            if (typeof value !== "function") return value;
            if (!TRACKED_METHODS.has(property)) return value.bind(target);

            return (...args: unknown[]): Disposable => {
                const replayable: Replayable = {
                    method: property,
                    args,
                    current: (value as (...a: unknown[]) => Disposable).apply(live(), args),
                };
                replayables.add(replayable);
                return {
                    dispose: () => {
                        replayables.delete(replayable);
                        replayable.current?.dispose();
                        replayable.current = undefined;
                    },
                };
            };
        },
    });

    return {
        handle,
        dispose: () => {
            (extras.disposeAll as () => void)();
            stopListening();
            revokedListeners.clear();
            reconnectedListeners.clear();
        },
    };
}

/** Wrap a provider for a consumer, tying cleanup to the consumer's unload. */
function connectConsumer(host: object, provider: EngineProvider, options: GetDatacoreOptions): DatacoreHandle {
    const { handle, dispose } = reconnectingHandle(host, provider, consumerInfo(options.consumer), options);
    consumerComponent(options.consumer)?.register(dispose);
    return handle;
}

/**
 * Get the shared Datacore engine. Resolves once the engine is available (it may load after your plugin), or with a
 * failure reason: `not-installed`, `disabled`, `incompatible` (engine API older/newer than `minApi`), or `timeout`.
 *
 * ```ts
 * const result = await getDatacore(this.app, { consumer: this, minApi: "1.0" });
 * if (!result.ok) return new Notice(`My Plugin needs Datacore Engine (${result.reason}).`);
 * const books = result.engine.query("@page and #book");
 * ```
 */
export function getDatacore(app: AppLike, options: GetDatacoreOptions): Promise<GetDatacoreResult> {
    const host = options.host ?? window;
    const registry = getOrCreateRegistry(host);

    const settle = (provider: EngineProvider): GetDatacoreResult => {
        const problem = compatibility(provider, options.minApi);
        return problem ? { ok: false, ...problem } : { ok: true, engine: connectConsumer(host, provider, options) };
    };

    if (registry.active) return Promise.resolve(settle(registry.active));

    const problem = installationProblem(app);
    if (problem) return Promise.resolve({ ok: false, ...problem });

    return new Promise((resolve) => {
        const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        let timer: number | undefined;
        const cancel = whenProviderActive(registry, (provider) => {
            if (timer !== undefined) window.clearTimeout(timer);
            resolve(settle(provider));
        });
        timer = window.setTimeout(() => {
            cancel();
            resolve({
                ok: false,
                reason: "timeout",
                message: `The Datacore engine did not become available within ${timeoutMs} ms.`,
            });
        }, timeoutMs);
    });
}

/** Get the engine synchronously if it is already active and compatible; otherwise `undefined`. */
export function tryGetDatacore(options: GetDatacoreOptions): DatacoreHandle | undefined {
    const host = options.host ?? window;
    const active = getOrCreateRegistry(host).active;
    if (!active || compatibility(active, options.minApi)) return undefined;
    return connectConsumer(host, active, options);
}
