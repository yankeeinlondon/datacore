/**
 * Builds markdown notes together with the Obsidian `CachedMetadata` that Obsidian would produce for them.
 *
 * The engine's importer is a pure function of (file text, CachedMetadata). Generating both from one description keeps
 * positions exact by construction, without re-implementing Obsidian's markdown parser. Inline fields are not modelled:
 * the engine parses those from the raw text itself.
 */
import type { CachedMetadata, Loc, Pos } from "obsidian";
import { stringify } from "yaml";

/** A list item: plain text, or text with a task status and/or nested children. */
export type ListItemSpec = string | { text: string; task?: string; children?: ListItemSpec[] };

/** A built note: vault path, file contents, and the matching Obsidian metadata. */
export interface BuiltNote {
    path: string;
    content: string;
    metadata: CachedMetadata;
}

const TAG_PATTERN = /(?<=^|\s)#[\p{L}\p{N}_/-]+/gu;
const LINK_PATTERN = /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g;
const BLOCK_ID_PATTERN = /\s\^([A-Za-z0-9-]+)\s*$/;

interface Section {
    type: string;
    start: number;
    end: number;
    id?: string;
}

/** Fluent builder for a single markdown note. */
export class NoteBuilder {
    private readonly lines: string[] = [];
    private readonly sections: Section[] = [];
    private readonly headings: { heading: string; level: number; line: number }[] = [];
    private readonly listItems: { line: number; parent: number; task?: string; id?: string }[] = [];
    private frontmatterData: Record<string, unknown> | undefined;
    /** Lines whose tags/links should not be recorded (frontmatter, code). */
    private readonly opaqueLines = new Set<number>();

    public constructor(public readonly path: string) {}

    /** Add YAML frontmatter. Must be called before any other content. */
    public frontmatter(data: Record<string, unknown>): this {
        if (this.lines.length > 0) throw new Error("frontmatter must come first");
        this.frontmatterData = data;
        const yamlLines = stringify(data).trimEnd().split("\n");
        const start = this.lines.length;
        this.push("---", ...yamlLines, "---");
        for (let line = start; line < this.lines.length; line++) this.opaqueLines.add(line);
        this.sections.push({ type: "yaml", start, end: this.lines.length - 1 });
        return this;
    }

    /** Add a heading. */
    public heading(level: number, text: string): this {
        this.separate();
        const line = this.lines.length;
        this.push(`${"#".repeat(level)} ${text}`);
        this.headings.push({ heading: text, level, line });
        this.sections.push({ type: "heading", start: line, end: line });
        return this;
    }

    /** Add a paragraph (one or more lines). A trailing ` ^id` sets the block id. */
    public paragraph(...text: string[]): this {
        this.separate();
        const start = this.lines.length;
        this.push(...text);
        const id = BLOCK_ID_PATTERN.exec(text[text.length - 1] ?? "")?.[1];
        this.sections.push({ type: "paragraph", start, end: this.lines.length - 1, id });
        return this;
    }

    /** Add a list. Items with `task` render as `- [task] text`. */
    public list(...items: ListItemSpec[]): this {
        this.separate();
        const start = this.lines.length;
        const addItems = (specs: ListItemSpec[], depth: number, parent: number) => {
            for (const spec of specs) {
                const item = typeof spec === "string" ? { text: spec } : spec;
                const line = this.lines.length;
                const marker = item.task !== undefined ? `- [${item.task}] ` : "- ";
                this.push(`${"\t".repeat(depth)}${marker}${item.text}`);
                const id = BLOCK_ID_PATTERN.exec(item.text)?.[1];
                this.listItems.push({ line, parent, task: item.task, id });
                if (item.children) addItems(item.children, depth + 1, line);
            }
        };
        // Obsidian marks top-level items with a negative parent; the importer recovers the list start as -parent - 1.
        addItems(items, 0, -(start + 1));
        this.sections.push({ type: "list", start, end: this.lines.length - 1 });
        return this;
    }

    /** Add a fenced code block. */
    public code(language: string, ...body: string[]): this {
        this.separate();
        const start = this.lines.length;
        this.push("```" + language, ...body, "```");
        for (let line = start; line < this.lines.length; line++) this.opaqueLines.add(line);
        this.sections.push({ type: "code", start, end: this.lines.length - 1 });
        return this;
    }

    /** Produce the note text and its metadata. */
    public build(): BuiltNote {
        const content = this.lines.join("\n");
        const offsets: number[] = [];
        let offset = 0;
        for (const line of this.lines) {
            offsets.push(offset);
            offset += line.length + 1;
        }

        const loc = (line: number, col: number): Loc => ({ line, col, offset: (offsets[line] ?? 0) + col });
        const lineSpan = (start: number, end: number): Pos => ({
            start: loc(start, 0),
            end: loc(end, this.lines[end]?.length ?? 0),
        });

        const metadata: CachedMetadata = {
            sections: this.sections.map((section) => ({
                type: section.type,
                position: lineSpan(section.start, section.end),
                ...(section.id ? { id: section.id } : {}),
            })),
            headings: this.headings.map((heading) => ({
                heading: heading.heading,
                level: heading.level,
                position: lineSpan(heading.line, heading.line),
            })),
            listItems: this.listItems.map((item) => ({
                parent: item.parent,
                position: lineSpan(item.line, item.line),
                ...(item.task !== undefined ? { task: item.task } : {}),
                ...(item.id ? { id: item.id } : {}),
            })),
            tags: [],
            links: [],
        };

        this.lines.forEach((text, line) => {
            if (this.opaqueLines.has(line)) return;
            for (const match of text.matchAll(TAG_PATTERN)) {
                const col = match.index ?? 0;
                metadata.tags!.push({
                    tag: match[0],
                    position: { start: loc(line, col), end: loc(line, col + match[0].length) },
                });
            }
            for (const match of text.matchAll(LINK_PATTERN)) {
                const col = match.index ?? 0;
                const target = match[1]!;
                metadata.links!.push({
                    link: target,
                    original: match[0],
                    ...(match[2] ? { displayText: match[2] } : {}),
                    position: { start: loc(line, col), end: loc(line, col + match[0].length) },
                });
            }
        });

        if (this.frontmatterData) {
            const yamlSection = this.sections.find((section) => section.type === "yaml")!;
            metadata.frontmatter = { ...this.frontmatterData };
            metadata.frontmatterPosition = lineSpan(yamlSection.start, yamlSection.end);
        }

        return { path: this.path, content, metadata };
    }

    private push(...lines: string[]): void {
        this.lines.push(...lines);
    }

    /** Separate blocks with a blank line, as markdown requires. */
    private separate(): void {
        if (this.lines.length > 0) this.lines.push("");
    }
}

/** Start building a note at the given vault path (e.g. `"Books/Dune.md"`). */
export function note(path: string): NoteBuilder {
    return new NoteBuilder(path);
}
