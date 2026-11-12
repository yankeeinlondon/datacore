/** Values produced and consumed by the query engine. */
import type { DateTime, Duration } from "luxon";

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

/** An object of literal values. */
export interface DataObject {
    [key: string]: Literal;
}

/** Any value the query engine works with. */
export type Literal =
    | boolean
    | number
    | string
    | DateTime
    | Duration
    | Link
    | Array<Literal>
    | DataObject
    // oxlint-disable-next-line typescript/no-unsafe-function-type -- lambdas and functions are first-class literals
    | Function
    | null;

/** Serialized form of a link. */
export interface JsonLink {
    /** The file path this link points to. */
    path: string;
    /** The display name associated with the link. */
    display?: string;
    /** The block ID or header this link points to within a file, if relevant. */
    subpath?: string;
    /** Is this link an embedded link (`![[...]]`)? */
    embed: boolean;
    /** The type of this link, which determines what `subpath` refers to, if anything. */
    type: "file" | "header" | "block";
}

/**
 * A link to a file, header, or block. Links are immutable; the `with*` methods return new links.
 *
 * Links are created by the engine (`dc.fileLink()`, `dc.parseLink()`, …). Identify them with `isLink()` from
 * `@yankeeinlondon/datacore-client`, never with `instanceof`.
 */
export interface Link {
    readonly path: string;
    readonly display?: string;
    readonly subpath?: string;
    readonly embed: boolean;
    readonly type: "file" | "header" | "block";

    /** Update this link with a new path. */
    withPath(path: string): Link;
    /** Return a new link which points to the same location but with a new display value. */
    withDisplay(display?: string): Link;
    /** Return a new link which has the given embedded status. */
    withEmbed(embed: boolean): Link;
    /** Convert a file link into a link to a specific header. */
    withHeader(header: string): Link;
    /** Convert a file link into a link to a specific block. */
    withBlock(block: string): Link;
    /** Checks for link equality (i.e., that the links are pointing to the same exact location). */
    equals(other: Link): boolean;
    /** Convert this link to its markdown representation. */
    toString(): string;
    /** Convert this link to a raw object which is serialization-friendly. */
    toObject(): JsonLink;
    /** Convert any link into a link to its file. */
    toFile(): Link;
    /** Convert this link into an embedded link. */
    toEmbed(): Link;
    /** Convert this link into a non-embedded link. */
    fromEmbed(): Link;
    /** Convert this link to markdown so it can be rendered. */
    markdown(): string;
    /** Obtain the display for this link if present, or return a simple default display. */
    displayOrDefault(): string;
    /** Convert the inner part of the link to something that Obsidian can open / understand. */
    obsidianLink(): string;
    /** The stripped name of the file this link points to. */
    fileName(): string;
}
