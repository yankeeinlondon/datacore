import { describe, expect, it } from "vitest";
import { ENGINE_REGISTRY_KEY, type EngineProvider, type ProviderEvent } from "@yankeeinlondon/datacore-contract";
import {
    getOrCreateRegistry,
    onProviderEvent,
    registerProvider,
    unregisterProvider,
    whenProviderActive,
} from "./registry";

function provider(pluginId: string, priority = 100): EngineProvider {
    return {
        kind: "host",
        priority,
        pluginId,
        engineVersion: "1.0.0",
        apiVersion: "1.0.0",
        capabilities: new Set(),
        connect: () => {
            throw new Error("not used");
        },
    };
}

describe("engine registry", () => {
    it("creates the registry once per host, under the protocol symbol", () => {
        const host = {};
        const registry = getOrCreateRegistry(host);
        expect(getOrCreateRegistry(host)).toBe(registry);
        expect((host as Record<symbol, unknown>)[Symbol.for(ENGINE_REGISTRY_KEY)]).toBe(registry);
        expect(Object.keys(host)).toEqual([]); // not enumerable
        expect(registry.protocol).toBe(1);
    });

    it("hands a waiting consumer the provider when it registers (consumer loads first)", () => {
        const registry = getOrCreateRegistry({});
        const received: string[] = [];
        whenProviderActive(registry, (active) => received.push(active.pluginId));
        expect(received).toEqual([]);

        registerProvider(registry, provider("engine"));
        expect(received).toEqual(["engine"]);
        expect(registry.waiters.size).toBe(0);
    });

    it("answers immediately when a provider is already active (engine loads first)", () => {
        const registry = getOrCreateRegistry({});
        registerProvider(registry, provider("engine"));
        const received: string[] = [];
        whenProviderActive(registry, (active) => received.push(active.pluginId));
        expect(received).toEqual(["engine"]);
    });

    it("can cancel a wait", () => {
        const registry = getOrCreateRegistry({});
        const received: string[] = [];
        const cancel = whenProviderActive(registry, (active) => received.push(active.pluginId));
        cancel();
        registerProvider(registry, provider("engine"));
        expect(received).toEqual([]);
    });

    it("activates the highest-priority provider and falls back when it leaves", () => {
        const registry = getOrCreateRegistry({});
        const events: string[] = [];
        onProviderEvent(registry, (event: ProviderEvent) => events.push(`${event.type}:${event.provider.pluginId}`));

        const embedded = provider("embedded", 10);
        const host = provider("host", 100);
        registerProvider(registry, embedded);
        registerProvider(registry, host);
        expect(registry.active).toBe(host);

        unregisterProvider(registry, host);
        expect(registry.active).toBe(embedded);
        expect(events).toEqual(["activated:embedded", "activated:host", "deactivating:host", "activated:embedded"]);
    });

    it("leaves no active provider when the last one unregisters", () => {
        const registry = getOrCreateRegistry({});
        const host = provider("host");
        registerProvider(registry, host);
        unregisterProvider(registry, host);
        expect(registry.active).toBeUndefined();
        expect(registry.providers).toEqual([]);
    });
});
