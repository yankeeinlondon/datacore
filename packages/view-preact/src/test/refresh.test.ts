import { describe, expect, it } from "vitest";
import { MarkdownView, type App, type WorkspaceLeaf } from "obsidian";
import { hasCodeBlockIn, rebuildViewsWithCodeBlocks } from "../refresh";

const LANGUAGES = ["dc", "dct", "dcx", "dctx"];

/** A markdown view showing `text` (the test shim's constructor takes the note text, not a leaf). */
const markdownView = (text: string): MarkdownView =>
    new (MarkdownView as unknown as new (data: string) => MarkdownView)(text);

describe("hasCodeBlockIn", () => {
    it("finds fences in the given languages", () => {
        expect(hasCodeBlockIn("# Note\n```dcx\nreturn 1;\n```\n", LANGUAGES)).toBe(true);
        expect(hasCodeBlockIn("~~~~ dct title\n~~~~", LANGUAGES)).toBe(true);
        expect(hasCodeBlockIn("> ```dc\n> ```", LANGUAGES)).toBe(true);
        expect(hasCodeBlockIn("    ```dctx\n    ```", LANGUAGES)).toBe(true);
    });

    it("ignores other languages and inline text", () => {
        expect(hasCodeBlockIn("```datacorejsx\n```", LANGUAGES)).toBe(false);
        expect(hasCodeBlockIn("```dcxx\n```", LANGUAGES)).toBe(false);
        expect(hasCodeBlockIn("```js\n```\nUse dcx blocks.", LANGUAGES)).toBe(false);
        expect(hasCodeBlockIn("```dcx\n```", [])).toBe(false);
    });
});

/** A leaf with a view and a counter for rebuilds. */
function fakeLeaf(view: unknown, withRebuild = true) {
    const leaf = { view, rebuilds: 0 } as { view: unknown; rebuilds: number; rebuildView?: () => Promise<void> };
    if (withRebuild) {
        leaf.rebuildView = () => {
            leaf.rebuilds += 1;
            return Promise.resolve();
        };
    }
    return leaf;
}

function fakeApp(leaves: unknown[]): App {
    return {
        workspace: {
            iterateAllLeaves: (callback: (leaf: WorkspaceLeaf) => void) =>
                leaves.forEach((leaf) => callback(leaf as WorkspaceLeaf)),
        },
    } as unknown as App;
}

describe("rebuildViewsWithCodeBlocks", () => {
    it("rebuilds only markdown views containing the languages", async () => {
        const withBlock = fakeLeaf(markdownView("```dcx\nreturn 1;\n```"));
        const without = fakeLeaf(markdownView("# Plain"));
        const other = fakeLeaf({ getViewData: () => "```dcx\n```" }); // not a MarkdownView (e.g. deferred)
        await rebuildViewsWithCodeBlocks(fakeApp([withBlock, without, other]), LANGUAGES);
        expect([withBlock.rebuilds, without.rebuilds, other.rebuilds]).toEqual([1, 0, 0]);
    });

    it("does nothing when rebuildView is unavailable", async () => {
        const leaf = fakeLeaf(markdownView("```dc\n```"), false);
        await expect(rebuildViewsWithCodeBlocks(fakeApp([leaf]), LANGUAGES)).resolves.toBeUndefined();
    });

    it("keeps going when a rebuild fails", async () => {
        const failing = fakeLeaf(markdownView("```dc\n```"));
        failing.rebuildView = () => Promise.reject(new Error("boom"));
        const next = fakeLeaf(markdownView("```dct\n```"));
        await rebuildViewsWithCodeBlocks(fakeApp([failing, next]), LANGUAGES);
        expect(next.rebuilds).toBe(1);
    });
});
