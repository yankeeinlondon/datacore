import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineRegistry, ProviderEvent, ScopedDatacore } from "@yankeeinlondon/datacore-contract";
import { version as CONTRACT_VERSION } from "@yankeeinlondon/datacore-contract/package.json";
import { getOrCreateRegistry, onProviderEvent, whenProviderActive } from "@yankeeinlondon/datacore-shared";
import { EngineHost } from "api/engine-host";
import { note } from "test/fixtures/note-builder";
import { createTestEngine, TestEngine } from "test/fixtures/test-engine";

let engine: TestEngine;
let window_: Record<PropertyKey, unknown>;
let registry: EngineRegistry;
let host: EngineHost;

const connect = (id = "consumer-plugin"): ScopedDatacore => registry.active!.connect({ id });

beforeEach(async () => {
    engine = await createTestEngine({ notes: [note("Books/Dune.md").paragraph("#book")] });
    window_ = {};
    registry = getOrCreateRegistry(window_);
    host = new EngineHost(engine.core, { host: window_, pluginId: "datacore-engine", engineVersion: "0.1.0" });
});

afterEach(() => {
    host.stop();
    engine.dispose();
    vi.restoreAllMocks();
});

describe("EngineHost: registration", () => {
    it("registers as the active host provider with the contract's API version", () => {
        host.start();
        expect(registry.active?.kind).toBe("host");
        expect(registry.active?.pluginId).toBe("datacore-engine");
        expect(registry.active?.apiVersion).toBe(CONTRACT_VERSION);
        expect([...registry.active!.capabilities].sort()).toEqual(["query", "subscribe"]);
    });

    it("serves a consumer that started waiting before the engine loaded", () => {
        const received: ScopedDatacore[] = [];
        whenProviderActive(registry, (provider) => received.push(provider.connect({ id: "early" })));
        host.start();

        expect(received).toHaveLength(1);
        expect(received[0]!.query("@page and #book")).toHaveLength(1);
        expect(received[0]!.consumer.id).toBe("early");
    });
});

describe("EngineHost: window.dc", () => {
    it("exposes the engine API as a read-only, non-enumerable getter and removes it on stop", () => {
        host.start();
        expect(window_["dc"]).toBe(host.api);
        expect(Object.keys(window_)).not.toContain("dc");

        host.stop();
        expect("dc" in window_).toBe(false);
    });

    it("never overwrites a foreign window.dc", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const foreign = { chart: true };
        window_["dc"] = foreign;

        host.start();
        expect(window_["dc"]).toBe(foreign);
        expect(warn).toHaveBeenCalled();

        host.stop();
        expect(window_["dc"]).toBe(foreign);
    });
});

describe("EngineHost: scoped handles", () => {
    it("disposes only the calling consumer's subscriptions with disposeAll()", async () => {
        host.start();
        const first = connect("first");
        const second = connect("second");
        const firstCallback = vi.fn();
        const secondCallback = vi.fn();
        first.subscribe("@page", firstCallback, { debounce: 0 });
        second.subscribe("@page", secondCallback, { debounce: 0 });

        first.disposeAll();
        await engine.write(note("Books/Dune.md").paragraph("#book updated"));

        expect(firstCallback).toHaveBeenCalledTimes(1); // initial only
        expect(secondCallback).toHaveBeenCalledTimes(2);
    });

    it("release() disposes the handle's subscriptions and drops it from consumers()", async () => {
        host.start();
        const first = connect("first");
        connect("second");
        const callback = vi.fn();
        first.subscribe("@page", callback, { debounce: 0 });
        expect(host.consumers().map((consumer) => consumer.id)).toEqual(["first", "second"]);

        first.release();
        first.release(); // idempotent
        expect(first.revoked).toBe(true);
        expect(() => first.query("@page")).toThrowError(expect.objectContaining({ code: "revoked" }));
        expect(host.consumers().map((consumer) => consumer.id)).toEqual(["second"]);

        await engine.write(note("Books/Dune.md").paragraph("#book updated"));
        expect(callback).toHaveBeenCalledTimes(1); // initial only
    });

    it("announces deactivation while still usable, then revokes handles on stop", async () => {
        host.start();
        const handle = connect();
        const subscription = vi.fn();
        handle.subscribe("@page", subscription, { debounce: 0 });
        const revoked = vi.fn();
        handle.onRevoked(revoked);

        const seenDuringDeactivation: number[] = [];
        onProviderEvent(registry, (event: ProviderEvent) => {
            if (event.type === "deactivating") seenDuringDeactivation.push(handle.revision);
        });

        host.stop();

        expect(seenDuringDeactivation).toHaveLength(1);
        expect(handle.revoked).toBe(true);
        expect(revoked).toHaveBeenCalledTimes(1);
        expect(() => handle.query("@page")).toThrowError(expect.objectContaining({ code: "revoked" }));
        expect(registry.active).toBeUndefined();

        await engine.write(note("Books/Dune.md").paragraph("#book updated"));
        expect(subscription).toHaveBeenCalledTimes(1); // the revoked subscription no longer fires
    });

    it("serves new handles after a restart while old handles stay revoked", () => {
        host.start();
        const old = connect();
        host.stop();
        host.start();

        expect(old.revoked).toBe(true);
        expect(connect().query("@page")).toHaveLength(1);
    });
});
