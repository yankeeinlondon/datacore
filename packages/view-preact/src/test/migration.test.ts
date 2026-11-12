import { describe, expect, it } from "vitest";
import { TFile } from "obsidian";
import { convertNotes, findPendingNotes, type MigrationVault, plural } from "../migrate/migration";

/** An in-memory vault; `failOn` names paths whose read or write throws. */
function fakeVault(notes: Record<string, string>, failOn: { read?: string[]; write?: string[] } = {}) {
    const contents = new Map(Object.entries(notes));
    const files = [...contents.keys()].map((path) => Object.assign(new TFile(), { path, name: path, extension: "md" }));
    let writes = 0;
    const vault: MigrationVault = {
        getMarkdownFiles: () => files,
        cachedRead: (file) =>
            failOn.read?.includes(file.path)
                ? Promise.reject(new Error("unreadable"))
                : Promise.resolve(contents.get(file.path) ?? ""),
        process: (file, transform) => {
            if (failOn.write?.includes(file.path)) return Promise.reject(new Error("read-only"));
            const next = transform(contents.get(file.path) ?? "");
            contents.set(file.path, next);
            writes += 1;
            return Promise.resolve(next);
        },
    };
    return { vault, contents, file: (path: string) => files.find((file) => file.path === path)!, writes: () => writes };
}

const BLOCK = "```datacorejsx\nreturn 1;\n```\n";

describe("findPendingNotes", () => {
    it("lists notes with datacore blocks and their counts, sorted by path", async () => {
        const { vault } = fakeVault({
            "b.md": BLOCK + BLOCK,
            "a.md": BLOCK,
            "plain.md": "# Nothing here\n",
            "converted.md": "```dcx\n```\n",
            "mentions.md": "Datacore uses `datacorejsx` blocks.\n",
            "example.md": "````md\n" + BLOCK + "````\n",
        });
        const pending = await findPendingNotes(vault);
        expect(pending.map((note) => [note.file.path, note.blocks])).toEqual([
            ["a.md", 1],
            ["b.md", 2],
        ]);
    });

    it("skips notes it cannot read", async () => {
        const { vault } = fakeVault({ "a.md": BLOCK, "bad.md": BLOCK }, { read: ["bad.md"] });
        expect((await findPendingNotes(vault)).map((note) => note.file.path)).toEqual(["a.md"]);
    });
});

describe("convertNotes", () => {
    it("rewrites each note and reports the totals", async () => {
        const { vault, contents, file } = fakeVault({ "a.md": BLOCK, "b.md": BLOCK + BLOCK });
        const summary = await convertNotes(vault, [file("a.md"), file("b.md")]);
        expect(summary).toEqual({ notes: 2, blocks: 3, failures: [] });
        expect(contents.get("a.md")).toBe("```dcx\nreturn 1;\n```\n");
        expect(contents.get("b.md")).toBe("```dcx\nreturn 1;\n```\n".repeat(2));
    });

    it("converts the content as it is at write time", async () => {
        const { vault, contents, file } = fakeVault({ "a.md": BLOCK });
        const [note] = await findPendingNotes(vault);
        // Edited after the scan: a second block was added, and the text around it must survive.
        contents.set("a.md", "intro\n" + BLOCK + "middle\n" + BLOCK.replace("jsx", "ts"));
        const summary = await convertNotes(vault, [note!.file]);
        expect(summary.blocks).toBe(2);
        expect(contents.get("a.md")).toBe("intro\n```dcx\nreturn 1;\n```\nmiddle\n```dct\nreturn 1;\n```\n");
        expect(file("a.md")).toBe(note!.file);
    });

    it("does not count a note that was converted since the scan", async () => {
        const { vault, contents, file } = fakeVault({ "a.md": BLOCK });
        contents.set("a.md", "```dcx\n```\n");
        expect(await convertNotes(vault, [file("a.md")])).toEqual({ notes: 0, blocks: 0, failures: [] });
        expect(contents.get("a.md")).toBe("```dcx\n```\n");
    });

    it("keeps going when a note fails", async () => {
        const { vault, contents, file } = fakeVault({ "a.md": BLOCK, "bad.md": BLOCK }, { write: ["bad.md"] });
        const summary = await convertNotes(vault, [file("bad.md"), file("a.md")]);
        expect(summary.notes).toBe(1);
        expect(summary.failures.map((failure) => failure.file.path)).toEqual(["bad.md"]);
        expect(contents.get("a.md")).toBe("```dcx\nreturn 1;\n```\n");
        expect(contents.get("bad.md")).toBe(BLOCK);
    });

    it("is a no-op the second time", async () => {
        const { vault, contents, file } = fakeVault({ "a.md": BLOCK });
        await convertNotes(vault, [file("a.md")]);
        const once = contents.get("a.md");
        expect(await convertNotes(vault, [file("a.md")])).toEqual({ notes: 0, blocks: 0, failures: [] });
        expect(contents.get("a.md")).toBe(once);
        expect(await findPendingNotes(vault)).toEqual([]);
    });
});

describe("plural", () => {
    it("pluralizes by count", () => {
        expect(plural(1, "note")).toBe("1 note");
        expect(plural(0, "note")).toBe("0 notes");
        expect(plural(3, "block")).toBe("3 blocks");
    });
});
