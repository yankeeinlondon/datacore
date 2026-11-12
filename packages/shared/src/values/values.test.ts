import { BRAND_KEYS, type Link, type Literal } from "@yankeeinlondon/datacore-contract";
import { DateTime, Duration } from "luxon";
import { describe, expect, it } from "vitest";
import {
    compare,
    equals,
    groupingSize,
    isDataArray,
    isDataObject,
    isDateTime,
    isDuration,
    isGroupElement,
    isGrouping,
    isGroupLeaf,
    isLink,
    isLiteralArray,
    isTruthy,
    literalToString,
    mapLeaves,
    renderMinimalDuration,
    sliceGrouping,
    typeOf,
} from "./index";

/** A minimal stand-in for an engine link (only the brand and the fields the helpers read). */
function link(path: string, subpath?: string): Link {
    return {
        [Symbol.for(BRAND_KEYS.link)]: true,
        path,
        subpath,
        type: subpath ? "header" : "file",
        embed: false,
        markdown: () => `[[${path}${subpath ? "#" + subpath : ""}]]`,
    } as unknown as Link;
}

/**
 * Behaves like the engine's DataArray proxy: branded, iterable, and answering any unknown property with a (truthy)
 * array of the elements' values for that property ("swizzling").
 */
function dataArray<T>(values: T[]): T[] {
    const target = Object.assign([...values], { [Symbol.for(BRAND_KEYS.dataArray)]: true });
    return new Proxy(target, {
        get(object, property, receiver) {
            if (property in object) return Reflect.get(object, property, receiver) as unknown;
            return values.map((value) => (value as Record<PropertyKey, unknown>)[property]);
        },
    });
}

/** A DateTime as if from a separately bundled luxon: same fields, unrelated prototype. */
function foreignDateTime(iso: string): DateTime {
    return foreignCopy(DateTime.fromISO(iso, { zone: "utc" }));
}

function foreignCopy(original: DateTime): DateTime {
    const prototypeCopy = Object.create(Object.prototype, Object.getOwnPropertyDescriptors(DateTime.prototype));
    // oxlint-disable-next-line typescript/no-misused-spread -- copying fields onto another prototype is the point
    return Object.setPrototypeOf({ ...original }, prototypeCopy) as DateTime;
}

describe("guards", () => {
    it("recognize branded and marked values", () => {
        expect(isLink(link("A.md"))).toBe(true);
        expect(isDateTime(DateTime.now())).toBe(true);
        expect(isDuration(Duration.fromObject({ hours: 1 }))).toBe(true);
        expect(isDataArray(dataArray([1]))).toBe(true);
        expect(isDateTime(foreignDateTime("2024-01-01"))).toBe(true);
    });

    it("reject look-alikes", () => {
        expect(isLink({ path: "A.md", type: "file", embed: false })).toBe(false);
        expect(isDateTime({ isLuxonDateTime: "yes" })).toBe(false);
        expect(isDataArray([1, 2])).toBe(false);
    });

    it("do not mistake a swizzling data array for a date, duration, or link", () => {
        const array = dataArray([3, 1, 2]);
        expect((array as unknown as Record<string, unknown>)["isLuxonDateTime"]).toBeTruthy();

        expect(isDateTime(array)).toBe(false);
        expect(isDuration(array)).toBe(false);
        expect(isLink(array)).toBe(false);
        expect(isLiteralArray(array)).toBe(true);
        expect(isDataObject(array)).toBe(false);
        expect(typeOf(array)).toBe("array");
    });
});

describe("typeOf", () => {
    it.each<[unknown, string | undefined]>([
        [null, "null"],
        [undefined, "null"],
        [1, "number"],
        ["a", "string"],
        [false, "boolean"],
        [DateTime.now(), "date"],
        [Duration.fromObject({ days: 1 }), "duration"],
        [link("A.md"), "link"],
        [[1], "array"],
        [{ a: 1 }, "object"],
        [() => 1, "function"],
        [Symbol("s"), undefined],
    ])("%o → %s", (value, expected) => {
        expect(typeOf(value)).toBe(expected);
    });
});

