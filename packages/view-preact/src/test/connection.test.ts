import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { EngineProvider, ScopedDatacore } from "@yankeeinlondon/datacore-contract";
import { getOrCreateRegistry, registerProvider, unregisterProvider } from "@yankeeinlondon/datacore-shared";
import { EngineConnection, unavailableMessage, type ConnectionState } from "../connection";

/** A stand-in engine provider whose handle answers `query` with its own name. */
function provider(name: string, apiVersion = "1.0.0"): EngineProvider {
    return {
        kind: "host",
        priority: 100,
        pluginId: "datacore-engine",
        engineVersion: "1.0.0",
        apiVersion,
        capabilities: new Set(["query", "subscribe"]),
        connect: () => ({ query: () => [name] }) as unknown as ScopedDatacore,
    };
}

/** A stand-in plugin (the consumer); unloading it runs registered cleanups. */
class FakePlugin {
    private readonly cleanups: (() => unknown)[] = [];
    readonly manifest = { id: "datacore-view-preact", name: "Datacore View: Preact" };
    register(callback: () => unknown): void {
        this.cleanups.push(callback);
    }
    unload(): void {
        for (const cleanup of this.cleanups.splice(0)) cleanup();
    }
}

const installed = { plugins: { manifests: { "datacore-engine": {} }, enabledPlugins: new Set(["datacore-engine"]) } };
const disabled = { plugins: { manifests: { "datacore-engine": {} }, enabledPlugins: new Set<string>() } };
const missing = { plugins: { manifests: {}, enabledPlugins: new Set<string>() } };

let host: object;
let plugin: FakePlugin;
let states: string[];

beforeEach(() => {
    host = {};
    plugin = new FakePlugin();
    states = [];
});
afterEach(() => plugin.unload());

function track(connection: EngineConnection): EngineConnection {
    connection.onChange((state) => states.push(describeState(state)));
    return connection;
}

function describeState(state: ConnectionState): string {
    if (state.status === "connected") return `connected:${(state.engine.query("@page") as unknown as string[])[0]}`;
    if (state.status === "unavailable") return `unavailable:${state.reason}`;
    return state.status;
}

describe("EngineConnection", () => {
    it("connects to an active engine", async () => {
        registerProvider(getOrCreateRegistry(host), provider("engine"));
        const connection = track(new EngineConnection(installed, plugin, { host }));

        await connection.start();
        expect(states).toEqual(["connecting", "connected:engine"]);
        expect(unavailableMessage(connection.state)).toBe("");
    });

    it("waits for a disabled engine, then connects when it is enabled", async () => {
        const connection = track(new EngineConnection(disabled, plugin, { host }));
        await connection.start();
        expect(states).toEqual(["connecting", "unavailable:disabled"]);
        expect(unavailableMessage(connection.state)).toMatch(/Enable it/);

        registerProvider(getOrCreateRegistry(host), provider("engine"));
        await Promise.resolve();
        expect(states.at(-1)).toBe("connected:engine");
    });

    it("explains a missing engine", async () => {
        const connection = new EngineConnection(missing, plugin, { host });
        await connection.start();
        expect(connection.state).toMatchObject({ status: "unavailable", reason: "not-installed" });
        expect(unavailableMessage(connection.state)).toMatch(/not installed/);
    });

    it("becomes unavailable when the engine unloads and reconnects when it returns", async () => {
        const first = provider("first");
        registerProvider(getOrCreateRegistry(host), first);
        const connection = track(new EngineConnection(installed, plugin, { host }));
        await connection.start();

        unregisterProvider(getOrCreateRegistry(host), first);
        expect(states.at(-1)).toBe("unavailable:revoked");

        registerProvider(getOrCreateRegistry(host), provider("second"));
        expect(states.at(-1)).toBe("connected:second");
    });

    it("does not retry in a loop against an incompatible engine, but connects to the next one", async () => {
        const old = provider("old", "0.1.0");
        registerProvider(getOrCreateRegistry(host), old);
        const connection = track(new EngineConnection(installed, plugin, { host, minApi: "1.0" }));
        await connection.start();
        await Promise.resolve();
        expect(states).toEqual(["connecting", "unavailable:incompatible"]);

        unregisterProvider(getOrCreateRegistry(host), old);
        registerProvider(getOrCreateRegistry(host), provider("new", "1.2.0"));
        await Promise.resolve();
        expect(states.slice(2)).toEqual(["connecting", "connected:new"]);
    });

    it("stops notifying once stopped", async () => {
        const connection = track(new EngineConnection(disabled, plugin, { host }));
        await connection.start();
        connection.stop();

        registerProvider(getOrCreateRegistry(host), provider("engine"));
        await Promise.resolve();
        expect(states).toEqual(["connecting", "unavailable:disabled"]);
    });
});
