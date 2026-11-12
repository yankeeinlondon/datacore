# Datacore Example Consumer

The reference example for plugin authors: a small, complete Obsidian plugin that uses
[Datacore Engine](https://github.com/yankeeinlondon/datacore) through the published
[`@yankeeinlondon/datacore-client`](https://www.npmjs.com/package/@yankeeinlondon/datacore-client) package, exactly as
a third-party plugin would.

It lives outside the Datacore monorepo's pnpm workspace on purpose. It has its own `package.json` and npm lockfile, and
resolves the client from the npm registry, not from the workspace sources.

## What it does

All of it is in [`main.ts`](main.ts) and uses only the client's public API.

- **Connect.** `onload` calls `getDatacore(this.app, { consumer: this, minApi: "1.0" })`. If the engine is not
  available, it shows a notice naming the reason (`not-installed`, `disabled`, `incompatible` or `timeout`) and the
  client's message, and leaves its features off.
- **Live status bar.** A status bar item reads `Datacore: N pages`, kept current by `engine.subscribe("@page", ...)`.
  While the engine is unloaded (`onRevoked`) it reads `Datacore: engine off`; when the engine comes back
  (`onReconnected`) the client replays the subscription and the count returns.
- **Command.** "Show tagged page count" runs `engine.query("@page and #book")`, keeps the results that pass the
  `isMarkdownPage` guard, and shows the count in a notice.
- **Inspectable.** The handle is the plugin's public `engine` field. In the developer console:
  `app.plugins.plugins["datacore-example-consumer"].engine`.

Nothing is disposed in `onunload`: the client releases the handle and its subscriptions when the plugin unloads.

## Build

Requires Node.js 18 or later.

```sh
npm install
npm run build   # type-checks, then bundles main.ts into main.js
```

`npm run dev` rebuilds on change (with inline source maps). `npm run typecheck` only type-checks.

## Install into a vault

1. Install and enable **Datacore Engine** (plugin id `datacore-engine`) in the vault.
2. Copy `main.js` and `manifest.json` into `<vault>/.obsidian/plugins/datacore-example-consumer/`.
3. Reload Obsidian (or the plugin list) and enable **Datacore Example Consumer** under Settings, Community plugins.

## Using it as a template

Copy the folder, change the `id`, `name` and `description` in `manifest.json`, and replace `main.ts` with your own
plugin. Keep `@yankeeinlondon/datacore-client` as your only Datacore dependency (do not add
`@yankeeinlondon/datacore-contract` separately). The client's
[README](https://github.com/yankeeinlondon/datacore/tree/master/packages/client#readme) and the
[plugin author docs](https://github.com/yankeeinlondon/datacore/tree/master/docs/docs/plugin-authors) cover the full
API.
