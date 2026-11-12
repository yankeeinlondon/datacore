/**
 * Shapes of the objects the engine indexes. Every indexed object is an `Indexable`; its `$types` list says which of the
 * shapes below it has. Use the type guards in `@yankeeinlondon/datacore-client` (`isMarkdownPage`, `isTask`, …) rather
 * than `instanceof`: objects come from the engine's bundle, not yours.
 *
 * All objects are immutable snapshots. Do not mutate them.
 */
import type { DateTime } from "luxon";
import type { Fieldbearing, FrontmatterEntry, InlineField, LineSpan } from "./fields";
import type { Link, Literal } from "./values";

/** Any indexed object. */
export interface Indexable {
    /** The object types that this indexable is (e.g. `["markdown", "page", …]`). */
    readonly $types: readonly string[];
    /** Textual description of the object, such as `Page` or `Section`. Used in visualizations. */
    readonly $typename: string;
    /** The unique index ID for this object. */
    readonly $id: string;
    /** The indexable object that contains this object, once indexed. */
    readonly $parent?: Indexable;
    /** The index revision this object was stored at (see the revision rule in the API docs). */
    readonly $revision?: number;
    /** The file that this indexable was derived from, if file-backed. */
    readonly $file?: string;
}

/** Objects that can be linked to. */
export interface Linkable {
    /** A link to this object. */
    readonly $link: Link;
}

/** Metadata for any file. */
export interface File extends Linkable {
    /** The path this file exists at. */
    readonly $path: string;
    /** Obsidian-provided date this file was created. */
    readonly $ctime: DateTime;
    /** Obsidian-provided date this file was modified. */
    readonly $mtime: DateTime;
    /** Size of this file in bytes. */
    readonly $size: number;
    /** The extension of the file. */
    readonly $extension: string;
}

/** Objects with tags. */
export interface Taggable {
    /** The exact tags on this object (`#a/b/c`, `#foo/bar`). */
    readonly $tags: readonly string[];
}

/** Objects that link to other things. */
export interface Linkbearing {
    /** The links in this object. */
    readonly $links: readonly Link[];
}

/** Objects whose field values can be read by key. */
export interface Valuebearing {
    /** Fetch a field value by key (case-insensitive), if present. */
    value(key: string): Literal | undefined;
}

/** A markdown file. Index type: `page`. */
export interface MarkdownPage extends Indexable, File, Taggable, Linkbearing, Fieldbearing, Valuebearing {
    readonly $file: string;
    /** Frontmatter values, keyed by lower-case key. */
    readonly $frontmatter?: Readonly<Record<string, FrontmatterEntry>>;
    /** Inline fields anywhere in the page, keyed by lower-case key. */
    readonly $infields: Readonly<Record<string, InlineField>>;
    /** The line span of the whole page. */
    readonly $position: LineSpan;
    /** The sections of the page, in order. */
    readonly $sections: readonly MarkdownSection[];
}

/** A section of a markdown page (a heading and everything under it). Index type: `section`. */
export interface MarkdownSection extends Indexable, Taggable, Linkable, Linkbearing, Fieldbearing, Valuebearing {
    readonly $file: string;
    /** The index of this section in the page. */
    readonly $ordinal: number;
    /** The title of the section; the page title for the implicit first section. */
    readonly $title: string;
    /** The heading level (1–6). */
    readonly $level: number;
    /** The line span of the section. */
    readonly $position: LineSpan;
    /** Blocks in this section, in order. */
    readonly $blocks: readonly MarkdownBlock[];
    /** Inline fields in this section, keyed by lower-case key. */
    readonly $infields: Readonly<Record<string, InlineField>>;
    /** Number of lines in the section. */
    readonly $lineCount: number;
    /** Alias of `$title`. */
    readonly $name: string;
}

/** A block of markdown (paragraph, list, code, …). Index type: `block`. */
export interface MarkdownBlock extends Indexable, Linkbearing, Taggable, Fieldbearing, Valuebearing {
    readonly $file: string;
    /** The index of this block in the file. */
    readonly $ordinal: number;
    /** The line span of the block. */
    readonly $position: LineSpan;
    /** Inline fields in this block, keyed by lower-case key. */
    readonly $infields: Readonly<Record<string, InlineField>>;
    /** The block ID (`^id`), if present. */
    readonly $blockId?: string;
    /** The kind of block (`paragraph`, `list`, `code`, `datablock`, …). */
    readonly $type: string;
    /** A link to this block, if it has a block ID. */
    readonly $link: Link | undefined;
}

