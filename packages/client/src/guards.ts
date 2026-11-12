/**
 * Type guards for engine values. They check structure and brands rather than classes, so they work on values created
 * by the engine's bundle (never use `instanceof` on engine values).
 */
import {
    BRAND_KEYS,
    INDEX_TYPES,
    type BaseCanvasCard,
    type Canvas,
    type DataArray,
    type File,
    type Indexable,
    type Link,
    type MarkdownBlock,
    type MarkdownCodeblock,
    type MarkdownDatablock,
    type MarkdownListBlock,
    type MarkdownListItem,
    type MarkdownPage,
    type MarkdownSection,
    type MarkdownTaskItem,
} from "@yankeeinlondon/datacore-contract";
import type { DateTime, Duration } from "luxon";

const LINK_BRAND = Symbol.for(BRAND_KEYS.link);
const DATA_ARRAY_BRAND = Symbol.for(BRAND_KEYS.dataArray);

function isObject(value: unknown): value is Record<PropertyKey, unknown> {
    return typeof value === "object" && value !== null;
}

/** True for any indexed object. */
export function isIndexable(value: unknown): value is Indexable {
    return (
        isObject(value) &&
        typeof value["$id"] === "string" &&
        Array.isArray(value["$types"]) &&
        (value["$types"] as unknown[]).every((type) => typeof type === "string")
    );
}

/** True if `value` is an indexed object whose `$types` include `type` (see `INDEX_TYPES`). */
export function hasIndexType(value: unknown, type: string): value is Indexable {
    return isIndexable(value) && value.$types.includes(type);
}

/** Any file (markdown page, canvas, or other file). */
export const isFile = (value: unknown): value is Indexable & File => hasIndexType(value, INDEX_TYPES.file);
/** A markdown page. */
export const isMarkdownPage = (value: unknown): value is MarkdownPage => hasIndexType(value, INDEX_TYPES.page);
/** A section of a markdown page. */
export const isSection = (value: unknown): value is MarkdownSection => hasIndexType(value, INDEX_TYPES.section);
/** Any markdown block. */
export const isBlock = (value: unknown): value is MarkdownBlock => hasIndexType(value, INDEX_TYPES.block);
/** A list block. */
export const isListBlock = (value: unknown): value is MarkdownListBlock => hasIndexType(value, INDEX_TYPES.listBlock);
/** A code block. */
export const isCodeblock = (value: unknown): value is MarkdownCodeblock => hasIndexType(value, INDEX_TYPES.codeblock);
/** A YAML data block. */
export const isDatablock = (value: unknown): value is MarkdownDatablock => hasIndexType(value, INDEX_TYPES.datablock);
/** A list item (including tasks). */
export const isListItem = (value: unknown): value is MarkdownListItem => hasIndexType(value, INDEX_TYPES.listItem);
/** A task. */
export const isTask = (value: unknown): value is MarkdownTaskItem => hasIndexType(value, INDEX_TYPES.task);
/** A canvas file. */
export const isCanvas = (value: unknown): value is Canvas => hasIndexType(value, INDEX_TYPES.canvas);
/** A canvas card. */
export const isCanvasCard = (value: unknown): value is BaseCanvasCard => hasIndexType(value, INDEX_TYPES.canvasCard);

/** A link created by the engine. */
export function isLink(value: unknown): value is Link {
    return isObject(value) && value[LINK_BRAND] === true;
}

/** A `DataArray` created by the engine. */
export function isDataArray(value: unknown): value is DataArray<unknown> {
    return isObject(value) && value[DATA_ARRAY_BRAND] === true;
}

/** A luxon `DateTime` (from any copy of luxon). */
export function isDateTime(value: unknown): value is DateTime {
    return isObject(value) && value["isLuxonDateTime"] === true;
}

/** A luxon `Duration` (from any copy of luxon). */
export function isDuration(value: unknown): value is Duration {
    return isObject(value) && value["isLuxonDuration"] === true;
}
