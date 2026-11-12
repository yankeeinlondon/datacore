/**
 * @module expressions
 */
import type { Literal as ContractLiteral } from "@yankeeinlondon/datacore-contract";
import * as values from "@yankeeinlondon/datacore-shared";
import type { DateTime, Duration } from "luxon";
import { Link } from "expression/link";

// Re-exports of useful generic types.
export { Link };

/** Shorthand for a mapping from keys to values. */
export interface DataObject {
    [key: string]: Literal;
}

/** The literal types supported by the query engine. */
export type LiteralType =
    | "boolean"
    | "number"
    | "string"
    | "date"
    | "duration"
    | "link"
    | "array"
    | "object"
    | "function"
    | "null";
/** The raw values that a literal can take on. */
export type Literal =
    | boolean
    | number
    | string
    | DateTime
    | Duration
    | Link
    | Array<Literal>
    | DataObject
    | Function
    | null;

/** Maps the string type to it's external, API-facing representation. */
export type LiteralRepr<T extends LiteralType> = T extends "boolean"
    ? boolean
    : T extends "number"
      ? number
      : T extends "string"
        ? string
        : T extends "duration"
          ? Duration
          : T extends "date"
            ? DateTime
            : T extends "null"
              ? null
              : T extends "link"
                ? Link
                : T extends "array"
                  ? Array<Literal>
                  : T extends "object"
                    ? DataObject
                    : T extends "function"
                      ? Function
                      : unknown;

/** A wrapped literal value which can be switched on. */
export type WrappedLiteral =
    | LiteralWrapper<"string">
    | LiteralWrapper<"number">
    | LiteralWrapper<"boolean">
    | LiteralWrapper<"date">
    | LiteralWrapper<"duration">
    | LiteralWrapper<"link">
    | LiteralWrapper<"array">
    | LiteralWrapper<"object">
    | LiteralWrapper<"function">
    | LiteralWrapper<"null">;

/** Combines a textual type and value; primarily useful for switching on.
 * @hidden
 */
export interface LiteralWrapper<T extends LiteralType> {
    type: T;
    value: LiteralRepr<T>;
}

/**
 * @hidden
 * Utility library for handling literal values. The implementation is shared with the views and the client
 * (`datacore-shared`), so every bundle compares and stringifies values identically; these wrappers narrow the shared
 * guards to the engine's own `Link`/luxon types.
 */
export namespace Literals {
    /** Settings used when formatting literal values to text. */
    export type ToStringSettings = values.LiteralStringSettings;

    /** Sane, English-based defaults for date formats. */
    export const DEFAULT_TO_STRING: Readonly<ToStringSettings> = values.DEFAULT_LITERAL_STRING_SETTINGS;

    /** Convert an arbitrary value into a reasonable, Markdown-friendly string if possible. */
    export function toString(
        field: unknown,
        setting: ToStringSettings = DEFAULT_TO_STRING,
        recursive: boolean = false
    ): string {
        return values.literalToString(field, setting, recursive);
    }

    /** Wrap a literal value so you can switch on it easily. */
    export function wrapValue(val: unknown): WrappedLiteral | undefined {
        return values.wrapValue(val) as WrappedLiteral | undefined;
    }

    /** Recursively map complex objects at the leaves. */
    export function mapLeaves(val: Literal, func: (t: Literal) => Literal): Literal {
        return values.mapLeaves(val as ContractLiteral, func as (leaf: ContractLiteral) => ContractLiteral) as Literal;
    }

    /** Check if two arbitrary literals are equal. */
    export function equals(first: Literal | undefined, second: Literal | undefined): boolean {
        return values.equals(first as ContractLiteral | undefined, second as ContractLiteral | undefined);
    }

    /** Compare two arbitrary JavaScript values. Produces a total ordering over ANY possible datacore value. */
    export function compare(
        val1: Literal | undefined,
        val2: Literal | undefined,
        linkNormalizer?: (link: string) => string
    ): number {
        return values.compare(val1 as ContractLiteral | undefined, val2 as ContractLiteral | undefined, linkNormalizer);
    }