describe("compare", () => {
    it("orders nulls first, then by type name, then by value", () => {
        const values: Literal[] = ["b", 2, null, "a", true, 1];
        expect([...values].sort((a, b) => compare(a, b))).toEqual([null, true, 1, 2, "a", "b"]);
    });

    it("compares dates from different copies of luxon", () => {
        const earlier = foreignDateTime("2024-01-01T00:00:00Z");
        const later = DateTime.fromISO("2024-06-01T00:00:00Z", { zone: "utc" });
        expect(compare(earlier, later)).toBeLessThan(0);
        expect(compare(later, earlier)).toBeGreaterThan(0);
        expect(
            equals(foreignDateTime("2024-01-01T00:00:00Z"), DateTime.fromISO("2024-01-01T00:00:00Z", { zone: "utc" }))
        ).toBe(true);
    });

    it("compares links by normalized path, then subpath", () => {
        expect(compare(link("a/B.md"), link("a/C.md"))).toBeLessThan(0);
        expect(compare(link("B.md"), link("B.md", "Head"))).toBeLessThan(0);
        expect(compare(link("X/B.md"), link("Y/B.md"), (path) => path.split("/").pop() ?? path)).toBe(0);
    });

    it("compares lists element-wise and objects by keys, then values", () => {
        expect(compare([1, 2], [1, 3])).toBeLessThan(0);
        expect(compare([1, 2], [1, 2, 0])).toBeLessThan(0);
        expect(compare(dataArray([1, 2]) as Literal, [1, 2])).toBe(0);
        expect(compare({ a: 1 }, { b: 1 })).toBeLessThan(0);
        expect(compare({ a: 1 }, { a: 2 })).toBeLessThan(0);
        expect(equals({ a: [1, "x"] }, { a: [1, "x"] })).toBe(true);
    });
});

describe("literalToString", () => {
    const settings = { nullRepresentation: "∅", dateFormat: "yyyy-MM-dd", dateTimeFormat: "yyyy-MM-dd HH:mm" };

    it("formats every literal type", () => {
        expect(literalToString(null, settings)).toBe("∅");
        expect(literalToString(42, settings)).toBe("42");
        expect(literalToString(true, settings)).toBe("true");
        expect(literalToString(link("A.md"), settings)).toBe("[[A.md]]");
        expect(literalToString(() => 1, settings)).toBe("<function>");
        expect(literalToString([1, [2, 3]], settings)).toBe("1, [2, 3]");
        expect(literalToString({ a: 1, b: "x" }, settings)).toBe("{ a: 1, b: x }");
        expect(literalToString(Duration.fromObject({ minutes: 200 }), settings)).toBe("3 hours, 20 minutes");
    });

    it("uses the date format for midnight and the date-time format otherwise", () => {
        expect(literalToString(DateTime.fromISO("2024-03-05"), settings)).toBe("2024-03-05");
        expect(literalToString(DateTime.fromISO("2024-03-05T14:30"), settings)).toBe("2024-03-05 14:30");
        expect(literalToString(foreignCopy(DateTime.fromISO("2024-03-05T14:30")), settings)).toBe("2024-03-05 14:30");
    });

    it("renders durations minimally", () => {
        expect(renderMinimalDuration(Duration.fromObject({ seconds: 3725 }))).toBe("1 hours, 2 minutes, 5 seconds");
    });
});

describe("isTruthy and mapLeaves", () => {
    it("treats empty values as false", () => {
        expect([0, "", false, null, [], {}, link("")].map((value) => isTruthy(value as Literal))).toEqual(
            Array(7).fill(false)
        );
        expect([1, "a", true, [0], { a: 0 }, link("A.md"), () => 0].map((value) => isTruthy(value as Literal))).toEqual(
            Array(7).fill(true)
        );
    });

    it("maps leaves of nested lists and objects", () => {
        expect(mapLeaves({ a: [1, { b: 2 }] }, (leaf) => (typeof leaf === "number" ? leaf * 10 : leaf))).toEqual({
            a: [10, { b: 20 }],
        });
    });
});

describe("groupings", () => {
    const grouping = [
        { key: "a", rows: [1, 2, 3] },
        { key: "b", rows: [{ key: "b1", rows: [4, 5] }] },
        { key: "c", rows: [6] },
    ];

    it("classifies groups and leaves", () => {
        expect(isGroupElement(grouping[0])).toBe(true);
        expect(isGroupElement({ key: "a", rows: [], extra: 1 })).toBe(false);
        expect(isGrouping(grouping)).toBe(true);
        expect(isGroupLeaf([1, 2])).toBe(true);
    });

    it("counts rows across nested groups", () => {
        expect(groupingSize(grouping)).toBe(6);
        expect(groupingSize([])).toBe(0);
    });

    it("slices rows while keeping the group structure", () => {
        expect(sliceGrouping(grouping, 2, 5)).toEqual([
            { key: "a", rows: [3] },
            { key: "b", rows: [{ key: "b1", rows: [4, 5] }] },
        ]);
        expect(sliceGrouping(grouping, 5, 10)).toEqual([{ key: "c", rows: [6] }]);
        expect(sliceGrouping(grouping, 7, 10)).toEqual([]);
        expect(sliceGrouping([1, 2, 3], 1, 2)).toEqual([2]);
    });
});
