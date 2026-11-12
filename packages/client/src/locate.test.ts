import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConsumerInfo, Disposable, EngineProvider, ScopedDatacore } from "@yankeeinlondon/datacore-contract";
import { getOrCreateRegistry, registerProvider, unregisterProvider } from "@yankeeinlondon/datacore-shared";
import { getDatacore, tryGetDatacore, type AppLike, type ComponentLike, type DatacoreHandle } from "./locate";

/** A stand-in engine: records connections and live subscriptions. */
class FakeEngine {
    readonly connections: ConsumerInfo[] = [];
    readonly subscriptions = new Set<string>();
    readonly provider: EngineProvider;

    constructor(
        readonly name: string,
        apiVersion = "1.0.0"
    ) {
        this.provider = {
            kind: "host",
            priority: 100,
            pluginId: "datacore-engine",
            engineVersion: "1.0.0",
            apiVersion,
            capabilities: new Set(["query", "subscribe"]),
            connect: (consumer) => {
                this.connections.push(consumer);
                return this.handle();
            },
        };
    }

    private handle(): ScopedDatacore {
        return {
            query: (query: string) => [`${this.name}:${query}`],
            subscribe: (query: string): Disposable => {
                this.subscriptions.add(query);
                return { dispose: () => this.subscriptions.delete(query) };
            },
        } as unknown as ScopedDatacore;
    }
}

/** A stand-in Obsidian component whose unload runs registered cleanups. */
class FakeComponent implements ComponentLike {
    private readonly cleanups: (() => unknown)[] = [];
    readonly manifest = { id: "consumer-plugin", name: "Consumer" };
    register(callback: () => unknown): void {
        this.cleanups.push(callback);
    }
    unload(): void {
        for (const cleanup of this.cleanups) cleanup();
    }
}

const installed: AppLike = {
    plugins: { manifests: { "datacore-engine": {} }, enabledPlugins: new Set(["datacore-engine"]) },
};

let host: object;
let consumer: FakeComponent;
beforeEach(() => {
    host = {};
    consumer = new FakeComponent();
});
afterEach(() => vi.useRealTimers());

describe("getDatacore", () => {
    it("connects to an active engine, identifying the consumer", async () => {
        const engine = new FakeEngine("one");
        registerProvider(getOrCreateRegistry(host), engine.provider);

        const result = await getDatacore(installed, { consumer, host });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.engine.query("@page")).toEqual(["one:@page"]);
        expect(result.engine.consumer).toEqual({ id: "consumer-plugin", name: "Consumer" });
        expect(engine.connections).toEqual([{ id: "consumer-plugin", name: "Consumer" }]);
    });

    it("waits for an engine that loads after the consumer", async () => {
        const pending = getDatacore(installed, { consumer, host });
        registerProvider(getOrCreateRegistry(host), new FakeEngine("late").provider);
        await expect(pending).resolves.toMatchObject({ ok: true });
    });

    it("accepts Obsidian's App, whose public typings do not declare plugins", async () => {
        class ObsidianLikeApp {
            vault = {};
            workspace = {};
        }
        registerProvider(getOrCreateRegistry(host), new FakeEngine("engine").provider);

        const result = await getDatacore(new ObsidianLikeApp(), { consumer, host });
        expect(result.ok).toBe(true);
    });

    it("fails fast when the engine is not installed or disabled", async () => {
        await expect(getDatacore({ plugins: { manifests: {} } }, { consumer, host })).resolves.toMatchObject({
            ok: false,
            reason: "not-installed",
        });
        const disabled: AppLike = { plugins: { manifests: { "datacore-engine": {} }, enabledPlugins: new Set() } };
        await expect(getDatacore(disabled, { consumer, host })).resolves.toMatchObject({
            ok: false,
            reason: "disabled",
        });
    });

    it("times out when no engine arrives", async () => {
        vi.useFakeTimers();
        const pending = getDatacore(installed, { consumer, host, timeoutMs: 1000 });
        await vi.advanceTimersByTimeAsync(1000);
        await expect(pending).resolves.toMatchObject({ ok: false, reason: "timeout" });
        expect(getOrCreateRegistry(host).waiters.size).toBe(0);
    });

    it("rejects an engine whose API version is incompatible", async () => {
        registerProvider(getOrCreateRegistry(host), new FakeEngine("old", "1.1.0").provider);
        await expect(getDatacore(installed, { consumer, host, minApi: "1.2" })).resolves.toMatchObject({
            ok: false,
            reason: "incompatible",
        });
    });
});

