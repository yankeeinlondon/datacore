---
title: Installation
sidebar_position: 1
---

To write views in your notes you need two plugins:

- **Datacore Engine** (`datacore-engine`): the index and query engine, plus the settings tab.
- **Datacore View: Preact** (`datacore-view-preact`): renders `dc`, `dct`, `dcx`, and `dctx` code blocks.

If you only use another plugin that is built on Datacore Engine, that plugin needs Datacore Engine alone.

## Beta install with BRAT

The plugins are in beta and are not in the Obsidian community store yet. Until they are, install them with
[BRAT](https://github.com/TfTHacker/obsidian42-brat) (Beta Reviewers Auto-update Tester):

1. In Obsidian, open **Settings → Community plugins**, turn off Restricted mode if it is on, then browse for
   **BRAT**, install it, and enable it.
2. Open the command palette and run **BRAT: Add a beta plugin for testing**.
3. Enter `yankeeinlondon/datacore-engine` and confirm. BRAT downloads the latest release.
4. Run the command again with `yankeeinlondon/datacore-view-preact`.
5. In **Settings → Community plugins**, enable **Datacore Engine** and **Datacore View: Preact**. The order does not
   matter.

BRAT checks for new beta releases when Obsidian starts, and you can update by hand with **BRAT: Check for updates to
all beta plugins**.

## Community store

Once the plugins are accepted into the community store, install **Datacore Engine** and **Datacore View: Preact**
from **Settings → Community plugins → Browse** like any other plugin. If you installed them with BRAT, remove them
from BRAT's list first so the two do not both manage updates.

## After enabling

Datacore Engine starts indexing your vault as soon as it is enabled. On a large vault the first index can take several
minutes; views work in the meantime but show partial results until it finishes. The index is cached, so later starts
are much faster. You can follow the progress, and rebuild the index if needed, in the **Diagnostics** section of the
Datacore Engine settings tab.

If a view shows "Datacore Engine is not running", the engine plugin is disabled or reloading. Enable it again and
open views recover without reopening the note.

## Settings

All settings for the plugin family live in the **Datacore Engine** settings tab. Datacore View: Preact has no settings
tab of its own.

- **Display**: pagination and default page size, scrolling on page change, how empty values are shown, the default
  date and date/time formats, and the maximum recursive render depth. These are display defaults shared by every view
  plugin, so you set them once.
- **Indexing**: whether to index inline fields, and how many importer threads to use and how much CPU each may take.
- **Diagnostics**: index status, the plugins currently connected to the engine, and a **Reindex vault** button that
  drops the index and rebuilds it.

## Running beside upstream Datacore

You can keep upstream Datacore (`datacore`) installed and enabled. The two do not collide:

| | Upstream Datacore | This fork |
|---|---|---|
| Plugin ids | `datacore` | `datacore-engine`, `datacore-view-preact` |
| Code block languages | `datacorejs`, `datacorejsx`, `datacorets`, `datacoretsx` | `dc`, `dcx`, `dct`, `dctx` |
| Global | `window.datacore` | `window.dc` |
| Index cache | its own | its own |

Each plugin renders only its own code block languages, so a note can contain both kinds of block while you migrate.
Both plugins index the vault separately, so running both costs twice the indexing work. See
[Migrating from Datacore](migrating.md) when you are ready to switch.
