/**
 * @module api
 */
import type {
    Coerce,
    DataArray,
    DatacoreApi,
    DatacoreLocalQueryApi,
    Expression,
    Indexable,
    IndexQuery,
    Link,
    Literal,
    MarkdownPage,
    Result,
    SearchResult,
} from "@yankeeinlondon/datacore-contract";
import { PreactViewApi } from "./api";
import { App } from "obsidian";
import { useFileMetadata, useFullQuery, useIndexUpdates, useInterning, useQuery } from "../ui/hooks";
import type * as luxon from "luxon";
import * as preact from "preact";
import * as hooks from "preact/hooks";
import { Group, Stack } from "./ui/layout";
import { Embed, LineSpanEmbed } from "./ui/embed";
import { CURRENT_FILE_CONTEXT, ErrorMessage, Lit, Markdown, ObsidianLink } from "../ui/markdown";
import { type CSSProperties } from "preact/compat";
import { Button, Checkbox, Icon, Slider, Switch, Textbox, VanillaSelect } from "./ui/basics";
import { TableView } from "./ui/views/table";
import { Callout } from "./ui/views/callout";
import { ScriptCache } from "./script-cache";
import { isHostModule } from "../ui/scripting";
import { Card } from "./ui/views/cards";
import { ListView } from "./ui/views/list";

/**
 * Local API provided to specific codeblocks when they are executing.
 * @public
 */
export class DatacoreLocalApi {
    /** The engine (contract API only). */
    private readonly engine: DatacoreApi;
    /** The engine's query API scoped to this script's file. */
    private readonly local: DatacoreLocalQueryApi;
    /** Loads other scripts for `dc.require`. */
    private readonly scriptCache: ScriptCache;

    public constructor(
        public api: PreactViewApi,
        public path: string
    ) {
        this.engine = api.services.engine;
        this.local = this.engine.local(path);
        this.scriptCache = new ScriptCache({
            resolveLink: (link) => this.engine.resolveLink(link),
            vault: api.services.app.vault,
        });
        this.coerce = this.engine.coerce;
    }

    /** The current file path for the local API. */
    public currentPath(): string {
        return this.path;
    }

    /** The full markdown file metadata for the current file. */
    public currentFile<T extends MarkdownPage = MarkdownPage>(): T {
        return this.local.currentFile<T>()!;
    }

    /** Get access to luxon functions (the engine's copy, so values match engine values). */
    get luxon(): typeof luxon {
        return this.engine.luxon;
    }

    /** Get access to preact functions. */
    get preact(): typeof preact {
        return preact;
    }

    /** Central Obsidian app object. */
    get app(): App {
        return this.api.services.app;
    }

    //////////////////////////////
    // Script loading utilities //
    //////////////////////////////

    /**
     * Asynchronously load a javascript block from the given path or link; you can either load from JS/TS/JSX/TSX files
     * directly, or from codeblocks by loading from the section the codeblock is inside of. There are a few stipulations
     * to loading:
     * - You cannot load cyclical dependencies.
     * - This is similar to vanilla js `require()`, not `import ... `. Your scripts you are requiring need to explicitly
     *   return the things they are exporting, like the example below. The `export` keyword does not work.
     *
     * ```js
     * function MyElement() {
     *  ...
     * }
     *
     * return { MyElement };
     * ```
     *
     * Host-provided modules can also be required by name: `obsidian`, `electron`, `@codemirror/*`, `@lezer/*`, and
     * Node built-ins such as `fs` or `node:path` (Node built-ins and Electron are only available on desktop).
     */
    public async require(path: string | Link): Promise<unknown> {
        if (typeof path === "string" && isHostModule(path)) {
            try {
                return require(path);
            } catch (error) {
                throw new Error(`Datacore: failed to require host module '${path}': ${String(error)}`);
            }
        }

        const result = await this.scriptCache.load(path, { dc: this });
        return result.orElseThrow();
    }

    ///////////////////////
    // General utilities //
    ///////////////////////

    /** Utilities for coercing types into one specific type for easier programming. */
    public coerce: Coerce;

    /** Resolve a local or absolute path or link to an absolute path. */
    public resolvePath(path: string | Link, sourcePath?: string): string {
        return this.local.resolvePath(path, sourcePath);
    }

    /** Resolve a link (or link text) to the indexed object it points to (file, section, or block). */
    public resolveLink(link: string | Link, sourcePath?: string): Indexable | undefined {
        return this.local.resolveLink(link, sourcePath);
    }

    /** Try to parse the given query, returning a monadic success/failure result. */
    public tryParseQuery(query: string | IndexQuery): Result<IndexQuery, string> {
        return this.local.tryParseQuery(query);
    }

    /** Try to parse the given query, throwing an error if it is invalid. */
    public parseQuery(query: string | IndexQuery): IndexQuery {
        return this.local.parseQuery(query);
    }

    /** Create a file link pointing to the given path. */
    public fileLink(path: string): Link {
        return this.local.fileLink(path);
    }

