import { describe, expect, it } from "vitest";
import { convertFences } from "../migrate/convert-fences";

/** Joins lines with LF. */
const lines = (...rows: string[]): string => rows.join("\n");

describe("convertFences", () => {
    it("renames each datacore language", () => {
        const input = lines(
            "```datacorejs",
            "return 1;",
            "```",
            "```datacorets",
            "```",
            "```datacorejsx",
            "```",
            "```datacoretsx",
            "```"
        );
        const { text, changes } = convertFences(input);
        expect(text).toBe(lines("```dc", "return 1;", "```", "```dct", "```", "```dcx", "```", "```dctx", "```"));
        expect(changes).toEqual([
            { line: 1, from: "datacorejs", to: "dc" },
            { line: 4, from: "datacorets", to: "dct" },
            { line: 6, from: "datacorejsx", to: "dcx" },
            { line: 8, from: "datacoretsx", to: "dctx" },
        ]);
    });

    it("leaves the block body and closing fence alone", () => {
        const input = lines("```datacorejsx", "const x = 'datacorejsx';", "```datacorejsx is text here", "```");
        // The third line cannot close the fence (it has an info string), so it is body text.
        expect(convertFences(input).text).toBe(
            lines("```dcx", "const x = 'datacorejsx';", "```datacorejsx is text here", "```")
        );
    });

    it("handles tilde fences", () => {
        const input = lines("~~~datacorejsx", "```datacorejs", "~~~", "~~~ datacorets", "~~~");
        const { text, changes } = convertFences(input);
        // The backtick line is inside the tilde fence.
        expect(text).toBe(lines("~~~dcx", "```datacorejs", "~~~", "~~~ dct", "~~~"));
        expect(changes.map((change) => change.line)).toEqual([1, 4]);
    });

    it("handles long fences, closed only by a run at least as long", () => {
        const input = lines("`````datacorejsx", "````", "```", "`````", "```datacorejs", "```");
        expect(convertFences(input).text).toBe(lines("`````dcx", "````", "```", "`````", "```dc", "```"));
    });

    it("accepts a longer closing fence", () => {
        const input = lines("```datacorejsx", "``````", "```datacorejs", "```");
        expect(convertFences(input).text).toBe(lines("```dcx", "``````", "```dc", "```"));
    });

    it("does not let a different marker close a fence", () => {
        const input = lines("```datacorejsx", "~~~", "```datacorejs", "```");
        // `~~~` is body text; the third line is body too (an info string), and the fourth closes.
        expect(convertFences(input).changes).toHaveLength(1);
    });

    it("handles indented fences (e.g. inside list items)", () => {
        const input = lines("- item", "    ```datacorejsx", "    return 1;", "    ```", "\t~~~datacorets", "\t~~~");
        expect(convertFences(input).text).toBe(
            lines("- item", "    ```dcx", "    return 1;", "    ```", "\t~~~dct", "\t~~~")
        );
    });

    it("handles fences inside blockquotes and callouts", () => {
        const input = lines(
            "> [!note] A callout",
            "> ```datacorejsx",
            "> return 1;",
            "> ```",
            ">",
            "> > ```datacorejs",
            "> > ```",
            ">```datacoretsx",
            ">```"
        );
        expect(convertFences(input).text).toBe(
            lines(
                "> [!note] A callout",
                "> ```dcx",
                "> return 1;",
                "> ```",
                ">",
                "> > ```dc",
                "> > ```",
                ">```dctx",
                ">```"
            )
        );
    });

    it("ends a quoted fence where the blockquote ends", () => {
        // The fence is never closed inside the quote; the quote ending closes it, so the next fence is top level.
        const input = lines("> ```datacorejsx", "> return 1;", "", "```datacorejs", "```");
        expect(convertFences(input).text).toBe(lines("> ```dcx", "> return 1;", "", "```dc", "```"));
    });

    it("treats quote markers inside a top-level fence as content", () => {
        const input = lines("```markdown", "> ```datacorejsx", "> ```", "```");
        expect(convertFences(input).changes).toEqual([]);
    });

    it("does not touch fences nested inside another fence", () => {
        const input = lines(
            "````markdown",
            "```datacorejsx",
            "return 1;",
            "```",
            "````",
            "~~~md",
            "```datacorejs",
            "```",
            "~~~",
            "```datacorets",
            "```"
        );
        const { text, changes } = convertFences(input);
        expect(text).toBe(input.replace("```datacorets", "```dct"));
        expect(changes).toEqual([{ line: 10, from: "datacorets", to: "dct" }]);
    });

    it("keeps attributes and spacing after the language", () => {
        const input = lines('``` datacorejsx title="Books" {1,3}', "```", "~~~  datacorets\tfoo", "~~~");
        expect(convertFences(input).text).toBe(lines('``` dcx title="Books" {1,3}', "```", "~~~  dct\tfoo", "~~~"));
    });

    it("matches the whole language word only", () => {
        const input = lines("```datacorejsxx", "```", "```datacore", "```", "```Datacorejsx", "```", "```js", "```");
        expect(convertFences(input).changes).toEqual([]);
    });

    it("ignores lines that are not fences", () => {
        const input = lines("``datacorejsx``", "``` datacorejsx `inline`", "text ```datacorejsx", "```");
        // Line 2 has a backtick in its info string, so it is inline code, not a fence; line 4 then opens a fence.
        expect(convertFences(input).changes).toEqual([]);
    });

    it("preserves CRLF line endings", () => {
        const input = "# Title\r\n```datacorejsx\r\nreturn 1;\r\n```\r\n";
        const { text, changes } = convertFences(input);
        expect(text).toBe("# Title\r\n```dcx\r\nreturn 1;\r\n```\r\n");
        expect(changes).toEqual([{ line: 2, from: "datacorejsx", to: "dcx" }]);
    });

    it("handles mixed line endings and a missing final newline", () => {
        const input = "```datacorejs\nx\r\n```\n```datacorejsx";
        expect(convertFences(input).text).toBe("```dc\nx\r\n```\n```dcx");
    });

    it("leaves already-converted text unchanged", () => {
        const input = lines("```dcx", "```", "```dc", "```");
        const result = convertFences(input);
        expect(result.changes).toEqual([]);
        expect(result.text).toBe(input);
    });

    it("is idempotent", () => {
        const input = lines(
            "> ```datacorejsx",
            "> ```",
            "````md",
            "```datacorejs",
            "```",
            "````",
            "~~~datacorets x",
            "~~~"
        );
        const once = convertFences(input).text;
        const twice = convertFences(once);
        expect(twice.changes).toEqual([]);
        expect(twice.text).toBe(once);
    });

    it("returns no-op files untouched", () => {
        for (const input of [
            "",
            "\n",
            "# Just a note\n\nNo code here.\n",
            "```js\nconsole.log('datacorejsx');\n```\n",
        ]) {
            expect(convertFences(input)).toEqual({ text: input, changes: [] });
        }
    });

    it("converts an unclosed fence at the end of a file", () => {
        expect(convertFences("text\n```datacorejsx\nreturn 1;").text).toBe("text\n```dcx\nreturn 1;");
    });
});