describe("handle lifecycle", () => {
    async function connected(engine: FakeEngine, reconnect?: boolean): Promise<DatacoreHandle> {
        registerProvider(getOrCreateRegistry(host), engine.provider);
        const result = await getDatacore(installed, { consumer, host, reconnect });
        if (!result.ok) throw new Error(result.message);
        return result.engine;
    }

    it("is revoked when the engine unloads and reconnects, replaying subscriptions, when it returns", async () => {
        const first = new FakeEngine("first");
        const engine = await connected(first);
        engine.subscribe("@page", () => {});
        const revoked = vi.fn();
        engine.onRevoked(revoked);

        unregisterProvider(getOrCreateRegistry(host), first.provider);
        expect(engine.revoked).toBe(true);
        expect(revoked).toHaveBeenCalledTimes(1);
        expect(() => engine.query("@page")).toThrowError(expect.objectContaining({ code: "revoked" }));

        const second = new FakeEngine("second");
        registerProvider(getOrCreateRegistry(host), second.provider);
        expect(engine.revoked).toBe(false);
        expect(engine.query("@page")).toEqual(["second:@page"]);
        expect([...second.subscriptions]).toEqual(["@page"]);
    });

    it("notifies after reconnecting, once subscriptions are replayed", async () => {
        const first = new FakeEngine("first");
        const engine = await connected(first);
        engine.subscribe("@page", () => {});
        const seen: string[][] = [];
        const listener = engine.onReconnected(() => seen.push([...second.subscriptions]));

        unregisterProvider(getOrCreateRegistry(host), first.provider);
        const second = new FakeEngine("second");
        registerProvider(getOrCreateRegistry(host), second.provider);
        expect(seen).toEqual([["@page"]]);

        listener.dispose();
        unregisterProvider(getOrCreateRegistry(host), second.provider);
        registerProvider(getOrCreateRegistry(host), new FakeEngine("third").provider);
        expect(seen).toHaveLength(1);
    });

    it("stays revoked when reconnect is off", async () => {
        const first = new FakeEngine("first");
        const engine = await connected(first, false);
        unregisterProvider(getOrCreateRegistry(host), first.provider);
        registerProvider(getOrCreateRegistry(host), new FakeEngine("second").provider);
        expect(engine.revoked).toBe(true);
    });

    it("disposes subscriptions and stops reconnecting when the consumer unloads", async () => {
        const first = new FakeEngine("first");
        const engine = await connected(first);
        engine.subscribe("@page", () => {});
        expect(first.subscriptions.size).toBe(1);

        consumer.unload();
        expect(first.subscriptions.size).toBe(0);

        unregisterProvider(getOrCreateRegistry(host), first.provider);
        const second = new FakeEngine("second");
        registerProvider(getOrCreateRegistry(host), second.provider);
        expect(second.subscriptions.size).toBe(0);
    });

    it("disposes a single subscription without replaying it later", async () => {
        const first = new FakeEngine("first");
        const engine = await connected(first);
        engine.subscribe("@page", () => {}).dispose();

        unregisterProvider(getOrCreateRegistry(host), first.provider);
        const second = new FakeEngine("second");
        registerProvider(getOrCreateRegistry(host), second.provider);
        expect(second.subscriptions.size).toBe(0);
    });
});

describe("tryGetDatacore", () => {
    it("returns a handle only when a compatible engine is already active", () => {
        expect(tryGetDatacore({ consumer, host })).toBeUndefined();
        registerProvider(getOrCreateRegistry(host), new FakeEngine("now").provider);
        expect(tryGetDatacore({ consumer, host })?.query("@page")).toEqual(["now:@page"]);
        expect(tryGetDatacore({ consumer, host, minApi: "2.0" })).toBeUndefined();
    });
});
