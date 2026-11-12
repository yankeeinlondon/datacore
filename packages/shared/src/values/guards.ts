/**
 * Identity-safe type guards for engine values. They check brands and markers rather than classes, so they work on values
 * from any bundle (another plugin's copy of the engine, the client, or luxon). Never use `instanceof` on engine values.
 */
import { BRAND_KEYS, type DataArray, type DataObject, type Link } from "@yankeeinlondon/datacore-contract";
import type { DateTime, Duration } from "luxon";

const LINK_BRAND = Symbol.for(BRAND_KEYS.link);
const DATA_ARRAY_BRAND = Symbol.for(BRAND_KEYS.dataArray);

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
    return typeof value === "object" && value !== null;
}

/**
 * Markers and brands must be strictly `true`: a `DataArray` answers any unknown property with a (truthy) `DataArray`
 * of its elements' values, which a truthiness check would mistake for a date, duration, or link.
 */
function hasMarker(value: unknown, key: PropertyKey): boolean {
    return isRecord(value) && value[key] === true;
}

/** A link created by the engine. */
export function isLink(value: unknown): value is Link {
    return hasMarker(value, LINK_BRAND);
}

/** A `DataArray` created by the engine. */
export function isDataArray(value: unknown): value is DataArray<unknown> {
    return hasMarker(value, DATA_ARRAY_BRAND);
}

/** A luxon `DateTime` (from any copy of luxon). */
export function isDateTime(value: unknown): value is DateTime {
    return hasMarker(value, "isLuxonDateTime");
}

/** A luxon `Duration` (from any copy of luxon). */
export function isDuration(value: unknown): value is Duration {
    return hasMarker(value, "isLuxonDuration");
}

/** A list value: a plain array or an engine `DataArray`. */
export function isLiteralArray(value: unknown): value is unknown[] {
    return Array.isArray(value) || isDataArray(value);
}

/** A plain data object: an object that is not a list, date, duration, or link. */
export function isDataObject(value: unknown): value is DataObject {
    return isRecord(value) && !isLiteralArray(value) && !isDuration(value) && !isDateTime(value) && !isLink(value);
}
