/** UI-free query, link, and expression API shared by the engine API and the legacy script API. */
import type * as Contract from "@yankeeinlondon/datacore-contract";
import { Variables } from "expression/evaluator";
import { Expression } from "expression/expression";
import { Link } from "expression/link";
import { Literal, Literals } from "expression/literal";
import { EXPRESSION, PRIMITIVES } from "expression/parser";
import { QUERY } from "expression/parser";
import { Datacore } from "index/datacore";
import { IndexQuery } from "index/types/index-query";
import { MarkdownPage } from "index/types/markdown";
import * as luxon from "luxon";
import Parsimmon from "parsimmon";
import { Coerce } from "./coerce";
import { DataArray } from "./data-array";
import { DatacoreError } from "./errors";
import { Result } from "./result";

/** Querying, links, expressions and utilities over a Datacore instance. */
export class QueryApi implements Contract.DatacoreQueryApi {
    public constructor(public core: Datacore) {}

    /** Get access to luxon functions. */
    get luxon(): typeof luxon {
        return luxon;
    }

    /////////////////////////
    // Querying + Fetching //
    /////////////////////////

    /** Load a markdown file by full path or link. */
    public page<T extends Contract.MarkdownPage = Contract.MarkdownPage>(path: string | Link): T | undefined;
    public page(path: string | Link): MarkdownPage | undefined {
        const realPath = Literals.isLink(path) ? path.path : path;

        return this.core.datastore.load(realPath) as MarkdownPage | undefined;
    }

    /** Execute a textual or typed index query, returning all results. */
    public query<T extends Contract.Indexable = Contract.Indexable>(query: string | IndexQuery): T[];
    public query(query: string | IndexQuery): Contract.Indexable[] {
        return orThrow(this.tryQuery(query), "invalid-query");
    }

    /** Execute a textual or typed index query, returning all results. */
    public tryQuery<T extends Contract.Indexable = Contract.Indexable>(query: string | IndexQuery): Result<T[], string>;
    public tryQuery(query: string | IndexQuery): Result<Contract.Indexable[], string> {
        return this.tryFullQuery(query).map((result) => result.results);
    }

    /** Execute a textual or typed index query, returning results plus performance metadata. */
    public fullquery<T extends Contract.Indexable = Contract.Indexable>(
        query: string | IndexQuery
    ): Contract.SearchResult<T>;
    public fullquery(query: string | IndexQuery): Contract.SearchResult<Contract.Indexable> {
        return orThrow(this.tryFullQuery(query), "invalid-query");
    }

    /** Execute a textual or typed index query, returning results plus performance metadata. */
    public tryFullQuery<T extends Contract.Indexable = Contract.Indexable>(
        query: string | IndexQuery
    ): Result<Contract.SearchResult<T>, string>;
    public tryFullQuery(query: string | IndexQuery): Result<Contract.SearchResult<Contract.Indexable>, string> {
        return this.tryParseQuery(query).flatMap((parsed) => this.core.datastore.search(parsed));
    }

    ///////////////////////
    // General utilities //
    ///////////////////////

    /** Utilities for coercing types into one specific type for easier programming. */
    public coerce = Coerce;

    /** Resolve a link (or link text) to the indexed object it points to (file, section, or block). */
    public resolveLink(link: string | Link, sourcePath?: string): Contract.Indexable | undefined {
        return this.core.datastore.resolveLink(link, sourcePath);
    }

    /** Resolve a local or absolute path or link to an absolute path. */
    public resolvePath(path: string | Link, sourcePath?: string): string {
        const rawpath = Literals.isLink(path) ? path.path : path;
        if (rawpath.startsWith("/")) return rawpath.substring(1);

        const absolute = this.core.metadataCache.getFirstLinkpathDest(rawpath, sourcePath ?? "");
        if (absolute) return absolute.path;

        return rawpath;
    }

    /** Try to parse the given query, returning a monadic success/failure result. */
    public tryParseQuery(query: string | IndexQuery): Result<IndexQuery, string> {
        if (!(typeof query === "string")) return Result.success(query);

        const result = QUERY.query.parse(query);
        if (result.status) return Result.success(result.value);
        else return Result.failure(Parsimmon.formatError(query, result));
    }

    /** Try to parse the given query, throwing an error if it is invalid. */
    public parseQuery(query: string | IndexQuery): IndexQuery {
        return orThrow(this.tryParseQuery(query), "invalid-query", (e) => "Failed to parse query: " + e);
    }

    /** Create a file link pointing to the given path. */
    public fileLink(path: string): Link {
        return Link.file(path);
    }

    /** Create a link to a header with the given name. */
    public headerLink(path: string, header: string): Link {
        return Link.header(path, header);
    }

    /** Create a link to a block with the given path and block ID. */
    public blockLink(path: string, block: string): Link {
        return Link.block(path, block);
    }

    /** Try to parse the given link, throwing an error if it is invalid. */
    public parseLink(linktext: string): Link {
        return orThrow(this.tryParseLink(linktext), "invalid-query", (e) => "Failed to parse link: " + e);
    }

    /** Try to parse a link, returning a monadic success/failure result. */
    public tryParseLink(linktext: string): Result<Link, string> {
        const parsed = PRIMITIVES.embedLink.parse(linktext);
        if (!parsed.status) return Result.failure(Parsimmon.formatError(linktext, parsed));

        return Result.success(parsed.value);
    }

    /** Create a data array from a regular array. */
    public array<T>(input: T[] | DataArray<T>): DataArray<T> {
        return DataArray.wrap(input);
    }

    /** Evaluate an expression and return it's evaluated value, throwing an exception on failure. */
    public evaluate(
        expression: string | Expression,
        variables?: Record<string, Literal>,
        sourcePath?: string
    ): Literal {
        return orThrow(this.tryEvaluate(expression, variables, sourcePath), "evaluation-failed");
    }

    /** Evaluate an expression and return it's evaluated value. */
    public tryEvaluate(
        expression: string | Expression,
        variables?: Record<string, Literal>,
        sourcePath?: string
    ): Result<Literal, string> {
        if (typeof expression === "string") {
            const parsed = EXPRESSION.expression.parse(expression);
            if (!parsed.status) return Result.failure(Parsimmon.formatError(expression, parsed));
            expression = parsed.value;
        }

        return this.core.datastore.evaluator(sourcePath).evaluate(expression, Variables.infer(variables));
    }
}

/** Unwrap a result, throwing a `DatacoreError` with the given code on failure. */
function orThrow<T>(result: Result<T, string>, code: DatacoreError["code"], message?: (error: string) => string): T {
    if (result.successful) return result.value;
    throw new DatacoreError(code, message ? message(result.error) : String(result.error));
}
