/**
 * Publishes the engine to other plugins: registers it as the `host` provider in the shared registry, hands out
 * consumer-scoped API handles, defines `window.dc`, and revokes everything on unload (Engine Room spec, §7.2, §8.5).
 */
import type * as Contract from "@yankeeinlondon/datacore-contract";
import { version as CONTRACT_VERSION } from "@yankeeinlondon/datacore-contract/package.json";
import { getOrCreateRegistry, registerProvider, unregisterProvider } from "@yankeeinlondon/datacore-shared";
import { Datacore } from "index/datacore";
import { EngineApi } from "./engine-api";
import { DatacoreError } from "./errors";

/** The contract version this engine was built against (stamped from the contract package at build time). */
export const API_VERSION: string = CONTRACT_VERSION;

/** Priority of the host plugin; an embedded fallback (option C) would register lower. */
const HOST_PRIORITY = 100;

/** API members that create subscriptions or listeners; scoped handles track what these return. */
const TRACKED_METHODS = new Set<PropertyKey>(["subscribe", "watchFile", "onRevision", "on"]);

/** Members a scoped handle adds on top of the engine API. */
interface ScopeState {
    readonly consumer: Contract.ConsumerInfo;
    revoked: boolean;
    readonly disposables: Set<Contract.Disposable>;
    readonly revokedListeners: Set<() => void>;
}

/**
 * Wrap the engine API for one consumer: subscriptions made through the handle are tracked (so `disposeAll()` and
 * revocation clean up exactly that consumer's work), and every member throws a `revoked` error once the engine unloads.
 */
function scope(api: EngineApi, state: ScopeState, onRelease: () => void): Contract.ScopedDatacore {
    const ensureLive = () => {
        if (state.revoked) {
            throw new DatacoreError(
                "revoked",
                `Datacore engine unloaded; this handle (${state.consumer.id}) is revoked.`
            );
        }
    };

    const extras: Partial<Record<keyof Contract.ScopedDatacore, unknown>> = {
        consumer: state.consumer,
        onRevoked: (callback: () => void): Contract.Disposable => {
            state.revokedListeners.add(callback);
            return { dispose: () => state.revokedListeners.delete(callback) };
        },
        disposeAll: () => {
            for (const disposable of Array.from(state.disposables)) disposable.dispose();
        },
        release: () => {
            if (state.revoked) return;
            for (const disposable of Array.from(state.disposables)) disposable.dispose();
            state.revoked = true;
            state.revokedListeners.clear();
            onRelease();
        },
    };

    return new Proxy(api, {
        get(target, property, receiver) {
            if (property === "revoked") return state.revoked;
            if (property in extras) return extras[property as keyof typeof extras];
            ensureLive();

            const value = Reflect.get(target, property, receiver);
            if (typeof value !== "function") return value;
            if (!TRACKED_METHODS.has(property)) return value.bind(target);

            return (...args: unknown[]) => {
                ensureLive();
                const inner = (value as (...a: unknown[]) => Contract.Disposable).apply(target, args);
                const tracked: Contract.Disposable = {
                    dispose: () => {
                        state.disposables.delete(tracked);
                        inner.dispose();
                    },
                };
                state.disposables.add(tracked);
                return tracked;
            };
        },
    }) as unknown as Contract.ScopedDatacore;
}

/** Options for starting the engine host. */
export interface EngineHostOptions {
    /** The object holding the registry and `dc` global: the main `window` in Obsidian. */
    host: object;
    /** The engine plugin's id (from its manifest). */
    pluginId: string;
    /** The engine plugin's version (from its manifest). */
    engineVersion: string;
}

/** Runs the engine's side of the registry protocol for one engine instance. */
export class EngineHost {
    readonly api: EngineApi;
    private readonly handles = new Set<ScopeState>();
    private provider: Contract.EngineProvider | undefined;
    /** The getter installed as `dc`, if we installed it (so we only ever remove our own). */
    private dcGetter: (() => Contract.DatacoreApi) | undefined;

    constructor(
        core: Datacore,
        private readonly options: EngineHostOptions
    ) {
        this.api = new EngineApi(core, { apiVersion: API_VERSION, engineVersion: options.engineVersion });
    }

    /** Register as the host provider and publish `window.dc`. */
    start(): void {
        if (this.provider) return;
        const api = this.api;
        this.provider = {
            kind: "host",
            priority: HOST_PRIORITY,
            pluginId: this.options.pluginId,
            engineVersion: this.options.engineVersion,
            apiVersion: API_VERSION,
            capabilities: new Set(
                (["query", "subscribe", "write", "functions"] as Contract.Capability[]).filter((c) => api.has(c))
            ),
            connect: (consumer) => this.connect(consumer),
        };
        registerProvider(getOrCreateRegistry(this.options.host), this.provider);
        this.defineGlobal();
    }

    /** Unregister, revoke every handle, remove `window.dc`, and dispose all engine subscriptions. */
    stop(): void {
        if (!this.provider) return;
        // Consumers hear `deactivating` while the engine is still usable, then their handles are revoked.
        unregisterProvider(getOrCreateRegistry(this.options.host), this.provider);
        this.provider = undefined;

        for (const state of Array.from(this.handles)) {
            for (const disposable of Array.from(state.disposables)) disposable.dispose();
            state.revoked = true;
            for (const listener of Array.from(state.revokedListeners)) listener();
            state.revokedListeners.clear();
        }
        this.handles.clear();
        this.removeGlobal();
        this.api.disposeAll();
    }

    private connect(consumer: Contract.ConsumerInfo): Contract.ScopedDatacore {
        const state: ScopeState = {
            consumer,
            revoked: false,
            disposables: new Set(),
            revokedListeners: new Set(),
        };
        this.handles.add(state);
        return scope(this.api, state, () => this.handles.delete(state));
    }

    /** The consumers with a live (not released or revoked) handle, in connection order. */
    consumers(): Contract.ConsumerInfo[] {
        return Array.from(this.handles, (state) => state.consumer);
    }

    /** Define `dc` on the host as a read-only getter, unless something else already owns that name. */
    private defineGlobal(): void {
        const host = this.options.host;
        if (Object.prototype.hasOwnProperty.call(host, "dc") || "dc" in host) {
            console.warn("Datacore: 'window.dc' is already defined by something else; not overriding it.");
            return;
        }
        const getter = () => this.api;
        Object.defineProperty(host, "dc", { get: getter, configurable: true, enumerable: false });
        this.dcGetter = getter;
    }

    /** Remove `dc` only if it is still the getter we installed. */
    private removeGlobal(): void {
        if (!this.dcGetter) return;
        const descriptor = Object.getOwnPropertyDescriptor(this.options.host, "dc");
        if (descriptor?.get === this.dcGetter) delete (this.options.host as { dc?: unknown }).dc;
        this.dcGetter = undefined;
    }
}
