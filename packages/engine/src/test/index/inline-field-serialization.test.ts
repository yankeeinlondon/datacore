import { Link } from "expression/link";
import { jsonInlineField } from "index/import/inline-field";
import { CanvasTextCard } from "index/types/canvas";
import { JsonCanvasTextCard } from "index/types/json/canvas";
import { JsonConversion } from "index/types/json/common";
import { JsonMarkdownCodeblock } from "index/types/json/markdown";
import { MarkdownCodeblock } from "index/types/markdown";
import { DateTime } from "luxon";

// Fixes hand-ported from blacksmithgu/datacore#157.

const POSITION = { line: 0, start: 0, startValue: 5, end: 15 };

describe("CanvasTextCard inline field serialization", () => {
    it("serializes inline field values to their JSON form", () => {
        const due = DateTime.fromISO("2024-01-02");
        const jsonCard: JsonCanvasTextCard = {
            $type: "text-card",
            $file: "board.canvas",
            $id: "card-1",
            $position: { x: 0, y: 0 },
            $dimensions: { width: 100, height: 100 },
            $link: Link.file("board.canvas").withBlock("card-1").toObject(),
            $tags: [],
            $links: [],
            $sections: [],
            $infields: {
                due: jsonInlineField({ key: "due", raw: "2024-01-02", value: due, position: POSITION }),
            },
        };

        const card = CanvasTextCard.from(jsonCard, "board.canvas");
        expect(DateTime.isDateTime(card.$infields.due.value)).toBe(true);

        const serialized = card.json();
        expect(DateTime.isDateTime(serialized.$infields.due.value)).toBe(false);
        expect(serialized.$infields.due.value).toEqual(JsonConversion.json(due));
    });
});

describe("MarkdownCodeblock inline field links", () => {
    it("applies the link normalizer to inline field values", () => {
        const jsonBlock: JsonMarkdownCodeblock = {
            $type: "codeblock",
            $ordinal: 0,
            $position: { start: 0, end: 3 },
            $tags: [],
            $links: [],
            $languages: ["js"],
            $contentPosition: { start: 1, end: 2 },
            $style: "fenced",
            $infields: {
                related: jsonInlineField({
                    key: "related",
                    raw: "[[Other]]",
                    value: Link.file("Other"),
                    position: POSITION,
                }),
            },
        };

        const block = MarkdownCodeblock.from(jsonBlock, "note.md", (link) => link.withPath("folder/" + link.path));
        expect((block.$infields.related.value as Link).path).toEqual("folder/Other");
    });
});
