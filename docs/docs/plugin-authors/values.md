---
title: Values and guards
sidebar_position: 3
---

Every Obsidian plugin bundles its own copy of the libraries it uses. A `Link`, `DataArray`, or luxon `DateTime` that
the engine returns was made by the engine's copy of that class, so `value instanceof DateTime` is `false` in your
plugin even when `value` is a date. The client provides guards and helpers that recognize engine values by structure
and brand instead.

Rules of thumb:

- Never use `instanceof` on values from the engine. Use the guards below.
- Create engine values through the engine: links with `dc.fileLink()` / `dc.inferLink()` / `dc.parseLink()`, dates and
  durations with `dc.luxon`, data arrays with `dc.array()`.
- Treat query results as read-only snapshots.

## Indexed objects

Every indexed object has `$id`, `$typename`, and `$types` (for example a page has the types `page`, `markdown`, `file`,
...). The guards check `$types`:

| Guard | Matches |
|---|---|
| `isIndexable(x)` | any indexed object |
| `isFile(x)` | any file |
| `isMarkdownPage(x)` | a markdown page (`@page`) |
| `isSection(x)` | a section (`@section`) |
| `isBlock(x)` | any block (`@block`) |
| `isListBlock(x)` | a block containing a list (`@block-list`) |
| `isCodeblock(x)` | a code block (`@codeblock`) |
| `isDatablock(x)` | a data block (`@datablock`) |
| `isListItem(x)` | a list item (`@list-item`) |
| `isTask(x)` | a task (`@task`) |
| `isCanvas(x)` | a canvas file (`@canvas`) |
| `isCanvasCard(x)` | a card on a canvas |
| `hasIndexType(x, type)` | any of the type names in `INDEX_TYPES` |

```ts
import { isMarkdownPage, isTask } from "@yankeeinlondon/datacore-client";

for (const result of dc.query("#project")) {
    if (isMarkdownPage(result)) console.log("page", result.$path);
    else if (isTask(result)) console.log("task", result.$text, result.$completed);
}
```

## Values

Field values (`page.value("rating")`, frontmatter, inline fields) are `Literal`s: strings, numbers, booleans, `null`,
luxon dates and durations, links, arrays, plain objects, or functions.

| Guard | Matches |
|---|---|
| `isLink(x)` | a link created by the engine (checked by brand) |
| `isDateTime(x)` | a luxon `DateTime` from any copy of luxon |
| `isDuration(x)` | a luxon `Duration` from any copy of luxon |
| `isDataArray(x)` | a `DataArray` created by the engine |
| `isLiteralArray(x)` | a plain array or a `DataArray` |
| `isDataObject(x)` | a plain object that is not a list, date, duration, or link |

`Array.isArray` returns `false` for a `DataArray`; use `isLiteralArray` to accept both, or `.array()` to convert.

### Value helpers

These are the same functions the engine and Datacore View: Preact use, so your plugin sorts, compares, and formats
values exactly as views do:

| Helper | What it does |
|---|---|
| `typeOf(x)` | The value's type: `"string"`, `"number"`, `"boolean"`, `"date"`, `"duration"`, `"link"`, `"array"`, `"object"`, `"function"`, or `"null"`; `undefined` if it is not a literal. |
| `wrapValue(x)` | `{ type, value }` with the same types, convenient for a `switch`. |
| `compare(a, b)` | A total ordering over any two values (nulls first, then by type, then by value). Usable with `Array.prototype.sort`. |
| `equals(a, b)` | Whether `compare(a, b) === 0`. |
| `isTruthy(x)` | Truthiness as the query language defines it (empty strings, lists, and objects are false). |
| `literalToString(x, settings?)` | A Markdown-friendly string: links as `[[...]]`, dates in the given formats, lists comma-separated. |
| `mapLeaves(x, fn)` | Apply `fn` to every leaf of nested lists and objects. |

```ts
import { compare, literalToString, typeOf } from "@yankeeinlondon/datacore-client";

const books = dc.query("@page and #book");
books.sort((a, b) => compare(a.value("rating"), b.value("rating")));

const display = dc.settings.display;
const text = literalToString(books[0]?.value("finished"), {
    dateFormat: display.dateFormat,
    dateTimeFormat: display.dateTimeFormat,
    nullRepresentation: display.nullAs,
});
```

Without `settings`, `literalToString` uses `DEFAULT_LITERAL_STRING_SETTINGS` (`"-"` for empty values and English date
formats). Pass the user's display settings, as above, to match their views.

### Groupings

`DataArray.groupBy` produces nested `{ key, rows }` groups. These helpers work on such groupings without caring how
deep they are:

| Helper | What it does |
|---|---|
| `isGroupElement(x)` | `x` is a `{ key, rows }` group rather than a row. |
| `isGrouping(g)` | `g` is a list of groups. |
| `isGroupLeaf(g)` | `g` is a list of rows with no sub-groups. |
| `groupingSize(g)` | The total number of rows, at any depth. |
| `sliceGrouping(g, start, end)` | Rows `[start, end)` with the group structure around them kept, for paging. |

## Dates and durations

`dc.luxon` is the engine's copy of luxon. Use it to create dates you compare with engine values, and use the guards to
recognize them:

```ts
import { isDateTime } from "@yankeeinlondon/datacore-client";

const { DateTime } = dc.luxon;
const weekAgo = DateTime.now().minus({ days: 7 });

const recent = dc.query("@page").filter((page) => {
    const due = page.value("due");
    return isDateTime(due) && due > weekAgo;
});
```

The client depends on luxon's types only; you do not need luxon at runtime.

## Links

```ts
import { isLink } from "@yankeeinlondon/datacore-client";

const link = dc.fileLink("Books/Dune.md").withHeader("Review");
link.markdown();      // "[[Books/Dune.md#Review|Dune > Review]]"
link.obsidianLink();  // "Books/Dune.md#Review"
dc.resolveLink(link); // the MarkdownSection it points to

const page = dc.page("Books/Dune.md");
const author = page?.value("author");
if (isLink(author)) {
    const authorPage = dc.page(author);
}
```

A link's `with*` methods (`withPath`, `withHeader`, `withBlock`, `withDisplay`, `withEmbed`) return new links; links are
immutable. `toObject()` gives a plain `JsonLink` you can store, and `dc.inferLink()` turns stored link text back into a
link.
