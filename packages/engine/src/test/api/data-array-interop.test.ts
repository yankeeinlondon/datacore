/**
 * DataArray/array interop without the old global `Array.isArray` patch (P2 decision 3): every engine path that
 * accepts a list treats a DataArray as one explicitly.
 */
import { describe, expect, it } from "vitest";
import { Coerce } from "api/coerce";
import { DataArray } from "api/data-array";
import { Literals } from "expression/literal";

describe("DataArray interop", () => {
    it("is not a native array (no global patch)", () => {
        expect(Array.isArray(DataArray.wrap([1, 2]))).toBe(false);
    });

    it("counts as an array for Literals and the value helpers", () => {
        const data = DataArray.wrap([1, 2]);
        expect(Literals.isArray(data)).toBe(true);
        expect(Literals.typeOf(data)).toBe("array");
        expect(Literals.isObject(data)).toBe(false);
        expect(Literals.compare(data, DataArray.wrap([1, 2]))).toBe(0);
        expect(Literals.compare(data, [1, 3])).toBeLessThan(0);
    });

    it("is returned as-is by Coerce.array", () => {
        const data = DataArray.wrap([1, 2]);
        expect(Coerce.array(data)).toBe(data);
        expect(Coerce.array(3)).toEqual([3]);
    });

    it("is flattened by to() and expand()", () => {
        const rows = DataArray.wrap([{ tags: DataArray.wrap(["a", "b"]) }, { tags: ["c"] }]);
        expect(rows.to("tags").array()).toEqual(["a", "b", "c"]);

        const leaf = { name: "leaf", children: [] };
        const tree = DataArray.wrap([{ name: "root", children: DataArray.wrap([leaf]) }]);
        expect(
            tree
                .expand("children")
                .map((node) => (node as { name: string }).name)
                .array()
                .sort()
        ).toEqual(["leaf", "root"]);
    });

    it("is spread by flatMap-style functions", () => {
        const nested = DataArray.wrap([DataArray.wrap([1, 2]), [3]]);
        expect(nested.flatMap((x) => x as unknown as number[]).array()).toEqual([1, 2, 3]);
    });
});
