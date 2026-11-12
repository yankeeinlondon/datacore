---
title: Queries and subscriptions
sidebar_position: 1
---

These examples assume `dc` is the handle from [`getDatacore()`](../plugin-authors/index.md#connect-to-the-engine). Queries use the
same [query language](../data/query.md) as views, and return the same objects described under
[Metadata](../data/index.md).

## Waiting for the index

The engine indexes the vault when it starts. Queries work at once, but return partial results until the first index
finishes.

```ts
dc.initialized;   // true once the initial index has finished
await dc.ready(); // resolves when it has (immediately if it already has)

dc.status();
// { initialized: boolean, revision: number, progress: { initialized: number, total: number }, objects: number }
```

To show progress yourself, listen for `index-progress` (see [Events](#events)).

## One-off queries

```ts
import type { MarkdownPage } from "@yankeeinlondon/datacore-client";

const books = dc.query<MarkdownPage>("@page and #book and rating > 7");

const full = dc.fullquery("@page and #book");
full.results;   // the matches
full.duration;  // seconds the search took
full.revision;  // the index revision it ran against

const page = dc.page("Books/Dune.md"); // a MarkdownPage, or undefined
const object = dc.load("Books/Dune.md"); // any indexed object by id
```

`query`, `fullquery`, and `parseQuery` throw a `DatacoreError` with code `invalid-query` when the query does not parse.
The `try` variants return a `Result` instead of throwing:

```ts
const result = dc.tryQuery(userInput);
if (result.successful) {
    console.log(result.value.length);
} else {
    console.warn(result.error); // a readable parse error
}
```

A `Result` also has `map`, `flatMap`, `mapErr`, `orElse(value)`, and `orElseThrow()`.

Queries accept a parsed `IndexQuery` as well as a string. Parse once with `parseQuery` if you run the same query often.

## Expressions

```ts
dc.evaluate("1 + 2");                          // 3
dc.evaluate("x + y", { x: 1, y: 2 });          // 3
dc.evaluate("[[Test]].rating", {}, "Notes/Index.md"); // links resolve relative to the source path
dc.tryEvaluate("nosuchfunction(3)");           // { successful: false, error: "..." }
```

`evaluate` throws a `DatacoreError` with code `evaluation-failed`; `tryEvaluate` returns a `Result`. See
[Expressions](../expressions/index.md) for the language.

## Links and paths

```ts
dc.fileLink("Books/Dune.md");                 // [[Books/Dune.md]]
dc.headerLink("Books/Dune.md", "Review");     // [[Books/Dune.md#Review]]
dc.blockLink("Books/Dune.md", "abc123");      // [[Books/Dune.md#^abc123]]
dc.inferLink("Dune#Review|my review");        // from bare link text; never throws, does not resolve
dc.parseLink("[[Dune#Review]]");              // from full link syntax; throws on bad input (tryParseLink does not)

dc.resolvePath("Dune", "Books/Index.md");     // "Books/Dune.md"
dc.resolveLink("Dune#Review", "Books/Index.md"); // the MarkdownSection for that heading
```

Create links through the engine rather than constructing them yourself; see [Values and guards](values.md).

## Path-scoped API

`dc.local(sourcePath)` returns the same query API scoped to one file: relative links and paths resolve against that
file. It also has `path`, `currentPath()`, and `currentFile()`. This is the API that
code blocks in notes get as their `dc`.

```ts
const local = dc.local("Books/Index.md");
local.currentFile(); // the MarkdownPage for Books/Index.md
local.query("@page and linksto([[Dune]])"); // [[Dune]] resolves from Books/Index.md
```

## Subscriptions

`subscribe` runs a query now and again whenever its results change:

```ts
const subscription = dc.subscribe<MarkdownPage>(
    "@page and #book",
    (books, meta) => {
        // meta.initial is true for the first call; meta.revision is the index revision
        this.render(books);
    },
    { debounce: 500 }
);

// later, if you want to stop early:
subscription.dispose();
```

- The callback runs once straight away with the current results (`meta.initial === true`), then only when the result
  set changes. Results are compared by each object's `$id` and `$revision`, so an index change that does not touch
  your results does not call you.
- `debounce` (milliseconds, default 500) waits for the index to settle after a change. `0` calls back on every
  relevant change.
- A query that does not parse throws `invalid-query` from `subscribe` itself.
- Results are snapshots. Do not modify them. If you keep them in a reactive framework, store them without deep
  proxying (for example Vue's `shallowRef` or `markRaw`).

Related calls, with the same options and the same `Disposable` result:

```ts
// One file's indexed object; undefined once the file is deleted.
dc.watchFile("Books/Dune.md", (page, meta) => { /* ... */ });

// Every index change, with the new revision.
dc.onRevision((revision) => { /* ... */ }, { debounce: 1000 });
```

`dc.revision` is the current index revision. It only ever increases, and every object stored at revision N has
`$revision === N`, so you can compare revisions to tell whether something changed.

You do not have to dispose subscriptions when your plugin unloads: the client does it for you (see
[Lifecycle](lifecycle.md)). Dispose them yourself when you no longer need them earlier than that, for example when a
view of yours closes.

## Events

```ts
dc.on("initialized", () => { /* the initial index finished */ });
dc.on("index-progress", ({ initialized, total }) => { /* files processed so far, of total */ });
dc.on("rename", (newPath, oldPath) => { /* a file was renamed and re-indexed */ });
dc.on("display-settings", (display) => { /* the user changed the display defaults */ });
```

Each returns a `Disposable` and is cleaned up with your plugin like subscriptions.

## Display settings

The user sets display defaults once, in the Datacore Engine settings tab, and every view plugin reads them. If your
plugin renders values, read them too:

```ts
const display = dc.settings.display;
// { dateFormat, dateTimeFormat, nullAs, pagingEnabled, pageSize, scrollOnPageChange, maxRecursiveRenderDepth }

dc.on("display-settings", (next) => this.rerender(next));
```

The settings are read-only for consumers. `dateFormat` and `dateTimeFormat` are luxon format strings, and `nullAs` is
the text for empty values. To format a value with them, see [`literalToString`](values.md#value-helpers).

## Reindexing

`await dc.reindex()` drops the index and cache and indexes the whole vault again. It is the same as the **Reindex
vault** button in the settings tab, and is rarely needed.
