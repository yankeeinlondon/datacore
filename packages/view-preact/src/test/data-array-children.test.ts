import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BRAND_KEYS } from "@yankeeinlondon/datacore-contract";
import { h, render } from "preact";
import { installDataArrayChildren, plainChildren } from "../ui/data-array-children";

/** A minimal engine-like DataArray: branded, iterable, and with a map() that returns another DataArray. */
function dataArray<T>(values: T[]): Iterable<T> & { map<U>(f: (value: T, index: number) => U): unknown } {
    return {
        [Symbol.for(BRAND_KEYS.dataArray)]: true,
        [Symbol.iterator]: () => values[Symbol.iterator](),
        map: <U>(f: (value: T, index: number) => U) => dataArray(values.map(f)),
    } as unknown as Iterable<T> & { map<U>(f: (value: T, index: number) => U): unknown };
}

describe("plainChildren", () => {
    it("converts DataArrays at any depth and keeps other values", () => {
        expect(plainChildren(dataArray([1, dataArray([2])]))).toEqual([1, [2]]);
        expect(plainChildren(["a", [dataArray(["b"])]])).toEqual(["a", [["b"]]]);
        const plain = ["x", "y"];
        expect(plainChildren(plain)).toBe(plain);
        expect(plainChildren("text")).toBe("text");
    });
});

describe("installDataArrayChildren", () => {
    let uninstall: () => void;
    let root: HTMLElement;

    beforeEach(() => {
        uninstall = installDataArrayChildren();
        root = document.createElement("div");
    });

    afterEach(() => {
        render(null, root);
        uninstall();
    });

    it("renders DataArray children like arrays", () => {
        const items = dataArray(["a", "b"]).map((item, index) => h("li", { key: index }, item));
        render(h("ul", null, items as never), root);
        expect(root.innerHTML).toBe("<ul><li>a</li><li>b</li></ul>");
    });

    it("renders DataArrays nested in children arrays, and unmounts cleanly", () => {
        render(h("p", null, "n:", dataArray([1, 2]) as never, dataArray([dataArray([3])]) as never), root);
        expect(root.textContent).toBe("n:123");
        render(h("p", null, "gone"), root);
        expect(root.textContent).toBe("gone");
    });
});
