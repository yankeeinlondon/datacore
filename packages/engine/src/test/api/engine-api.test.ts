import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DisplaySettings, Indexable, MarkdownPage } from "@yankeeinlondon/datacore-contract";
import { EngineApi } from "api/engine-api";
import { DatacoreError } from "api/errors";
import { note } from "test/fixtures/note-builder";
import { createTestEngine, TestEngine } from "test/fixtures/test-engine";

const dune = (extra = "") => note("Books/Dune.md").frontmatter({ rating: 5 }).paragraph(`#book ${extra}`.trim());
const foundation = (extra = "") =>
    note("Books/Foundation.md").frontmatter({ rating: 4 }).paragraph(`#book ${extra}`.trim());
const recipe = (extra = "") => note("Recipes/Soup.md").paragraph(`#recipe ${extra}`.trim());

let engine: TestEngine;
let api: EngineApi;

beforeEach(async () => {
    engine = await createTestEngine({ notes: [dune(), foundation(), recipe()] });
    api = new EngineApi(engine.core, { apiVersion: "1.0.0", engineVersion: "test" });
});

afterEach(() => {
    api.disposeAll();
    engine.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

const paths = (objects: readonly Indexable[]) => objects.map((object) => object.$file ?? object.$id).sort();

describe("EngineApi: queries", () => {
    it("queries, loads pages, and reports versions and capabilities", () => {
        expect(paths(api.query("@page and #book"))).toEqual(["Books/Dune.md", "Books/Foundation.md"]);
        expect(api.page<MarkdownPage>("Books/Dune.md")?.value("rating")).toBe(5);
        expect(api.apiVersion).toBe("1.0.0");
        expect(api.has("subscribe")).toBe(true);
        expect(api.has("write")).toBe(false);
    });

    it("returns failures from try* methods and throws coded errors otherwise", () => {
        const result = api.tryQuery("@page and (");
        expect(result.successful).toBe(false);

        expect(() => api.query("@page and (")).toThrow(DatacoreError);
        expect(() => api.query("@page and (")).toThrowError(expect.objectContaining({ code: "invalid-query" }));
        expect(() => api.evaluate("1 +")).toThrowError(expect.objectContaining({ code: "evaluation-failed" }));
    });

    it("resolves links to the indexed objects they point to", async () => {
        await engine.write(note("Notes/Plan.md").heading(1, "Goals").paragraph("Ship it. ^next"));
        expect(api.resolveLink("Notes/Plan.md")?.$typename).toBe("Page");
        expect(api.resolveLink("Notes/Plan.md#Goals")?.$typename).toBe("Section");
        expect(api.resolveLink("Notes/Plan.md#^next")?.$typename).toBe("Block");
        expect(api.resolveLink("Missing.md")).toBeUndefined();
    });

    it("scopes evaluation to a source file with local()", () => {
        const local = api.local("Books/Dune.md");
        expect(local.currentPath()).toBe("Books/Dune.md");
        expect(local.currentFile()?.$path).toBe("Books/Dune.md");
        expect(local.evaluate("rating * 2", { rating: 3 })).toBe(6);
    });
});

describe("EngineApi: lifecycle and status", () => {
    it("is initialized and ready after the initial index", async () => {
        expect(api.initialized).toBe(true);
        await expect(api.ready()).resolves.toBeUndefined();

        const status = api.status();
        expect(status.initialized).toBe(true);
        expect(status.revision).toBe(api.revision);
        expect(status.objects).toBeGreaterThan(0);
        expect(status.progress.initialized).toBe(status.progress.total);
    });
});

describe("EngineApi: subscribe", () => {
    it("calls back immediately, then only when the result set changes", async () => {
        const calls: string[][] = [];
        const initialFlags: boolean[] = [];
        api.subscribe(
            "@page and #book",
            (results, meta) => {
                calls.push(paths(results));
                initialFlags.push(meta.initial);
            },
            { debounce: 0 }
        );

        expect(calls).toEqual([["Books/Dune.md", "Books/Foundation.md"]]);

        await engine.write(recipe("updated")); // not a book: no callback
        expect(calls).toHaveLength(1);

        await engine.write(dune("updated")); // re-stored at a new revision: callback
        expect(calls).toHaveLength(2);

        await engine.remove("Books/Foundation.md");
        expect(calls[2]).toEqual(["Books/Dune.md"]);
        expect(initialFlags).toEqual([true, false, false]);
    });

    it("debounces bursts of changes into one callback", async () => {
        vi.useFakeTimers();
        const callback = vi.fn();
        api.subscribe("@page and #book", callback); // default debounce

        await engine.write(dune("one"));
        await engine.write(foundation("two"));
        expect(callback).toHaveBeenCalledTimes(1); // only the initial call so far

        await vi.advanceTimersByTimeAsync(500);
        expect(callback).toHaveBeenCalledTimes(2);
    });

    it("stops calling back once disposed", async () => {
        const callback = vi.fn();
        const subscription = api.subscribe("@page and #book", callback, { debounce: 0 });
        subscription.dispose();

        await engine.write(dune("updated"));
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it("rejects invalid queries at subscribe time", () => {
        expect(() => api.subscribe("@page and (", () => {})).toThrowError(
            expect.objectContaining({ code: "invalid-query" })
        );
    });

    it("evaluates identical queries once per revision", async () => {
        const search = vi.spyOn(engine.core.datastore, "search");
        api.subscribe("@page and #book", () => {}, { debounce: 0 });
        api.subscribe("@page and #book", () => {}, { debounce: 0 });
        expect(search).toHaveBeenCalledTimes(1);

        await engine.write(dune("updated"));
        expect(search).toHaveBeenCalledTimes(2);
    });
});

describe("EngineApi: watchFile, onRevision, events, settings", () => {
    it("watches a single file through changes and deletion", async () => {
        const values: (string | undefined)[] = [];
        api.watchFile("Books/Dune.md", (value) => values.push(value?.$file), { debounce: 0 });

        await engine.write(recipe("unrelated"));
        await engine.write(dune("updated"));
        await engine.remove("Books/Dune.md");

        expect(values).toEqual(["Books/Dune.md", "Books/Dune.md", undefined]);
    });

    it("reports new revisions", async () => {
        const revisions: number[] = [];
        api.onRevision((revision) => revisions.push(revision), { debounce: 0 });

        await engine.write(recipe("updated"));
        expect(revisions).toEqual([api.revision]);
    });

    it("bridges engine events and stops listening when disposed", async () => {
        const renames: [string, string][] = [];
        const listener = api.on("rename", (newPath, oldPath) => renames.push([newPath, oldPath]));

        await engine.rename("Recipes/Soup.md", "Recipes/Stew.md");
        listener.dispose();
        await engine.rename("Recipes/Stew.md", "Recipes/Broth.md");

        expect(renames).toEqual([["Recipes/Stew.md", "Recipes/Soup.md"]]);
    });

    it("exposes display settings and their change event", () => {
        expect(api.settings.display.pageSize).toBe(engine.core.settings.display.pageSize);

        const seen: DisplaySettings[] = [];
        api.on("display-settings", (display) => seen.push(display));
        const display = { ...api.settings.display, pageSize: 7 };
        engine.core.notifyDisplaySettings(display);
        expect(seen).toEqual([display]);
    });

    it("disposes every subscription with disposeAll()", async () => {
        const callback = vi.fn();
        api.subscribe("@page", callback, { debounce: 0 });
        api.onRevision(callback, { debounce: 0 });
        api.disposeAll();

        await engine.write(dune("updated"));
        expect(callback).toHaveBeenCalledTimes(1); // the subscription's initial call only
    });
});
