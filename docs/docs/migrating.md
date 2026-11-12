---
title: Migrating from Datacore
sidebar_position: 3
---

This page lists what changes when you move from upstream Datacore (the `datacore` plugin) to **Datacore Engine** and
**Datacore View: Preact**. Queries, expressions, the data model, and most of the script API are unchanged, so most
views keep working once their code blocks use the new language names.

You can install the new plugins while upstream Datacore is still enabled (see
[Running beside upstream Datacore](installation.md#running-beside-upstream-datacore)), migrate your notes, check them,
and then disable upstream Datacore.

## Code block languages

The code block languages have new, shorter names:

| Upstream Datacore | Datacore View: Preact | Script type |
|---|---|---|
| `datacorejs` | `dc` | JavaScript |
| `datacorets` | `dct` | TypeScript |
| `datacorejsx` | `dcx` | JSX |
| `datacoretsx` | `dctx` | TSX |

Datacore View: Preact renders only the new names. A `datacorejsx` block shows as plain code (or is rendered by upstream
Datacore, if that is still enabled). For example, this upstream block:

~~~
```datacorejsx
return function View() {
    return <p>You have {dc.useQuery("@page").length} pages.</p>;
}
```
~~~

becomes:

~~~
```dcx
return function View() {
    return <p>You have {dc.useQuery("@page").length} pages.</p>;
}
```
~~~

Only the fence's language changes; the code inside stays the same.

### Converting your notes

Datacore View: Preact has a command that rewrites the fences for you:

1. **Back up your vault first.** The command edits your notes in place.
2. Open the command palette and run **Datacore View: Preact: Convert datacore code blocks to dc**.
3. A preview lists every note with `datacorejs`, `datacorets`, `datacorejsx`, or `datacoretsx` blocks and how many
   blocks each has. Choose **Cancel** to change nothing, or **Convert _N_ notes** to rewrite them.
4. A notice reports how many blocks and notes were converted. If a note could not be converted, the notice says so
   and stays open; the details are in the developer console.

The command only changes the language name on the opening fence (`datacorejsx` becomes `dcx`, and so on). It
understands Markdown structure:

- Blocks inside callouts and blockquotes, and indented blocks inside list items, are converted.
- A fence shown as an example inside another fence (for example a ```` ```datacorejsx ```` block inside a
  ```` ````markdown ```` block) is part of that outer block's text and is left alone.
- Inline code such as `` `datacorejsx` `` is left alone.
- Running the command a second time finds nothing more to convert.

It looks at Markdown notes only. If a note has nothing to convert, it shows "No datacore code blocks to convert."

Things the command does not change, which you may need to update by hand:

- Queries that look for code blocks by language, such as `$languages.contains("datacorejsx")`. Use the new names:
  `@page and parentof(@codeblock and $languages.contains("dcx"))`.
- Notes that other tools generate (templates, Templater or QuickAdd scripts) with `datacore*` fences.

`dc.require` still loads code from `datacore*` blocks in a referenced section, so shared script modules keep loading
while you migrate.

## The `enableJs` setting is gone

Upstream Datacore had an `enableJs` setting, which it never actually read. It has been removed. In Datacore every view
is a script, so **enabling Datacore View: Preact is the opt-in to running scripts** in your notes. To stop all views
from running, disable that plugin.

## Settings live in Datacore Engine

There is one settings tab for the whole plugin family: **Settings → Datacore Engine**. It holds:

- **Display** defaults (pagination, page size, scrolling, empty values, date formats, render depth). These are shared by
  every view plugin, so you set them once.
- **Indexing** options.
- **Diagnostics**: index status, connected plugins, and a **Reindex vault** button.

Datacore View: Preact has no settings tab. Settings are not copied over from upstream Datacore; set them again in the
new tab. The engine builds its own index cache, so the first start indexes your whole vault once.

## `Array.isArray` and `DataArray`

Upstream Datacore patched the global `Array.isArray` so that it returned `true` for a `DataArray`. That patch affected
every plugin in the vault, and it has been removed. In scripts:

```js
const data = dc.array([1, 2, 3]);

Array.isArray(data);          // false (upstream Datacore: true)
Array.isArray(data.array());  // true
```

If your code checks `Array.isArray` on something that may be a `DataArray`, convert it first with `.array()`, or wrap
plain arrays with `dc.array()` and work with `DataArray`s throughout. Views still render a `DataArray` as children or as
a list value, as before. See [Data Arrays](code-views/data-array.md).

## The script `dc` object

Inside a code block, `dc` keeps the hooks, components, and query methods described in the
[Codeblock API](code-views/local-api.md). It now also exposes the engine's path-scoped query API, the same one plugins
get from `dc.local(path)`, so methods such as `dc.page(path)`, `dc.inferLink(text)`, `dc.luxon`, `dc.currentFile()`,
and `dc.currentPath()` are available, with relative links resolved against the note the block is in.

Removed:

- `dc.core`, which exposed engine internals. Use the documented query methods and hooks instead.

`dc.app` (Obsidian's `App`) is still available.

## `window.datacore` is now `window.dc`

Upstream Datacore exposes its API as `window.datacore`. Datacore Engine exposes the engine API as `window.dc`, for
Templater and QuickAdd scripts and the developer console:

```js
// In the developer console or a Templater script:
window.dc.query("@page and #book").length;
```

`window.dc` has the query, link, and expression methods, but no hooks or components; those exist only inside code
blocks. If something else on the page already defined `window.dc`, the engine leaves it alone and logs a warning.

Inside a code block, the block's own `dc` hides the global one.

## For plugin developers

Upstream's `@blacksmithgu/datacore` typings do not apply to this engine. Plugins use
`@yankeeinlondon/datacore-client` instead; see [For plugin authors](plugin-authors/index.md).