    /** Create a link to a header with the given name. */
    public headerLink(path: string, header: string): Link {
        return this.local.headerLink(path, header);
    }

    /** Create a link to a block with the given path and block ID. */
    public blockLink(path: string, block: string): Link {
        return this.local.blockLink(path, block);
    }

    /** Try to parse the given link, throwing an error if it is invalid. */
    public parseLink(linktext: string): Link {
        return this.local.parseLink(linktext);
    }

    /** Try to parse a link, returning a monadic success/failure result. */
    public tryParseLink(linktext: string): Result<Link, string> {
        return this.local.tryParseLink(linktext);
    }

    /** Build a link from bare link text, without brackets: `Note`, `Note#Header`, `Note#^block`, optional `|Display`. */
    public inferLink(linktext: string): Link {
        return this.local.inferLink(linktext);
    }

    /** Create a data array from a regular array. */
    public array<T>(input: T[] | DataArray<T>): DataArray<T> {
        return this.local.array(input);
    }

    /** Evaluate an expression and return its evaluated value, throwing an exception on failure. */
    public evaluate(
        expression: string | Expression,
        variables?: Record<string, Literal>,
        sourcePath?: string
    ): Literal {
        return this.local.evaluate(expression, variables, sourcePath);
    }

    /** Evaluate an expression and return its evaluated value. */
    public tryEvaluate(
        expression: string | Expression,
        variables?: Record<string, Literal>,
        sourcePath?: string
    ): Result<Literal, string> {
        return this.local.tryEvaluate(expression, variables, sourcePath);
    }

    /////////////
    // Queries //
    /////////////

    /** Execute a textual or typed index query, returning all results. */
    public query<T extends Indexable = Indexable>(query: string | IndexQuery): T[] {
        return this.local.query<T>(query);
    }

    /** Execute a textual or typed index query, returning all results. */
    public tryQuery<T extends Indexable = Indexable>(query: string | IndexQuery): Result<T[], string> {
        return this.local.tryQuery<T>(query);
    }

    /** Execute a textual or typed index query, returning results plus performance metadata. */
    public fullquery<T extends Indexable = Indexable>(query: string | IndexQuery): SearchResult<T> {
        return this.local.fullquery<T>(query);
    }

    /** Execute a textual or typed index query, returning results plus performance metadata. */
    public tryFullQuery<T extends Indexable = Indexable>(query: string | IndexQuery): Result<SearchResult<T>, string> {
        return this.local.tryFullQuery<T>(query);
    }

    /////////////
    //  Hooks  //
    /////////////

    // Export the common preact hooks for people to use via `dc.`:
    public useState = hooks.useState;
    public useCallback = hooks.useCallback;
    public useReducer = hooks.useReducer;
    public useMemo = hooks.useMemo;
    public useEffect = hooks.useEffect;
    public createContext = preact.createContext;
    public useContext = hooks.useContext;
    public useRef = hooks.useRef;

    /** Memoize the input automatically and process it using a DataArray; returns a vanilla array back. */
    public useInterning = useInterning;

    /** Memoize the input automatically and process it using a DataArray; returns a vanilla array back. */
    public useArray<T, U>(
        input: T[] | DataArray<T>,
        process: (data: DataArray<T>) => DataArray<U>,
        deps?: unknown[]
    ): U[] {
        return hooks.useMemo(() => process(this.engine.array(input)).array(), [input, ...(deps ?? [])]);
    }

    /** Use the file metadata for the current file. Automatically updates the view when the current file metadata changes. */
    public useCurrentFile<T extends MarkdownPage = MarkdownPage>(settings?: { debounce?: number }): T {
        return useFileMetadata(this.engine, this.path, settings) as T;
    }

    /** Use the current path. Automatically updates the view if the path changes (though that would be weird). */
    public useCurrentPath(_settings?: { debounce?: number }): string {
        return this.path;
    }

    /** Use the file metadata for a specific file. Automatically updates the view when the file changes. */
    public useFile<T extends Indexable = Indexable>(path: string, settings?: { debounce?: number }): T | undefined {
        return useFileMetadata(this.engine, path, settings) as T | undefined;
    }

    /** Automatically refresh the view whenever the index updates; returns the latest index revision ID. */
    public useIndexUpdates(settings?: { debounce?: number }): number {
        return useIndexUpdates(this.engine, settings);
    }

    /**
     * Run a query, automatically re-running it whenever the vault changes. Returns more information about the query
     * execution, such as index revision and total search duration.
     */
    public useFullQuery<T extends Indexable = Indexable>(
        query: string | IndexQuery,
        settings?: { debounce?: number }
    ): SearchResult<T> {
        return useFullQuery(this.engine, this.parseQuery(query), settings) as SearchResult<T>;
    }

