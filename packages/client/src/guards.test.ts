import { describe, expect, it } from "vitest";
import { BRAND_KEYS } from "@yankeeinlondon/datacore-contract";
import { datacoreError, isDatacoreError } from "./errors";
import { isDataArray, isDateTime, isDuration, isIndexable, isLink, isMarkdownPage, isTask } from "./guards";
import { isGrouping, isTruthy, typeOf } from "./values";

const page = { $id: "a.md", $types: ["file", "markdown", "page"], $typename: "Page" };
const task = { $id: "a.md/task", $types: ["markdown", "list-item", "task"], $typename: "Task" };
const link = Object.assign(Object.create({ [Symbol.for(BRAND_KEYS.link)]: true }), { path: "a.md" });
const dataArray = Object.assign(Object.create({ [Symbol.for(BRAND_KEYS.dataArray)]: true }), { length: 0 });
const date = { isLuxonDateTime: true, toMillis: () => 1 };
const duration = { isLuxonDuration: true, as: () => 0 };

describe("guards", () => {
    it("identifies indexed objects by $types", () => {
        expect(isIndexable(page)).toBe(true);
        expect(isMarkdownPage(page)).toBe(true);
        expect(isTask(page)).toBe(false);
        expect(isTask(task)).toBe(true);
        expect(isIndexable({ $id: 1, $types: [] })).toBe(false);
    });

    it("identifies links and data arrays by brand, not shape", () => {
        expect(isLink(link)).toBe(true);
        expect(isLink({ path: "a.md", embed: false, type: "file" })).toBe(false);
        expect(isDataArray(dataArray)).toBe(true);
        expect(isDataArray([])).toBe(false);
    });

    it("identifies luxon values from any copy of luxon", () => {
        expect(isDateTime(date)).toBe(true);
        expect(isDuration(duration)).toBe(true);
        expect(isDateTime(new Date())).toBe(false);
    });

    it("recognizes coded errors from any bundle", () => {
        const error = datacoreError("timeout", "too slow");
        expect(isDatacoreError(error)).toBe(true);
        expect(error.code).toBe("timeout");
        expect(isDatacoreError(new Error("plain"))).toBe(false);
    });
});

describe("value helpers", () => {
    it("reports literal types", () => {
        expect(typeOf(null)).toBe("null");
        expect(typeOf(link)).toBe("link");
        expect(typeOf(date)).toBe("date");
        expect(typeOf(dataArray)).toBe("array");
        expect(typeOf({ a: 1 })).toBe("object");
    });

    it("applies the query language's truthiness", () => {
        expect(isTruthy("")).toBe(false);
        expect(isTruthy([])).toBe(false);
        expect(isTruthy({})).toBe(false);
        expect(isTruthy(0)).toBe(false);
        expect(isTruthy("x")).toBe(true);
        expect(isTruthy(link)).toBe(true);
    });

    it("distinguishes groups from rows", () => {
        expect(isGrouping([{ key: "a", rows: [1] }])).toBe(true);
        expect(isGrouping([1, 2])).toBe(false);
    });
});
