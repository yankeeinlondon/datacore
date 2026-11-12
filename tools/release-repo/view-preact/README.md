# Datacore View: Preact

Live, interactive views in your notes, written as JavaScript, TypeScript, JSX or TSX code blocks. Views query your vault
through [Datacore Engine](https://github.com/yankeeinlondon/datacore-engine), re-render when the data they use changes,
and can keep their own state, like any Preact (React-compatible) component.

> **Requires Datacore Engine.** This plugin renders views; the engine indexes your vault and answers their queries.
> Install and enable both.

## Installation

1. Install **Datacore Engine** and **Datacore View: Preact** from Settings → Community plugins (or, during the beta,
   with [BRAT](https://github.com/TfTHacker/obsidian42-brat): add `yankeeinlondon/datacore-engine` and
   `yankeeinlondon/datacore-view-preact`).
2. Enable both, in either order. If the engine is missing or disabled, views show a notice instead of failing, and
   recover on their own once the engine is back.

Settings such as date formats and paging live in the **Datacore Engine** settings tab and apply to every view.

## Code block languages

| Language | Script type |
|---|---|
| `dc` | JavaScript |
| `dct` | TypeScript |
| `dcx` | JSX |
| `dctx` | TSX |

A view returns a component:

~~~markdown
```dcx
const COLUMNS = [
    { id: "Name", value: (page) => page.$link },
    { id: "Rating", value: (page) => page.value("rating") },
];

return function View() {
    const pages = dc.useQuery("@page and #game");
    return <dc.Table columns={COLUMNS} rows={pages} />;
};
```
~~~

Inside a block, `dc` is the view API: queries (`dc.useQuery`), hooks, built-in components such as `dc.Table` and
`dc.List`, and `dc.require` for loading your own scripts from the vault.

## Running alongside Datacore, and migrating

This plugin registers only the `dc*` languages, never the original Datacore plugin's `datacorejs`, `datacorets`,
`datacorejsx` and `datacoretsx`, so you can keep the original Datacore installed while you try it.

When you are ready to switch, run the command **"Convert datacore code blocks to dc"**. It scans your vault, shows which
notes would change and how many blocks, and on confirmation rewrites the fences: `datacorejs` → `dc`,
`datacorets` → `dct`, `datacorejsx` → `dcx`, `datacoretsx` → `dctx`.

## Documentation and support

- Documentation: <https://blacksmithgu.github.io/datacore/>
- Source and issues: <https://github.com/yankeeinlondon/datacore> (this repository only hosts releases)

## License

MIT. Datacore was created by Michael Brenan; this plugin is maintained by Ken Snyder.