    /** Find the corresponding datacore type for an arbitrary value. */
    export function typeOf(val: unknown): LiteralType | undefined {
        return values.typeOf(val);
    }

    /** Determine if the given value is "truthy" (i.e., is non-null and has data in it). */
    export function isTruthy(field: Literal): boolean {
        return values.isTruthy(field as ContractLiteral);
    }

    /** Deep copy a field. */
    export function deepCopy<T extends Literal>(field: T): T {
        if (field === null || field === undefined) return field;

        if (Literals.isArray(field)) {
            return ([] as Literal[]).concat(field.map((v) => deepCopy(v))) as T;
        } else if (Literals.isObject(field)) {
            let result: Record<string, Literal> = {};
            for (let [key, value] of Object.entries(field)) result[key] = deepCopy(value as Literal);
            return result as T;
        } else {
            return field;
        }
    }

    /** Determine if the value is a string. */
    export function isString(val: unknown): val is string {
        return typeof val == "string";
    }

    /** Determine if the value is a number. */
    export function isNumber(val: unknown): val is number {
        return typeof val == "number";
    }

    /** Determine if the value is a date (from any copy of luxon). */
    export function isDate(val: unknown): val is DateTime {
        return values.isDateTime(val);
    }

    /** Determine if the value is a duration (from any copy of luxon). */
    export function isDuration(val: unknown): val is Duration {
        return values.isDuration(val);
    }

    /** Determine if the value is null or undefined. */
    export function isNull(val: unknown): val is null | undefined {
        return val === null || val === undefined;
    }

    /** Determine if the value is an array (a plain array or a DataArray). */
    export function isArray(val: unknown): val is unknown[] {
        return values.isLiteralArray(val);
    }

    /** Determine if the value is a boolean. */
    export function isBoolean(val: unknown): val is boolean {
        return typeof val === "boolean";
    }

    /** Determine if the value is a link (from any copy of the engine). */
    export function isLink(val: unknown): val is Link {
        return values.isLink(val);
    }

    /** Checks if the given value is an object (and not any other datacore-recognized object-like type). */
    export function isObject(val: unknown): val is DataObject {
        return values.isDataObject(val);
    }

    /** Determines if the given value is a javascript function. */
    export function isFunction(val: unknown): val is Function {
        return typeof val == "function";
    }
}

/** A grouping on a type which supports recursively-nested groups.
 * @group Common Types
 */
export type GroupElement<T> = { key: Literal; rows: Grouping<T> };

/**
 * A grouping, which can be either:
 * - an array of elements of type `T`, or
 * - an array of {@link Groupelement}s
 *
 * @group Common Types
 */
export type Grouping<T> = T[] | GroupElement<T>[];

/**
 * @hidden
 * Grouping helpers (implementation shared via `datacore-shared`).
 */
export namespace Groupings {
    /** Determines if the given group entry is a standalone value, or a grouping of sub-entries. */
    export function isElementGroup<T>(entry: unknown): entry is GroupElement<T> {
        return values.isGroupElement(entry);
    }

    /** Determines if the given array is a grouping array. */
    export function isGrouping<T>(entry: Grouping<T>): entry is GroupElement<T>[] {
        return values.isGrouping(entry);
    }

    /** Determines if the given array is a leaf and has no subgroupings. */
    export function isLeaf<T>(entry: Grouping<T>): entry is T[] {
        return values.isGroupLeaf(entry);
    }

    /** Count the total number of elements in a recursive grouping. */
    export function count<T>(elements: Grouping<T> | GroupElement<T>): number {
        return values.groupingSize(elements);
    }

    /** Recursively slice a grouping, preserving the group structure that contains elements [start...end). */
    export function slice<T>(elements: Grouping<T>, start: number, end: number): Grouping<T> {
        return values.sliceGrouping(elements, start, end);
    }
}
