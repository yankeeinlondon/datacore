/**
 * Identity-safe helpers for literal values: wrapping, typing, comparison, truthiness, and formatting. Ported from the
 * engine's `Literals` (upstream `expression/literal.ts`) with every class check replaced by a brand/marker guard, so the
 * engine, the views, and third-party plugins sort, compare, and stringify values identically.
 */
import type { DataObject, Link, Literal, LiteralType } from "@yankeeinlondon/datacore-contract";
import type { DateTime, Duration } from "luxon";
import { renderMinimalDate, renderMinimalDuration } from "./format";
import { isDataObject, isDateTime, isDuration, isLink, isLiteralArray } from "./guards";

/** A literal tagged with its type, for switching on. */
export type WrappedLiteral =
    | { type: "string"; value: string }
    | { type: "number"; value: number }
    | { type: "boolean"; value: boolean }
    | { type: "date"; value: DateTime }
    | { type: "duration"; value: Duration }
    | { type: "link"; value: Link }
    | { type: "array"; value: Literal[] }
    | { type: "object"; value: DataObject }
    | { type: "function"; value: (...args: never[]) => unknown }
    | { type: "null"; value: null };

/** Settings used when formatting literal values to text. */
export interface LiteralStringSettings {
    /** What a null renders as. */
    nullRepresentation: string;
    /** Date format (luxon). */
    dateFormat: string;
    /** Date-time format (luxon). */
    dateTimeFormat: string;
}

/** English defaults for {@link literalToString}. */
export const DEFAULT_LITERAL_STRING_SETTINGS: Readonly<LiteralStringSettings> = Object.freeze({
    nullRepresentation: "-",
    dateFormat: "MMMM dd, yyyy",
    dateTimeFormat: "h:mm a - MMMM dd, yyyy",
});

/** Wrap a literal with its type, or `undefined` if the value is not a literal. */
export function wrapValue(value: unknown): WrappedLiteral | undefined {
    if (value === null || value === undefined) return { type: "null", value: null };
    if (typeof value === "number") return { type: "number", value };
    if (typeof value === "string") return { type: "string", value };
    if (typeof value === "boolean") return { type: "boolean", value };
    if (isDuration(value)) return { type: "duration", value };
    if (isDateTime(value)) return { type: "date", value };
    if (isLiteralArray(value)) return { type: "array", value: value as Literal[] };
    if (isLink(value)) return { type: "link", value };
    if (typeof value === "function") return { type: "function", value: value as (...args: never[]) => unknown };
    if (isDataObject(value)) return { type: "object", value };
    return undefined;
}

/** The literal type of a value, or `undefined` if it is not a literal. */
export function typeOf(value: unknown): LiteralType | undefined {
    return wrapValue(value)?.type;
}

/** Convert a value into a reasonable, Markdown-friendly string. */
export function literalToString(
    value: unknown,
    settings: LiteralStringSettings = DEFAULT_LITERAL_STRING_SETTINGS,
    recursive: boolean = false
): string {
    const wrapped = wrapValue(value);
    if (!wrapped) return settings.nullRepresentation;

    switch (wrapped.type) {
        case "null":
            return settings.nullRepresentation;
        case "string":
            return wrapped.value;
        case "number":
        case "boolean":
            return String(wrapped.value);
        case "link":
            return wrapped.value.markdown();
        case "function":
            return "<function>";
        case "array": {
            const inner = wrapped.value.map((element) => literalToString(element, settings, true)).join(", ");
            return recursive ? `[${inner}]` : inner;
        }
        case "object":
            return (
                "{ " +
                Object.entries(wrapped.value)
                    .map(([key, entry]) => key + ": " + literalToString(entry, settings, true))
                    .join(", ") +
                " }"
            );
        case "date":
            return renderMinimalDate(wrapped.value, settings.dateFormat, settings.dateTimeFormat);
        case "duration":
            return renderMinimalDuration(wrapped.value);
    }
}

/** Recursively map the leaves of nested objects and lists. */
export function mapLeaves(value: Literal, func: (leaf: Literal) => Literal): Literal {
    if (isDataObject(value)) {
        const result: DataObject = {};
        for (const [key, entry] of Object.entries(value)) result[key] = mapLeaves(entry, func);
        return result;
    } else if (isLiteralArray(value)) {
        const result: Literal[] = [];
        for (const entry of value as Literal[]) result.push(mapLeaves(entry, func));
        return result;
    } else {
        return func(value);
    }
}

