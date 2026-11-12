import { describe, test, expect } from "vitest";
import { getFileTitle, getParentFolder, lineRange } from "./text";

describe("Line Range", () => {
    test("Single Line", () => expect(lineRange("hello", 0, 1)).toEqual("hello"));

    test("First Line", () => expect(lineRange("hello\nworld", 0, 1)).toEqual("hello"));
    test("Second Line", () => expect(lineRange("hello\nworld", 1, 2)).toEqual("world"));

    test("First Line (Extended)", () => expect(lineRange("hello\nworld\n\n", 0, 1)).toEqual("hello"));
    test("Second Line (Extended)", () => expect(lineRange("hello\nworld\n\n", 1, 2)).toEqual("world"));

    test("Two Lines", () => expect(lineRange("hello\nworld", 0, 2)).toEqual("hello\nworld"));

    test("Just Newline", () => expect(lineRange("\n", 0, 1)).toEqual(""));
    test("Just Newline (Out of Bounds)", () => expect(lineRange("\n", 1, 2)).toEqual(""));

    test("4 Lines", () => expect(lineRange("hello\n\n\nworld\ntext\n\n", 4, 5)).toEqual("text"));
});

describe("getFileTitle()", () => {
    test("empty", () => expect(getFileTitle("")).toEqual(""));

    test("root getFileTitle()", () => {
        expect(getFileTitle("yes.md")).toEqual("yes");
        expect(getFileTitle("yes")).toEqual("yes");
    });

    test("folder getFielTitle()", () => {
        expect(getFileTitle("ok/yes.md")).toEqual("yes");
        expect(getFileTitle("/yes")).toEqual("yes");
    });
});

test("empty getParentFolder()", () => {
    expect(getParentFolder("")).toEqual("");
});

test("root getParentFolder()", () => {
    expect(getParentFolder("yes")).toEqual("");
    expect(getParentFolder("maybe")).toEqual("");
});

test("folder getParentFolder()", () => {
    expect(getParentFolder("ok/yes")).toEqual("ok");
    expect(getParentFolder("no/maybe")).toEqual("no");
    expect(getParentFolder("/maybe")).toEqual("");
});

test("nested folder getParentFolder()", () => {
    expect(getParentFolder("a/b/c.md")).toEqual("a/b");
    expect(getParentFolder("hello/yes/no/maybe.md")).toEqual("hello/yes/no");
    expect(getParentFolder("hello/yes/no/")).toEqual("hello/yes/no");
});