/** A list block. Index type: `block-list`. */
export interface MarkdownListBlock extends MarkdownBlock {
    /** The top-level list items. */
    readonly $elements: readonly MarkdownListItem[];
}

/** A code block. Index type: `codeblock`. */
export interface MarkdownCodeblock extends MarkdownBlock {
    /** The languages declared on the fence (may be empty). */
    readonly $languages: readonly string[];
    /** The line span of the code content (excluding fences). */
    readonly $contentPosition: { readonly start: number; readonly end: number };
    /** Whether the code block is fenced or indented. */
    readonly $style: "fenced" | "indent";
}

/** A YAML data block (a code block declaring structured data). Index type: `datablock`. */
export interface MarkdownDatablock extends MarkdownBlock {
    /** The parsed data, keyed by lower-case key. */
    readonly $data: Readonly<Record<string, FrontmatterEntry>>;
}

/** A list item. Index type: `list-item`. */
export interface MarkdownListItem extends Indexable, Linkbearing, Taggable, Fieldbearing, Valuebearing {
    readonly $file: string;
    /** The line span of the item. */
    readonly $position: LineSpan;
    /** Child list items. */
    readonly $elements: readonly MarkdownListItem[];
    /** The kind of item (`list` or `task`). */
    readonly $type: string;
    /** Inline fields on this item, keyed by lower-case key. */
    readonly $infields: Readonly<Record<string, InlineField>>;
    /** The block ID (`^id`), if present. */
    readonly $blockId?: string;
    /** The line of the parent item, or a negative value for top-level items. */
    readonly $parentLine: number;
    /** The list marker (`-`, `*`, `1.`, …). */
    readonly $symbol?: string;
    /** The raw text of the item. */
    readonly $text?: string;
    /** The first line of the item. */
    readonly $line: number;
    /** Number of lines in the item. */
    readonly $lineCount: number;
    /** The text with inline fields, block IDs and surrounding whitespace removed. */
    readonly $cleantext: string;
}

/** A task (a list item with a checkbox). Index type: `task`. */
export interface MarkdownTaskItem extends MarkdownListItem {
    /** The checkbox character (` `, `x`, `-`, …). */
    readonly $status: string;
    /** True if the status is `x` or `X`. */
    readonly $completed: boolean;
}

/** Position of a canvas card. */
export interface CardPos {
    readonly x: number;
    readonly y: number;
}

/** Size of a canvas card. */
export interface CardDimensions {
    readonly width: number;
    readonly height: number;
}

/** Shared shape of canvas cards. Index type: `canvas-card`. */
export interface BaseCanvasCard extends Indexable, Linkable {
    readonly $file: string;
    readonly $type: string;
    readonly $position: CardPos;
    readonly $dimensions: CardDimensions;
    readonly $color?: string;
}

/** A canvas card containing markdown. Index type: `canvas-text-card`. */
export interface CanvasTextCard extends BaseCanvasCard, Linkbearing, Taggable, Fieldbearing {
    readonly $title: string;
    readonly $infields: Readonly<Record<string, InlineField>>;
    readonly $frontmatter?: Readonly<Record<string, FrontmatterEntry>>;
    readonly $sections: readonly MarkdownSection[];
}

/** A canvas card embedding a file. Index type: `canvas-file-card`. */
export interface CanvasFileCard extends BaseCanvasCard {
    /** The path of the embedded file. */
    readonly $linkedFile: string;
}

/** A canvas card embedding a web page. Index type: `canvas-web-card`. */
export interface CanvasWebCard extends BaseCanvasCard {
    /** The embedded URL. */
    readonly $url: string;
}

/** Any canvas card. */
export type CanvasCard = CanvasTextCard | CanvasFileCard | CanvasWebCard;

/** A canvas file. Index type: `canvas`. */
export interface Canvas extends Indexable, File, Linkbearing, Taggable, Fieldbearing {
    readonly $file: string;
    /** The cards on the canvas. */
    readonly $cards: readonly BaseCanvasCard[];
    /** Inline fields in text cards, keyed by lower-case key. */
    readonly $infields: Readonly<Record<string, InlineField>>;
}

/** Any other file in the vault (not markdown or canvas). Index type: `file`. */
export interface GenericFile extends Indexable, File, Fieldbearing {
    readonly $file: string;
}