    /** Run a query, automatically re-running it whenever the vault changes. */
    public useQuery<T extends Indexable = Indexable>(
        query: string | IndexQuery,
        settings?: { debounce?: number }
    ): T[] {
        // Hooks need to be called in a consistent order, so we don't nest the `useQuery` call in the DataArray.wrap _just_ in case.
        return useQuery(this.engine, this.parseQuery(query), settings) as T[];
    }

    /////////////////////
    // Visual Elements //
    /////////////////////

    /** Vertical flexbox container; good for putting items together in a column. */
    public Stack = Stack;
    /** Horizontal flexbox container; good for putting items together in a row. */
    public Group = Group;

    /** Renders a literal value in a pretty way that respects settings. */
    public Literal = (({ value, sourcePath, inline }: { value: Literal; sourcePath?: string; inline?: boolean }) => {
        const implicitSourcePath = hooks.useContext(CURRENT_FILE_CONTEXT);
        return <Lit value={value} sourcePath={sourcePath ?? implicitSourcePath ?? this.path} inline={inline} />;
    }).bind(this);

    /** Renders markdown using the Obsidian markdown renderer, optionally attaching additional styles. */
    public Markdown = (({
        content,
        sourcePath,
        inline,
        style,
        className,
    }: {
        content: string;
        sourcePath?: string;
        inline?: boolean;
        style?: CSSProperties;
        className?: string;
    }) => {
        const implicitSourcePath = hooks.useContext(CURRENT_FILE_CONTEXT);
        return (
            <Markdown
                content={content}
                sourcePath={sourcePath ?? implicitSourcePath ?? this.path}
                inline={inline}
                style={style}
                cls={className}
            />
        );
    }).bind(this);

    /** Renders an obsidian-style link directly and more efficiently than rendering markdown. */
    public Link = ObsidianLink;

    /** Create a vanilla Obsidian embed for the given link. */
    public LinkEmbed = (({
        link,
        inline,
        sourcePath,
    }: {
        link: string | Link;
        inline?: boolean;
        sourcePath?: string;
    }) => {
        const realLink = hooks.useMemo(() => (typeof link === "string" ? this.engine.fileLink(link) : link), [link]);
        const implicitSourcePath = hooks.useContext(CURRENT_FILE_CONTEXT);
        return (
            <Embed
                link={realLink}
                inline={inline ?? false}
                sourcePath={sourcePath ?? implicitSourcePath ?? this.path}
            />
        );
    }).bind(this);

    /** Create an explicit 'span' embed which extracts a span of lines from a markdown file. */
    public SpanEmbed = (({
        path,
        start,
        end,
        explain,
        showExplain,
        sourcePath: maybeSourcePath,
    }: {
        path: string;
        sourcePath?: string;
        explain?: string;
        showExplain?: boolean;
        start: number;
        end: number;
    }) => {
        // Resolve the path to the correct path if a source path is provided.
        const sourcePath = maybeSourcePath ?? this.path;
        const resolvedPath = hooks.useMemo(() => this.resolvePath(path, sourcePath), [path, sourcePath]);

        return (
            <LineSpanEmbed path={resolvedPath} start={start} end={end} explain={explain} showExplain={showExplain} />
        );
    }).bind(this);

    /** Renders an obsidian lucide icon. */
    public Icon = Icon;

    /**
     * Generate an embed of the given markdown element. Useful to pass to the 'renderer' prop of various views
     * to efficiently render embeds of various elements.
     *
     * For example, `dc.embed(<file>)` will produce a file embedding, and `dc.embed(<section>)` will produce a section embedding.
     */
    public embed = ((element: Indexable) => {
        // TODO: We should add embeds as a new tag on indexable types and add an embedding abstraction.
        // For now, it's fairly useful enough to just hardcode some useful things that are embeddable.
        if (element.$types.includes("markdown") && element.$file && "$position" in element) {
            const { start, end } = element.$position as { start: number; end: number };
            if (typeof start !== "number" || typeof end !== "number")
                return (
                    <ErrorMessage
                        message={`Invalid $position field '${JSON.stringify(element.$position)}' for element '${
                            element.$id
                        }' from '${element.$file}'`}
                    />
                );

            return <this.SpanEmbed path={element.$file} start={start} end={end} />;
        }

        return <ErrorMessage message={`No valid embedding for element '${element.$id}' from '${element.$file}'`} />;
    }).bind(this);

    ///////////
    // Views //
    ///////////

    /** @deprecated - Use just `Table` instead. */
    public VanillaTable = TableView;
    /** A simple and configurable table view that supports rendering paged and grouped data. */
    public Table = TableView;

    /** A simple and configurable list view that supports rendering paged and grouped data. */
    public List = ListView;
    /** A single card which can be composed into a grid view. */
    public Card = Card;

    /////////////////////////
    // Interative elements //
    /////////////////////////

    public Button = Button;
    public Textbox = Textbox;
    public Callout = Callout;
    public Checkbox = Checkbox;
    public Slider = Slider;
    public Switch = Switch;
    public VanillaSelect = VanillaSelect;
}
