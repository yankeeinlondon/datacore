/**
 * End to end: the real engine, published by EngineHost, used through the real client exactly as another plugin would.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDatacore, isMarkdownPage, type ScopedDatacore } from "@yankeeinlondon/datacore-client";
import { EngineHost } from "api/engine-host";
import { note } from "test/fixtures/note-builder";
import { createTestEngine, TestEngine } from "test/fixtures/test-engine";

const installed = {
    plugins: { manifests: { "datacore-engine": {} }, enabledPlugins: new Set(["datacore-engine"]) },
};

class Consumer {
    readonly manifest = { id: "my-plugin" };
    private readonly cleanups: (() => unknown)[] = [];
    register(callback: () => unknown) {
        this.cleanups.push(callback);
    }
    unload() {
        for (const cleanup of this.cleanups) cleanup();
    }
}

let engine: TestEngine;
let host: object;
let engineHost: EngineHost;
let consumer: Consumer;

beforeEach(async () => {
    engine = await createTestEngine({
        notes: [note("Books/Dune.md").paragraph("#book"), note("Books/Foundation.md").paragraph("#book")],
    });
    host = {};
    consumer = new Consumer();
    engineHost = new EngineHost(engine.core, { host, pluginId: "datacore-engine", engineVersion: "0.1.0" });
});

afterEach(() => {
    consumer.unload();
    engineHost.stop();
    engine.dispose();
});

async function connect(): Promise<ScopedDatacore> {
    const result = await getDatacore(installed, { consumer, host, minApi: "0.0.0", timeoutMs: 1000 });
    if (!result.ok) throw new Error(`${result.reason}: ${result.message}`);
    return result.engine;
}

describe("client ↔ engine", () => {
    it("finds an engine that starts after the consumer asks, and queries it", async () => {
        const pending = connect();
        engineHost.start();
        const dc = await pending;

        const books = dc.query("@page and #book");
        const paths = books.map((page) => page.$file ?? "").sort((a, b) => a.localeCompare(b));
        expect(paths).toEqual(["Books/Dune.md", "Books/Foundation.md"]);
        expect(books.every(isMarkdownPage)).toBe(true);
    });

    it("keeps a subscription working across an engine reload", async () => {
        engineHost.start();
        const dc = await connect();
        const seen: number[] = [];
        dc.subscribe("@page and #book", (results) => seen.push(results.length), { debounce: 0 });
        expect(seen).toEqual([2]);

        engineHost.stop();
        expect(dc.revoked).toBe(true);

        engineHost.start();
        expect(dc.revoked).toBe(false);
        expect(seen).toEqual([2, 2]); // replayed subscription's initial call

        await engine.remove("Books/Foundation.md");
        expect(seen).toEqual([2, 2, 1]);
    });
});
