/** The runtime rendezvous between the engine plugin and its consumers (see the Engine Room spec, §7.2). */
import type { ConsumerInfo, ScopedDatacore } from "./api";
import type { Capability, REGISTRY_PROTOCOL_VERSION } from "./constants";

/** An engine able to serve consumers. */
export interface EngineProvider {
    /** `host` is the engine plugin; `embedded` is reserved for a future bundled fallback. */
    readonly kind: "host" | "embedded";
    /** Higher wins when several providers are registered (host = 100). */
    readonly priority: number;
    /** The plugin that registered this provider. */
    readonly pluginId: string;
    /** The engine's own version. */
    readonly engineVersion: string;
    /** The contract version the engine implements. */
    readonly apiVersion: string;
    /** Optional capabilities the engine supports. */
    readonly capabilities: ReadonlySet<Capability>;
    /** Hand out an API handle scoped to one consumer. */
    connect(consumer: ConsumerInfo): ScopedDatacore;
}

/** Notifications about the active provider. */
export type ProviderEvent =
    | { readonly type: "activated"; readonly provider: EngineProvider }
    | { readonly type: "deactivating"; readonly provider: EngineProvider };

/**
 * The registry object at `window[Symbol.for(ENGINE_REGISTRY_KEY)]`. Engine and clients both get-or-create it, so
 * plugin load order does not matter.
 */
export interface EngineRegistry {
    /** Version of this object's shape. */
    readonly protocol: typeof REGISTRY_PROTOCOL_VERSION;
    /** All registered providers. */
    readonly providers: EngineProvider[];
    /** The provider currently serving consumers. */
    active?: EngineProvider;
    /** Callbacks waiting for a provider to become active (drained on activation). */
    readonly waiters: Set<(provider: EngineProvider) => void>;
    /** Listeners for provider changes. */
    readonly listeners: Set<(event: ProviderEvent) => void>;
}
