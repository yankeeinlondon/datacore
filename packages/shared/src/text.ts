/** Pure path and line-range helpers for vault paths and note text. */

// Paths.

/** Get the folder containing the given path (i.e., like computing 'path/..'). */
export function getParentFolder(path: string): string {
    return path.split("/").slice(0, -1).join("/");
}

/** Get the file name for the file referenced in the given path, by stripping the parent folders. */
export function getFileName(path: string): string {
    return path.includes("/") ? path.substring(path.lastIndexOf("/") + 1) : path;
}

/** Get the "title" for a file, by stripping other parts of the path as well as the extension. */
export function getFileTitle(path: string): string {
    if (path.includes("/")) path = path.substring(path.lastIndexOf("/") + 1);
    if (path.endsWith(".md")) path = path.substring(0, path.length - 3);
    return path;
}

/** Get the extension of a file from the file path. */
export function getExtension(path: string): string {
    if (!path.includes(".")) return "";
    return path.substring(path.lastIndexOf(".") + 1);
}

// Fast extraction of line ranges from large pieces of text.

/** Update the line range from [start, end) with the given function. */
export function lineReplace(text: string, start: number, end: number, func: (line: string) => string): string {
    const [data, offset] = lineSpan(text, start, end);
    if (!offset) return text;

    return (
        data.substring(0, offset.start) + func(data.substring(offset.start, offset.end)) + data.substring(offset.end)
    );
}

/** Extract the lines in the range [start, end), as well as the actual offsets of the start and end. */
export function lineSpan(
    text: string,
    start: number,
    end: number
): [string, { start: number; end: number } | undefined] {
    start = Math.max(start, 0);
    end = Math.max(end, 0);

    if (start >= end) return ["", undefined];

    // Start by finding the starting line offset.
    const startOffset = skipNewlines(text, 0, start);
    if (startOffset == -1) return ["", undefined];

    const endOffset = skipNewlines(text, startOffset, end - start);
    if (endOffset == -1) return [text.substring(startOffset), { start: startOffset, end: text.length }];
    else return [text.substring(startOffset, endOffset - 1), { start: startOffset, end: endOffset - 1 }];
}

/** Extract the lines in the range [start, end). Start is inclusive, end is exclusive. */
export function lineRange(text: string, start: number, end: number): string {
    return lineSpan(text, start, end)[0];
}

/** Skip {count} total newlines, returning the start of the line {count} lines after the current line. If count is 0, the initial offset is returned. */
export function skipNewlines(text: string, start: number, count: number): number {
    if (count == 0) return start;

    let position = start;
    while (count > 0) {
        position = text.indexOf("\n", position);
        if (position == -1) return -1;

        count--;
        position += 1;
    }

    return position;
}
