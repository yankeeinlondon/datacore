/** Identity-safe helpers for the engine's literal values (replacements for the engine's `Literals.*`). */
import type { GroupElement, Grouping, Literal, LiteralType } from "@yankeeinlondon/datacore-contract";
import { isDataArray, isDateTime, isDuration, isLink } from "./guards";

/** The literal type of a value, or `undefined` if it is not a literal. */
export function typeOf(value: unknown): LiteralType | undefined {
    if (value === null || value === undefined) return "null";
    if (typeof value === "number") return "number";
    if (typeof value === "string") return "string";
    if (typeof value === "boolean") return "boolean";
    if (typeof value === "function") return "function";
    if (isDateTime(value)) return "date";
    if (isDuration(value)) return "duration";
    if (isLink(value)) return "link";
    if (Array.isArray(value) || isDataArray(value)) return "array";
    if (typeof value === "object") return "object";
    return undefined;
}

/** Whether a value counts as true in the query language (empty strings, lists and objects are false). */
export function isTruthy(value: Literal): boolean {
    switch (typeOf(value)) {
        case "number":
            return (value as number) !== 0;
        case "string":
            return (value as string).length > 0;
        case "boolean":
            return value as boolean;
        case "link":
            return !!(value as { path: string }).path;
        case "date":
            return (value as { toMillis(): number }).toMillis() !== 0;
        case "duration":
            return (value as { as(unit: "seconds"): number }).as("seconds") !== 0;
        case "object":
            return Object.keys(value as object).length > 0;
        case "array":
            return (value as unknown[]).length > 0;
        case "function":
            return true;
        default:
            return false;
    }
}

/** True if `entry` is a group (`{ key, rows }`) rather than a row. */
export function isGroupElement<T>(entry: unknown): entry is GroupElement<T> {
    return (
        typeof entry === "object" &&
        entry !== null &&
        Object.keys(entry).length === 2 &&
        "key" in entry &&
        "rows" in entry
    );
}

/** True if `grouping` is a list of groups rather than a list of rows. */
export function isGrouping<T>(grouping: Grouping<T>): grouping is GroupElement<T>[] {
    for (const element of grouping) if (!isGroupElement(element)) return false;
    return true;
}
