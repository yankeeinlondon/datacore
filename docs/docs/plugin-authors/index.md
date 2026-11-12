---
title: For plugin authors
sidebar_label: For plugin authors
sidebar_position: 900
---

Any Obsidian plugin can use Datacore's index, query language, and live updates through **Datacore Engine**. Every plugin
that does so shares one engine per vault: one index, one cache, one set of worker threads. Your plugin does not bundle
the engine; it finds the running `datacore-engine` plugin at runtime through a small client library.

For a complete, buildable plugin that does all of this, see the [example consumer plugin](https://github.com/yankeeinlondon/datacore/tree/master/examples/consumer-plugin).

Your users need Datacore Engine installed and enabled (see [Installation](../installation.md)). They do not need
Datacore View: Preact unless they also write views in their notes.

## Install the client

```bash
pnpm add @yankeeinlondon/datacore-client
# or: npm install @yankeeinlondon/datacore-client
```

`@yankeeinlondon/datacore-client` is the only package to install. It re-exports every type of the API contract
(`@yankeeinlondon/datacore-contract`), such as `MarkdownPage`, `Link`, `DataArray`, and `ScopedDatacore`. Do not add the
contract package as a separate dependency: two copies of it would not agree on the brand symbols that identify engine
values. The client is small and is bundled into your plugin's `main.js`.

Apart from the contract (types and a few constants), the client has no runtime dependencies; it uses luxon for types
only.

## Connect to the engine

Call `getDatacore()` from your plugin's `onload`:

```ts
import { Notice, Plugin } from "obsidian";
import { getDatacore, type DatacoreHandle } from "@yankeeinlondon/datacore-client";

export default class MyPlugin extends Plugin {
    private dc?: DatacoreHandle;

    async onload() {
        const result = await getDatacore(this.app, { consumer: this, minApi: "1.0" });
        if (!result.ok) {
            new Notice(`My Plugin needs Datacore Engine (${result.reason}).`);
            return;
        }

        this.dc = result.engine;
        await this.dc.ready(); // optional: wait for the initial index
        console.log(this.dc.query("@page and #book").length);
    }
}
```

`getDatacore(app, options)` returns a promise of a `GetDatacoreResult`:

```ts
type GetDatacoreResult =
    | { ok: true; engine: DatacoreHandle }
    | { ok: false; reason: GetDatacoreFailure; message: string };
```

It never rejects. Load order does not matter: if the engine plugin has not loaded yet, `getDatacore()` waits for it.

### Options

| Option | Default | Meaning |
|---|---|---|
| `consumer` | (required) | Who is asking. Pass your plugin (`this`). Its id identifies you in the engine's diagnostics, and when it unloads everything you created through the handle is cleaned up. Alternatively pass `{ id, name?, component? }`, where `component` is an Obsidian `Component` whose unload does the cleanup. |
| `minApi` | accept any | The lowest API version your plugin works with, such as `"1.0"`. Compared with caret semantics (see [Versions](#versions-and-capabilities)). |
| `timeoutMs` | `10000` | How long to wait for an engine that is installed and enabled but has not loaded yet. |
| `reconnect` | `true` | Reconnect and replay your subscriptions when the engine reloads. See [Lifecycle](lifecycle.md). |
| `host` | main `window` | Where the engine registry lives. For tests only. |

### Failure reasons

When `ok` is `false`, `reason` is one of:

| Reason | When | What to tell the user |
|---|---|---|
| `not-installed` | Obsidian has no `datacore-engine` plugin installed. Returned straight away. | Install Datacore Engine. |
| `disabled` | Datacore Engine is installed but not enabled. Returned straight away. | Enable Datacore Engine. |
| `incompatible` | The running engine's API version does not satisfy `minApi`. | Update Datacore Engine (or your plugin). |
| `timeout` | The engine is installed and enabled but did not become available within `timeoutMs`. | Usually a failed engine load; check the developer console. |

`message` is a readable English description you can log or show.

If the engine is already running, the installed/enabled checks are skipped and only `minApi` is checked.

### Without waiting: `tryGetDatacore`

`tryGetDatacore(options)` returns a `DatacoreHandle` straight away if the engine is already running and compatible, and
`undefined` otherwise. It takes the same options as `getDatacore`, without the `app` argument, and never waits.

```ts
import { tryGetDatacore } from "@yankeeinlondon/datacore-client";

const dc = tryGetDatacore({ consumer: this, minApi: "1.0" });
if (dc) {
    // use it
}
```

Use it where you cannot `await`, for example in a command callback that runs long after startup. In `onload`, prefer
`getDatacore`, which tolerates the engine loading after your plugin.

## What you get

The handle (`DatacoreHandle`) implements the engine API (`DatacoreApi`), plus:

- `consumer`, `revoked`, `onRevoked()`, `onReconnected()`, `disposeAll()`, and `release()`, described in
  [Lifecycle](lifecycle.md).

The engine API covers:

- **Queries and lookups**: `query`, `tryQuery`, `fullquery`, `tryFullQuery`, `parseQuery`, `tryParseQuery`, `page`,
  `load`, `resolveLink`, `resolvePath`.
- **Expressions**: `evaluate`, `tryEvaluate`.
- **Links**: `fileLink`, `headerLink`, `blockLink`, `parseLink`, `tryParseLink`, `inferLink`.
- **Utilities**: `array`, `coerce`, `luxon`.
- **Live updates**: `subscribe`, `watchFile`, `onRevision`, `on(...)`.
- **State**: `initialized`, `revision`, `ready()`, `status()`, `settings.display`, `reindex()`.
- **Path-scoped API**: `local(sourcePath)`.
- **Versions**: `apiVersion`, `engineVersion`, `has(capability)`.

See [Queries and subscriptions](queries.md) for how to use them, and [Values and guards](values.md) for working with
the objects they return.

The engine does not expose its internals (no `core`, `datastore`, or `app`), and it has no rendering API: hooks and
components such as `dc.Table` belong to Datacore View: Preact and are only available inside code blocks.

## Versions and capabilities

- `apiVersion` is the version of the API contract the engine implements. `minApi` is checked against it with caret
  semantics: `"1.2"` accepts any `1.x` from `1.2.0` up, but not `2.0`. For `0.x` versions every minor is breaking:
  `"0.3"` accepts `0.3.x` only. `satisfiesApi(apiVersion, minApi)` and `parseVersion(text)` are exported if you need
  the same check yourself.
- Within a major version, optional features are gated by capabilities. Check them with `has()`:

  ```ts
  import { CAPABILITIES } from "@yankeeinlondon/datacore-client";

  if (dc.has(CAPABILITIES.subscribe)) {
      // ...
  }
  ```

  The capability names are `query`, `subscribe`, `write`, and `functions`. `write` (field writes) and `functions`
  (custom expression functions) are reserved for later API versions and are not advertised yet.
- `engineVersion` is the engine plugin's own version, for diagnostics only.

## `window.dc` is for scripts, not plugins

Datacore Engine also defines a global `window.dc` with the same engine API, for Templater/QuickAdd scripts and the
developer console. The client types it (`Window.dc?: DatacoreApi`). Plugins should not use it: it is `undefined` while
the engine is unloaded, it is not checked against your `minApi`, and subscriptions made through it are not cleaned up
when your plugin unloads. `getDatacore()` handles all of that.

## Engine values and `instanceof`

Each Obsidian plugin bundles its own copies of its dependencies, so a `Link` or luxon `DateTime` created by the engine
is not an instance of the class your plugin bundles. Never use `instanceof` on engine values. Use the client's guards
(`isLink`, `isDateTime`, `isMarkdownPage`, ...) and create values through the engine (`dc.fileLink()`, `dc.luxon`,
`dc.array()`). See [Values and guards](values.md).
