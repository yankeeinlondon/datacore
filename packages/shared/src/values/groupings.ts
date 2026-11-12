/** Helpers for (possibly nested) groupings of rows, as produced by `DataArray.groupBy`. */
import type { GroupElement, Grouping, Literal } from "@yankeeinlondon/datacore-contract";
import { isDataObject } from "./guards";

/** True if `entry` is a group (`{ key, rows }`) rather than a row. */
export function isGroupElement<T>(entry: unknown): entry is GroupElement<T> {
    return isDataObject(entry) && Object.keys(entry).length == 2 && "key" in entry && "rows" in entry;
}

/** True if `grouping` is a list of groups rather than a list of rows. */
export function isGrouping<T>(grouping: Grouping<T>): grouping is GroupElement<T>[] {
    for (const element of grouping) if (!isGroupElement(element)) return false;
    return true;
}

/** True if `grouping` is a list of rows with no sub-groups. */
export function isGroupLeaf<T>(grouping: Grouping<T>): grouping is T[] {
    for (const element of grouping) if (isGroupElement(element)) return false;
    return true;
}

/** The total number of rows in a (possibly nested) grouping. */
export function groupingSize<T>(elements: Grouping<T> | GroupElement<T>): number {
    if (isGroupElement(elements)) {
        return groupingSize(elements.rows);
    } else if (isGrouping(elements)) {
        let result = 0;
        for (const subgroup of elements) result += groupingSize(subgroup.rows);
        return result;
    } else {
        return elements.length;
    }
}

/** Slice rows `[start, end)` out of a grouping, preserving the group structure around them. */
export function sliceGrouping<T>(elements: Grouping<T>, start: number, end: number): Grouping<T> {
    if (end <= start) return [];
    if (isGroupLeaf(elements)) return elements.slice(start, end);

    // Find the first group that contains index `start`.
    let index = 0;
    let seen = 0;
    while (index < elements.length && seen + groupingSize(elements[index] as GroupElement<T>) <= start) {
        seen += groupingSize(elements[index] as GroupElement<T>);
        index++;
    }

    // start was greater than the entire length of the groupings.
    if (index >= elements.length) return [];

    const result: { key: Literal; rows: Grouping<T> }[] = [];
    while (index < elements.length && seen < end) {
        const group = elements[index] as GroupElement<T>;
        const groupSize = groupingSize(group);
        const groupStart = Math.max(seen, start);
        const groupEnd = Math.min(groupSize + seen, end);

        result.push({
            key: group.key,
            rows: sliceGrouping(group.rows, groupStart - seen, groupEnd - seen),
        });

        seen += groupSize;
        index++;
    }

    return result;
}
