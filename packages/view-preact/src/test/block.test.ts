import { beforeAll, describe, expect, it } from "vitest";
import type { DatacoreHandle } from "@yankeeinlondon/datacore-client";
import { MarkdownRenderChild } from "obsidian";
import { DatacoreBlock, type ScriptRenderer } from "../block";
import type { ConnectionState, EngineConnection } from "../connection";

beforeAll(() => {
    // Obsidian's DOM helpers, which jsdom does not have.
    const proto = HTMLElement.prototype as unknown as {
        empty(this: HTMLElement): void;
        createDiv(this: HTMLElement, options: { cls?: string | string[]; text?: string }): HTMLDivElement;
    };
    proto.empty = function () {
        this.replaceChildren();
    };
    proto.createDiv = function (options) {
        const div = document.createElement("div");
        div.className = ([] as string[]).concat(options.cls ?? []).join(" ");
        div.textContent = options.text ?? "";
        this.appendChild(div);
        return div;
    };
});

/** A connection whose state the test sets directly. */
class FakeConnection {
    state: ConnectionState = { status: "connecting" };
    private readonly listeners = new Set<(state: ConnectionState) => void>();
    onChange(listener: (state: ConnectionState) => void) {
        this.listeners.add(listener);
        return { dispose: () => this.listeners.delete(listener) };
    }
    set(state: ConnectionState) {
        this.state = state;
        for (const listener of this.listeners) listener(state);
    }
}

/** A script renderer that writes which engine and path it rendered with, and records unloads. */
function recordingRenderer(log: string[]): ScriptRenderer {
    return (engine, source, container, parent, sourcePath) => {
        const child = new (class extends MarkdownRenderChild {
            path = sourcePath;
            onload() {
                container.textContent = `${(engine.query("@page") as unknown as string[])[0]}:${source}@${sourcePath}`;
                log.push("load");
            }
            onunload() {
                log.push("unload");
            }
        })(container);
        parent.addChild(child);
        return child;
    };
}

const engine = (name: string) => ({ query: () => [name] }) as unknown as DatacoreHandle;

describe("DatacoreBlock", () => {
    it("shows why the engine is unavailable, then renders the script once connected", () => {
        const container = document.createElement("div");
        const connection = new FakeConnection();
        const log: string[] = [];
        const block = new DatacoreBlock(
            container,
            connection as unknown as EngineConnection,
            recordingRenderer(log),
            "src",
            "Note.md",
            "jsx"
        );
        block.load();
        expect(container.textContent).toBe("Waiting for Datacore Engine…");

        connection.set({ status: "unavailable", reason: "disabled", message: "" });
        expect(container.querySelector(".datacore-engine-unavailable")?.textContent).toMatch(/Enable it/);

        connection.set({ status: "connected", engine: engine("first") });
        expect(container.textContent).toBe("first:src@Note.md");
        expect(log).toEqual(["load"]);
    });

    it("tears the script down while revoked and renders it again after reconnecting", () => {
        const container = document.createElement("div");
        const connection = new FakeConnection();
        connection.state = { status: "connected", engine: engine("first") };
        const log: string[] = [];
        const block = new DatacoreBlock(
            container,
            connection as unknown as EngineConnection,
            recordingRenderer(log),
            "src",
            "Note.md",
            "jsx"
        );
        block.load();

        connection.set({ status: "unavailable", reason: "revoked", message: "" });
        expect(log).toEqual(["load", "unload"]);
        expect(container.textContent).toMatch(/not running/);

        connection.set({ status: "connected", engine: engine("second") });
        expect(log).toEqual(["load", "unload", "load"]);
        expect(container.textContent).toBe("second:src@Note.md");

        block.unload();
        expect(log.at(-1)).toBe("unload");
    });
});
