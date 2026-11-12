/** Fields: named values on indexed objects, and where they came from. */
import type { Literal } from "./values";

/** A span of lines in a file (0-indexed, end exclusive). */
export interface LineSpan {
    readonly start: number;
    readonly end: number;
}

/** The source of a field, used when determining what files to overwrite and how. */
export type Provenance =
    | { readonly type: "frontmatter"; readonly file: string; readonly key: string; readonly revision: number }
    | {
          readonly type: "inline-field";
          readonly file: string;
          readonly line: number;
          readonly key: string;
          readonly revision: number;
      }
    | { readonly type: "intrinsic"; readonly file: string; readonly revision: number };

/** A field: key, value, and provenance (which makes it editable). */
export interface Field {
    /** The canonical key name for the field (as it actually shows up in the data structure). */
    readonly key: string;
    /** The value of the field. */
    readonly value: Literal;
    /** The raw value of the field before parsing, if relevant. */
    readonly raw?: string;
    /** Where the field came from in precise detail, allowing the field to be edited. */
    readonly provenance: Provenance;
}

/** Objects annotated with fields. */
export interface Fieldbearing {
    /** All fields on this object. */
    readonly fields: readonly Field[];
    /** Fetch a field by key (case-insensitive), if present. */
    field(key: string): Field | undefined;
}

/** A frontmatter (YAML) entry. */
export interface FrontmatterEntry {
    /** The actual key used in the frontmatter. */
    readonly key: string;
    /** The parsed value of the frontmatter entry. */
    readonly value: Literal;
    /** The raw value of the frontmatter entry before parsing. */
    readonly raw: string;
}

/** An inline field (`key:: value`). */
export interface InlineField {
    /** The actual key describing the inline field. */
    readonly key: string;
    /** The raw value of the inline field. */
    readonly raw: string;
    /** The parsed value. */
    readonly value: Literal;
    /** Full position information for where the inline field is located in the document. */
    readonly position: {
        /** The line number the inline field appears on. */
        readonly line: number;
        /** The start column of the field. */
        readonly start: number;
        /** The start column of the *value* for the field. Immediately after the '::'. */
        readonly startValue: number;
        /** The end column of the field. */
        readonly end: number;
    };
    /** If this inline field was defined via a wrapping ('[' or '('), then the wrapping that was used. */
    readonly wrapping?: string;
}
