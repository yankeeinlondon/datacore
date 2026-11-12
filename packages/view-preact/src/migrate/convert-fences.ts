/**
 * Upstream Datacore's code block languages and their replacements (Engine Room spec §9.3). The `datacore*` names are
 * left to upstream Datacore, so both plugins can run side by side.
 */
export const LANGUAGE_RENAMES: Readonly<Record<string, string>> = {
    datacorejs: "dc",
    datacorets: "dct",
    datacorejsx: "dcx",
    datacoretsx: "dctx",
};

/** One rewritten opening fence. */
export interface FenceChange {
    /** 1-based line number of the opening fence. */
    line: number;
    /** The language before conversion, e.g. `datacorejsx`. */
    from: string;
    /** The language after conversion, e.g. `dcx`. */
    to: string;
}

/** The result of {@link convertFences}. */
export interface FenceConversion {
    /** The converted text; identical to the input when `changes` is empty. */
    text: string;
    /** Every rewritten fence, in document order. */
    changes: FenceChange[];
}

/** An open fenced code block. */
interface OpenFence {
    /** `` ` `` or `~`. */
    marker: string;
    /** Length of the opening run; a closing fence must be at least this long. */
    length: number;
    /** Number of blockquote markers (`>`) the fence sits inside. */
    depth: number;
}

/** Blockquote/callout markers at the start of a line: `>` with up to 3 spaces before it and an optional space after. */
const QUOTE_MARKER = /^ {0,3}>[ \t]?/;

/** A fence line (after its blockquote prefix): indentation, a run of 3+ backticks or tildes, and the rest. */
const FENCE = /^([ \t]*)(`{3,}|~{3,})(.*)$/;

/** Splits off up to `limit` blockquote markers; returns the prefix, the rest, and how many markers were found. */
function splitQuotePrefix(
    line: string,
    limit = Number.POSITIVE_INFINITY
): { prefix: string; rest: string; depth: number } {
    let rest = line;
    let depth = 0;
    while (depth < limit) {
        const match = QUOTE_MARKER.exec(rest);
        if (!match) break;
        rest = rest.slice(match[0].length);
        depth += 1;
    }
    return { prefix: line.slice(0, line.length - rest.length), rest, depth };
}

/**
 * Rewrites the language of every top-level `datacore*` fenced code block to its `dc*` name
 * (`datacorejs→dc`, `datacorets→dct`, `datacorejsx→dcx`, `datacoretsx→dctx`).
 *
 * A line-based fence scanner:
 * - backtick and tilde fences of any length (3+), at any indentation (fences inside list items are indented);
 * - fences inside blockquotes and callouts (`> `, nested `> > `); a fence opened inside a blockquote ends where the
 *   blockquote does;
 * - only the opening fence's info string changes, and only its first word; anything after it (attributes, titles)
 *   and the original whitespace and line endings (LF or CRLF) are kept;
 * - fences nested inside another fence are content, not code blocks, and are never touched (e.g. a `datacorejsx`
 *   example inside a ````` ````markdown ````` block).
 *
 * Pure and idempotent: converting converted text changes nothing.
 */
export function convertFences(text: string): FenceConversion {
    // Odd indices hold the line endings, so joining the parts restores the text exactly.
    const parts = text.split(/(\r?\n)/);
    const changes: FenceChange[] = [];
    let open: OpenFence | undefined;

    for (let index = 0; index < parts.length; index += 2) {
        const line = parts[index] ?? "";

        if (open) {
            const { rest, depth } = splitQuotePrefix(line, open.depth);
            // A blockquote ending also ends the fence inside it; the line is then scanned as a new block below.
            if (depth >= open.depth) {
                const fence = FENCE.exec(rest);
                const closes =
                    fence !== null &&
                    fence[2]?.[0] === open.marker &&
                    (fence[2]?.length ?? 0) >= open.length &&
                    (fence[3] ?? "").trim() === "";
                if (closes) open = undefined;
                continue;
            }
            open = undefined;
        }

        const { prefix, rest, depth } = splitQuotePrefix(line);
        const fence = FENCE.exec(rest);
        if (!fence) continue;

        const [, indent = "", run = "", info = ""] = fence;
        const marker = run[0] ?? "`";
        // A backtick fence's info string cannot contain backticks (that would be inline code, not a fence).
        if (marker === "`" && info.includes("`")) continue;
        open = { marker, length: run.length, depth };

        const language = /^([ \t]*)(\S+)(.*)$/.exec(info);
        if (!language) continue;
        const [, gap = "", word = "", after = ""] = language;
        const renamed = Object.prototype.hasOwnProperty.call(LANGUAGE_RENAMES, word)
            ? LANGUAGE_RENAMES[word]
            : undefined;
        if (renamed === undefined) continue;

        parts[index] = `${prefix}${indent}${run}${gap}${renamed}${after}`;
        changes.push({ line: index / 2 + 1, from: word, to: renamed });
    }

    return { text: changes.length === 0 ? text : parts.join(""), changes };
}
