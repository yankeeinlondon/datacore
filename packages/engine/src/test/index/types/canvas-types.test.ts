import { describe, expect, it } from "vitest";
import { Link } from "expression/link";
import { CanvasFileCard, CanvasWebCard } from "index/types/canvas";

const base = {
    $file: "board.canvas",
    $position: { x: 0, y: 0 },
    $dimensions: { width: 100, height: 100 },
    $link: Link.file("board.canvas").toObject(),
};

describe("canvas card types", () => {
    it("identifies file cards as file cards, not text cards", () => {
        const card = CanvasFileCard.from({ ...base, $id: "file", $type: "file-card", $linkedFile: "Note.md" });
        expect(card.$types).toContain("canvas-file-card");
        expect(card.$types).not.toContain("canvas-text-card");
    });

    it("identifies web cards as web cards, not text cards", () => {
        const card = CanvasWebCard.from(
            { ...base, $id: "web", $type: "web-card", $url: "https://obsidian.md" },
            "board.canvas"
        );
        expect(card.$types).toContain("canvas-web-card");
        expect(card.$types).not.toContain("canvas-text-card");
    });
});