/** Whether two literals are equal (by {@link compare}). */
export function equals(first: Literal | undefined, second: Literal | undefined): boolean {
    return compare(first, second) == 0;
}

/**
 * Compare two values. Produces a total ordering over any possible value: nulls first, then by type name, then by value
 * (links by normalized path, type, and subpath; lists element-wise; objects by sorted keys, then values).
 */
export function compare(
    first: Literal | undefined,
    second: Literal | undefined,
    linkNormalizer?: (link: string) => string
): number {
    // Reference equality - short circuit.
    if (first === second) return 0;

    // Handle undefined/nulls first.
    const value1 = first ?? null;
    const value2 = second ?? null;
    if (value1 === null && value2 === null) return 0;
    else if (value1 === null) return -1;
    else if (value2 === null) return 1;

    // A non-null value now which we can wrap & compare on.
    const wrap1 = wrapValue(value1);
    const wrap2 = wrapValue(value2);

    if (wrap1 === undefined && wrap2 === undefined) return 0;
    else if (wrap1 === undefined) return -1;
    else if (wrap2 === undefined) return 1;

    // Short-circuit on different types or on reference equality.
    if (wrap1.type != wrap2.type) return wrap1.type.localeCompare(wrap2.type);
    if (wrap1.value === wrap2.value) return 0;

    switch (wrap1.type) {
        case "string":
            return wrap1.value.localeCompare(wrap2.value as string);
        case "number":
            if (wrap1.value < (wrap2.value as number)) return -1;
            else if (wrap1.value == (wrap2.value as number)) return 0;
            return 1;
        case "null":
            return 0;
        case "boolean":
            if (wrap1.value == wrap2.value) return 0;
            else return wrap1.value ? 1 : -1;
        case "link": {
            const link1 = wrap1.value;
            const link2 = wrap2.value as Link;
            const normalize = linkNormalizer ?? ((path: string) => path);

            // We can't compare by file name or display, since that would break link equality. Compare by path.
            const pathCompare = normalize(link1.path).localeCompare(normalize(link2.path));
            if (pathCompare != 0) return pathCompare;

            // Then compare by type.
            const typeCompare = link1.type.localeCompare(link2.type);
            if (typeCompare != 0) return typeCompare;

            // Then compare by subpath existence.
            if (link1.subpath && !link2.subpath) return 1;
            if (!link1.subpath && link2.subpath) return -1;
            if (!link1.subpath && !link2.subpath) return 0;

            // Since both have a subpath, compare by subpath.
            return (link1.subpath ?? "").localeCompare(link2.subpath ?? "");
        }
        case "date": {
            const other = wrap2.value as DateTime;
            return wrap1.value < other ? -1 : wrap1.value.equals(other) ? 0 : 1;
        }
        case "duration": {
            const other = wrap2.value as Duration;
            return wrap1.value < other ? -1 : wrap1.value.equals(other) ? 0 : 1;
        }
        case "array": {
            const list1 = wrap1.value;
            const list2 = wrap2.value as (Literal | undefined)[];
            for (let index = 0; index < Math.min(list1.length, list2.length); index++) {
                const comparison = compare(list1[index], list2[index]);
                if (comparison != 0) return comparison;
            }
            return list1.length - list2.length;
        }
        case "object": {
            const object1 = wrap1.value as Record<string, Literal | undefined>;
            const object2 = wrap2.value as Record<string, Literal | undefined>;
            const keys1 = Object.keys(object1).sort();
            const keys2 = Object.keys(object2).sort();

            const keyCompare = compare(keys1, keys2);
            if (keyCompare != 0) return keyCompare;

            for (const key of keys1) {
                const comparison = compare(object1[key], object2[key]);
                if (comparison != 0) return comparison;
            }

            return 0;
        }
        case "function":
            return 0;
    }
}

/** Whether a value counts as true in the query language (empty strings, lists, and objects are false). */
export function isTruthy(value: Literal): boolean {
    const wrapped = wrapValue(value);
    if (!wrapped) return false;

    switch (wrapped.type) {
        case "number":
            return wrapped.value != 0;
        case "string":
            return wrapped.value.length > 0;
        case "boolean":
            return wrapped.value;
        case "link":
            return !!wrapped.value.path;
        case "date":
            return wrapped.value.toMillis() != 0;
        case "duration":
            return wrapped.value.as("seconds") != 0;
        case "object":
            return Object.keys(wrapped.value).length > 0;
        case "array":
            return wrapped.value.length > 0;
        case "null":
            return false;
        case "function":
            return true;
    }
}
