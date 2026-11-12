# Datacore Engine

A fast, shared query engine for your vault. Datacore Engine indexes your Markdown notes, canvases and their metadata
(frontmatter, inline fields, tags, sections, blocks, lists and tasks) in the background and answers queries for the
views and plugins that use it.

It is the headless half of [Datacore](https://github.com/blacksmithgu/datacore), the successor to Dataview: the engine
owns the index and the query language, and separate view plugins render the results. On its own it draws nothing in
your notes; install a view plugin to write views.

## Installation

1. Install **Datacore Engine** from Settings → Community plugins (or, during the beta, with
   [BRAT](https://github.com/TfTHacker/obsidian42-brat): add `yankeeinlondon/datacore-engine`).
2. Install a view plugin, such as **Datacore View: Preact** (`yankeeinlondon/datacore-view-preact`), which renders
   `dc`, `dct`, `dcx` and `dctx` code blocks.
3. Enable both. The plugins find each other at runtime, so the order you enable them in does not matter.

Works on desktop and mobile. The first index of a large vault takes a moment; later starts read from a local cache.

## What it gives you

- **One index for every view.** Views built with any Datacore view plugin (and third-party plugins that use the engine)
  share the same index, instead of each plugin scanning your vault.
- **Queries** over pages, sections, blocks, list items, tasks and canvases, with the Datacore query language
  (for example `@page and #game and rating > 3`).
- **One settings tab for the family**: indexing options plus display defaults (date formats, how empty values show,
  paging) that every view plugin reads, so you set them once. The tab also shows index status, which plugins are
  connected, and a **Reindex vault** action.
- **Command:** "Reindex entire vault" rebuilds the index from scratch.
- **`window.dc`**: the engine API for the developer console, Templater, QuickAdd and other scripts. Plugins should use
  [`@yankeeinlondon/datacore-client`](https://www.npmjs.com/package/@yankeeinlondon/datacore-client) instead.

## Running alongside Datacore

Datacore Engine can be installed next to the original Datacore plugin (`datacore`) without conflict. It uses its own
plugin id, its own global (`window.dc` instead of `window.datacore`), its own index cache, and its view plugins use
their own code block languages (`dc`, `dct`, `dcx`, `dctx` instead of `datacorejs`, `datacorets`, `datacorejsx`,
`datacoretsx`). View Preact includes a command to convert existing `datacore*` code blocks once you are ready to switch.

## Documentation and support

- Documentation: <https://blacksmithgu.github.io/datacore/>
- Source and issues: <https://github.com/yankeeinlondon/datacore> (this repository only hosts releases)

## License

MIT. Datacore was created by Michael Brenan; this engine is maintained by Ken Snyder.
