import { afterEach, describe, expect, it, vi } from "vitest";
import type { Indexable } from "index/types/indexable";
import type { MarkdownPage, MarkdownTaskItem } from "index/types/markdown";
import { InProcessImporter } from "index/web-worker/in-process-importer";
import { MemoryCache } from "test/fixtures/memory-cache";
import { note } from "test/fixtures/note-builder";
import { createTestEngine, TestEngine } from "test/fixtures/test-engine";

const dune = () =>
    note("Books/Dune.md")
        .frontmatter({ genre: "scifi", rating: 5, tags: ["classic"] })
        .heading(1, "Dune")
        .paragraph("A novel by [[Frank Herbert]]. #book", "status:: reading")
        .heading(2, "Notes")
        .list({ text: "Finish part one", task: "x" }, { text: "Write review", task: " " }, "Spice must flow");

const herbert = () => note("People/Frank Herbert.md").paragraph("Author. #person");
const foundation = () =>
    note("Books/Foundation.md").frontmatter({ genre: "scifi", rating: 4 }).paragraph("#book", "status:: done");

let engine: TestEngine | undefined;
afterEach(() => {
    engine?.dispose();
    engine = undefined;
    vi.restoreAllMocks();
});

const paths = (objects: Indexable[]) => objects.map((object) => object.$file ?? object.$id).sort();

describe("headless engine harness", () => {
    it("indexes every note on startup", async () => {
        engine = await createTestEngine({ notes: [dune(), herbert(), foundation()] });

        expect(engine.core.initialized).toBe(true);
        expect(paths(engine.query("@page"))).toEqual([
            "Books/Dune.md",
            "Books/Foundation.md",
            "People/Frank Herbert.md",
        ]);
    });

    it("answers queries over tags, frontmatter, inline fields, tasks and sections", async () => {
        engine = await createTestEngine({ notes: [dune(), herbert(), foundation()] });

        expect(paths(engine.query("@page and #book"))).toEqual(["Books/Dune.md", "Books/Foundation.md"]);
        expect(paths(engine.query("@page and #classic"))).toEqual(["Books/Dune.md"]);
        expect(paths(engine.query("@page and rating > 4"))).toEqual(["Books/Dune.md"]);
        expect(paths(engine.query('@page and status = "done"'))).toEqual(["Books/Foundation.md"]);

        const openTasks = engine.query<MarkdownTaskItem>("@task and $completed = false");
        expect(openTasks.map((task) => task.$cleantext)).toEqual(["Write review"]);

        const sections = engine.query('@section and $name = "Notes"');
        expect(paths(sections)).toEqual(["Books/Dune.md"]);
    });

    it("resolves links to the target note's full path", async () => {
        engine = await createTestEngine({ notes: [dune(), herbert()] });

        const page = engine.query<MarkdownPage>("@page and #book")[0]!;
        expect(page.$links.map((link) => link.path)).toContain("People/Frank Herbert.md");
    });

    it("re-indexes a note when it changes", async () => {
        engine = await createTestEngine({ notes: [dune(), foundation()] });

        await engine.write(foundation().paragraph("Rated again. #favorite"));
        expect(paths(engine.query("@page and #favorite"))).toEqual(["Books/Foundation.md"]);
    });

    it("drops a deleted note", async () => {
        engine = await createTestEngine({ notes: [dune(), foundation()] });

        await engine.remove("Books/Foundation.md");
        expect(paths(engine.query("@page and #book"))).toEqual(["Books/Dune.md"]);
    });

    it("re-indexes a renamed note at its new path", async () => {
        engine = await createTestEngine({ notes: [dune(), foundation()] });

        await engine.rename("Books/Foundation.md", "Archive/Foundation.md");
        expect(paths(engine.query("@page and #book"))).toEqual(["Archive/Foundation.md", "Books/Dune.md"]);
    });

    it("ignores cache entries written for a different index schema", async () => {
        const cache = new MemoryCache("0-outdated");
        const first = await createTestEngine({ notes: [dune(), foundation()], cache });
        first.dispose();

        const imports = vi.spyOn(InProcessImporter.prototype, "import");
        engine = await createTestEngine({ notes: [dune(), foundation()], cache });
        expect(imports).toHaveBeenCalledTimes(2);
    });

    it("starts from the cache when files are unchanged", async () => {
        const cache = new MemoryCache();
        const first = await createTestEngine({ notes: [dune(), foundation()], cache });
        expect([...cache.entries.keys()].sort()).toEqual(["Books/Dune.md", "Books/Foundation.md"]);
        first.dispose();

        const imports = vi.spyOn(InProcessImporter.prototype, "import");
        engine = await createTestEngine({ notes: [dune(), foundation()], cache });

        expect(imports).not.toHaveBeenCalled();
        expect(paths(engine.query("@page and #book"))).toEqual(["Books/Dune.md", "Books/Foundation.md"]);
    });
});

describe("contract: revision rule", () => {
    it("stamps every object of a re-indexed note with the new store revision", async () => {
        engine = await createTestEngine({ notes: [dune(), foundation()] });
        const before = engine.core.revision;

        await engine.write(dune().paragraph("Updated."));

        const revision = engine.core.revision;
        expect(revision).toBeGreaterThan(before);
        const duneObjects = engine
            .query("@page or @section or @block or @list-item or @task")
            .filter((object) => object.$file === "Books/Dune.md");
        expect(duneObjects.length).toBeGreaterThan(1);
        for (const object of duneObjects) expect(object.$revision).toBe(revision);

        const untouched = engine.query("@page").find((object) => object.$file === "Books/Foundation.md")!;
        expect(untouched.$revision).toBeLessThan(revision);
    });
});
