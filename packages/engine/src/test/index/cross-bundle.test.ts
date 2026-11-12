/**
 * Values that cross plugin boundaries must be recognized without `instanceof`: another plugin's bundle has its own
 * copy of each class (and possibly of luxon). These tests use genuinely separate class copies:
 * - `?foreign` imports make Vite load a second, independent instance of an engine module;
 * - a luxon DateTime whose prototype is a *copy* of DateTime.prototype stands in for another luxon bundle.
 */
import { describe, expect, it } from "vitest";
import { Coerce } from "api/coerce";
import { DataArray } from "api/data-array";
import { Evaluator } from "expression/evaluator";
import { Link } from "expression/link";
import { Literal, Literals } from "expression/literal";
import { EXPRESSION } from "expression/parser";
import { DateTime } from "luxon";
import { DEFAULT_SETTINGS } from "settings";
import { simpleLinkHandler } from "test/common";

async function foreignLinkClass(): Promise<typeof Link> {
    // @ts-expect-error -- the query string loads a separate module instance; types are identical
    const module: typeof import("expression/link") = await import("../../expression/link?foreign");
    return module.Link;
}

async function foreignDataArray(): Promise<typeof DataArray> {
    // @ts-expect-error -- the query string loads a separate module instance; types are identical
    const module: typeof import("api/data-array") = await import("../../api/data-array?foreign");
    return module.DataArray;
}

/** A DateTime that behaves like one from a separately bundled luxon: same shape, unrelated prototype. */
function foreignDateTime(iso: string): DateTime {
    const original = DateTime.fromISO(iso, { zone: "utc" });
    const prototypeCopy = Object.create(Object.prototype, Object.getOwnPropertyDescriptors(DateTime.prototype));
    // Copying own fields onto an unrelated prototype is the point: it simulates another bundle's luxon.
    // oxlint-disable-next-line typescript/no-misused-spread
    return Object.setPrototypeOf({ ...original }, prototypeCopy) as DateTime;
}

function evaluate(expression: string, variables: Record<string, Literal>): Literal {
    const evaluator = new Evaluator(simpleLinkHandler(), DEFAULT_SETTINGS, variables);
    return evaluator.tryEvaluate(EXPRESSION.expression.tryParse(expression));
}

describe("cross-bundle identity", () => {
    it("recognizes links from another copy of the engine", async () => {
        const ForeignLink = await foreignLinkClass();
        const link = ForeignLink.file("Books/Dune.md");

        expect(link instanceof Link).toBe(false);
        expect(Literals.isLink(link)).toBe(true);
        expect(Literals.typeOf(link)).toBe("link");
        expect(Coerce.link(link)).toBe(link);
        // `meta()` reads the link itself (`x.path` would follow the link to its target page).
        expect(evaluate("meta(x).path", { x: link })).toBe("Books/Dune.md");
    });

    it("does not mistake look-alike objects for links", () => {
        const lookalike = { path: "Books/Dune.md", embed: false, type: "file" };
        expect(Literals.isLink(lookalike)).toBe(false);
        expect(Literals.typeOf(lookalike as Literal)).toBe("object");
    });

    it("recognizes dates from another copy of luxon", () => {
        const date = foreignDateTime("2024-03-15T10:00:00Z");

        expect(date instanceof DateTime).toBe(false);
        expect(Literals.isDate(date)).toBe(true);
        expect(Literals.typeOf(date)).toBe("date");
        expect(Coerce.date(date)).toBe(date);
        expect(evaluate("x.year", { x: date })).toBe(2024);
    });

    it("recognizes data arrays from another copy of the engine", async () => {
        const ForeignDataArray = await foreignDataArray();
        const array = ForeignDataArray.wrap([1, 2, 3]);

        expect(DataArray.isDataArray(array)).toBe(true);
        expect(DataArray.isDataArray([1, 2, 3])).toBe(false);
    });

    // A DataArray answers any unknown property with a (truthy) DataArray of its elements' values, so a truthiness check
    // like luxon's `DateTime.isDateTime` mistakes it for a date (it rendered as `time.toLocal is not a function`).
    it("does not mistake data arrays for dates or durations", () => {
        const array = DataArray.wrap([3, 1, 2]);

        expect(Literals.isDate(array)).toBe(false);
        expect(Literals.isDuration(array)).toBe(false);
        expect(Literals.typeOf(array)).toBe("array");
    });
});
