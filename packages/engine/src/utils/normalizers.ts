import { DateTime, Duration } from "luxon";
import * as P from "parsimmon";
import emojiRegex from "emoji-regex";
import { Link } from "expression/link";
import { normalizeDuration as sharedNormalizeDuration } from "@yankeeinlondon/datacore-shared";

// Locale, date/duration rendering, paths, and line ranges are shared with the views and the client (datacore-shared).
export {
    currentLocale,
    getExtension,
    getFileName,
    getFileTitle,
    getParentFolder,
    lineRange,
    lineReplace,
    lineSpan,
    renderMinimalDate,
    renderMinimalDuration,
    skipNewlines,
} from "@yankeeinlondon/datacore-shared";

// Date/Time Rendering

/** Normalize a duration to all of the proper units. */
export function normalizeDuration(dur: Duration) {
    if (dur === undefined || dur === null) return dur;

    return sharedNormalizeDuration(dur);
}

/** Strip the time components of a date time object. */
export function stripTime(dt: DateTime): DateTime {
    if (dt === null || dt === undefined) return dt;

    return DateTime.fromObject({
        year: dt.year,
        month: dt.month,
        day: dt.day,
    });
}

/** Try to extract a YYYYMMDD date from a string. */
export function extractDate(str: string): DateTime | undefined {
    let dateMatch = /(\d{4})-(\d{2})-(\d{2})/.exec(str);
    if (!dateMatch) dateMatch = /(\d{4})(\d{2})(\d{2})/.exec(str);
    if (dateMatch) {
        let year = Number.parseInt(dateMatch[1]);
        let month = Number.parseInt(dateMatch[2]);
        let day = Number.parseInt(dateMatch[3]);
        return DateTime.fromObject({ year, month, day });
    }

    return undefined;
}

// Tag extraction.

/** Parse all subtags out of the given tag. I.e., #hello/i/am would yield [#hello/i/am, #hello/i, #hello]. */
export function extractSubtags(tags: string | Iterable<string>): string[] {
    let result = [];
    for (let tag of typeof tags === "string" ? [tags] : tags) {
        result.push(tag);
        while (tag.includes("/")) {
            tag = tag.substring(0, tag.lastIndexOf("/"));
            result.push(tag);
        }
    }

    return result;
}

/** Split each block and section link into the original link and a corresponding file link. */
export function extractFileLinks(elinks: Link[]): Link[] {
    const result: Link[] = [];
    for (const link of elinks) {
        result.push(link);

        const fileLink = link.toFile();
        if (link.type != "file" && !result.find((existing) => existing.equals(fileLink))) {
            result.push(fileLink);
        }
    }

    return result;
}

// String escaping and canonicalization.

/**
 * Escape regex characters in a string.
 * See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions.
 */
export function escapeRegex(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const HEADER_CANONICALIZER: P.Parser<string> = P.alt(
    P.regex(new RegExp(emojiRegex(), "")),
    P.regex(/[0-9\p{Letter}_-]+/u),
    P.whitespace.map((_) => " "),
    P.any.map((_) => " ")
)
    .many()
    .map((result) => {
        return result.join("").split(/\s+/).join(" ").trim();
    });

/**
 * Normalizes the text in a header to be something that is actually linkable to. This mimics
 * how Obsidian does it's normalization, collapsing repeated spaces and stripping out control characters.
 */
export function normalizeHeaderForLink(header: string): string {
    return HEADER_CANONICALIZER.tryParse(header);
}
