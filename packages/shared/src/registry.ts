/**
 * Operations on the shared engine registry (`window[Symbol.for(ENGINE_REGISTRY_KEY)]`).
 *
 * Plain functions over the registry object: no module state, so each plugin bundle can carry its own copy and they
 * still cooperate through the one registry object. Used by the engine (to register as a provider) and by the client
 * (to find and wait for one). See the Engine Room spec, §7.2.
 */
import {
    ENGINE_REGISTRY_KEY,
    REGISTRY_PROTOCOL_VERSION,
    type EngineProvider,
    type EngineRegistry,
    type ProviderEvent,
} from "@yankeeinlondon/datacore-contract";

/** Something that can hold the registry: the main `window` in Obsidian, or any object in tests. */
export type RegistryHost = object;

/** Get the registry from its host, creating it if no plugin has yet. Load order does not matter. */
export function getOrCreateRegistry(host: RegistryHost): EngineRegistry {
    const key = Symbol.for(ENGINE_REGISTRY_KEY);
    const slots = host as Record<symbol, EngineRegistry | undefined>;
    const existing = slots[key];
    if (existing) return existing;

    const registry: EngineRegistry = {
        protocol: REGISTRY_PROTOCOL_VERSION,
        providers: [],
        active: undefined,
        waiters: new Set(),
        listeners: new Set(),
    };
    Object.defineProperty(host, key, { value: registry, configurable: true, enumerable: false, writable: false });
    return registry;
}

/** The provider that should be active: highest priority, earliest registered on ties. */
function selectActive(providers: readonly EngineProvider[]): EngineProvider | undefined {
    let best: EngineProvider | undefined;
    for (const provider of providers) if (!best || provider.priority > best.priority) best = provider;
    return best;
}

function emit(registry: EngineRegistry, event: ProviderEvent): void {
    for (const listener of Array.from(registry.listeners)) listener(event);
}

/** Make `next` active (if it differs), notifying listeners and draining waiters. */
function activate(registry: EngineRegistry, next: EngineProvider | undefined): void {
    if (registry.active === next) return;
    registry.active = next;
    if (!next) return;

    emit(registry, { type: "activated", provider: next });
    const waiters = Array.from(registry.waiters);
    registry.waiters.clear();
    for (const waiter of waiters) waiter(next);
}

/** Register a provider; it becomes active if it has the highest priority. */
export function registerProvider(registry: EngineRegistry, provider: EngineProvider): void {
    if (!registry.providers.includes(provider)) registry.providers.push(provider);
    activate(registry, selectActive(registry.providers));
}

/**
 * Remove a provider. If it was active, listeners hear `deactivating` first (while it is still usable), then the next
 * best provider (if any) is activated.
 */
export function unregisterProvider(registry: EngineRegistry, provider: EngineProvider): void {
    const index = registry.providers.indexOf(provider);
    if (index === -1) return;

    if (registry.active === provider) emit(registry, { type: "deactivating", provider });
    registry.providers.splice(index, 1);
    if (registry.active === provider) registry.active = undefined;
    activate(registry, selectActive(registry.providers));
}

/**
 * Call `callback` with the active provider now, or as soon as one activates. Returns a function that cancels the wait.
 */
export function whenProviderActive(registry: EngineRegistry, callback: (provider: EngineProvider) => void): () => void {
    if (registry.active) {
        callback(registry.active);
        return () => {};
    }
    registry.waiters.add(callback);
    return () => registry.waiters.delete(callback);
}

/** Listen for provider events. Returns a function that stops listening. */
export function onProviderEvent(registry: EngineRegistry, listener: (event: ProviderEvent) => void): () => void {
    registry.listeners.add(listener);
    return () => registry.listeners.delete(listener);
}
