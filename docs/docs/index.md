---
title: Datacore
sidebar_position: 0
---
import {ImageFigure} from "@site/src/figure";

Datacore is a power tool for [Obsidian.md](https://obsidian.md), allowing you to create dynamic views that gather and edit data from the files in your vault.

This site documents a fork of [Datacore](https://github.com/blacksmithgu/datacore) that splits it into a shared query
engine and separate view plugins. The query language, the data model, and most of the view API are the same as
upstream Datacore; the [migration guide](migrating.md) lists what changed.

### The plugins

| Plugin | Id | What it does |
|---|---|---|
| **Datacore Engine** | `datacore-engine` | Indexes your vault and answers queries. Owns the settings tab (display defaults, indexing options, diagnostics) and the `window.dc` global for scripts and the developer console. It does not render anything itself. |
| **Datacore View: Preact** | `datacore-view-preact` | Renders views: the `dc`, `dct`, `dcx`, and `dctx` code blocks, with their hooks and components (`dc.Table`, `dc.List`, ...). Needs Datacore Engine. |

To write views in your notes, install **both**. Both plugins can run alongside upstream Datacore: they use different
plugin ids, code block languages, and caches, so nothing collides. See [Installation](installation.md).

Other Obsidian plugins can use the same engine through the `@yankeeinlondon/datacore-client` npm package; there is
only ever one index per vault, however many plugins use it. See [For plugin authors](plugin-authors/index.md).

### Getting Started

*If you just want to see something on your screen as fast as possible, follow the [quickstart](quickstart.md)! Otherwise, read on.*

Once Datacore Engine is enabled, it starts indexing your vault, which may take several minutes on a large vault. Views
are usable straight away, but results are not complete until indexing finishes. Later starts load the saved index and
are much faster.

- To learn more about what metadata is available in Datacore and what you can add, check out [Metadata](data/index.md).
- For learning how to make datacore queries, check out [Datacore Queries](data/query.md).
- To learn about how to create dynamic views, check out [Javascript Views](code-views/index.md).
- If you used upstream Datacore before, read [Migrating from Datacore](migrating.md).

Datacore is currently in a power-user stage focused on javascript/typescript savvy users - non-javscript views similar to DataviewQL
will be coming in the future!

### Screenshots

<ImageFigure
    src="img/screenshots/game-list-example-blacksmithgu.png"
    caption="@blacksmithgu's view for sorting games he has played - these all come with his recommendation."/>
