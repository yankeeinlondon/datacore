# @yankeeinlondon/datacore-client

Use the shared **Datacore Engine** from your own Obsidian plugin.

[Datacore Engine](https://github.com/yankeeinlondon/datacore) is an Obsidian plugin that indexes the vault once (pages,
sections, blocks, list items, tasks, canvases, fields) and serves queries to every plugin that asks. This package is
the small client your plugin bundles to find that engine and talk to it with full TypeScript types:

- `getDatacore()` locates the engine regardless of plugin load order, negotiates the API version, and returns a handle.
- The handle survives engine reloads (it reconnects and replays your subscriptions) and cleans up after itself when
  your plugin unloads.
- Type guards and value helpers recognise engine values (pages, tasks, links, dates, …) without `instanceof`, which
  does not work across plugin bundles.
- The full API contract ([`@yankeeinlondon/datacore-contract`](https://www.npmjs.com/package/@yankeeinlondon/datacore-contract))
  is re-exported, so this is the only package you install.

Your users need the **Datacore Engine** plugin (id `datacore-engine`) installed and enabled. The engine does all the
indexing; this client adds a few kilobytes to your bundle.

## Install

```sh
pnpm add @yankeeinlondon/datacore-client
# or: npm install @yankeeinlondon/datacore-client
```

Also on [JSR](https://jsr.io/@yankeeinlondon/datacore-client), as TypeScript source with the same API:

```sh
npx jsr add @yankeeinlondon/datacore-client
# or: deno add jsr:@yankeeinlondon/datacore-client
```

The package ships ESM and CommonJS builds with type declarations for both. Obsidian plugins are bundled (esbuild,
Rollup, Vite), which pick the right build automatically. TypeScript resolves it with `moduleResolution` set to
`bundler`, `node16`/`nodenext`, or the classic `node` setting used by the Obsidian sample plugin. The engine is only
reachable inside Obsidian, but the guards and value helpers are plain functions you can unit-test under Node.

Do **not** also install `@yankeeinlondon/datacore-contract` directly: two copies of the contract would split its
branded types. Import everything from the client.

## Connect

```ts
import { Notice, Plugin } from "obsidian";
import { getDatacore, type DatacoreHandle } from "@yankeeinlondon/datacore-client";

export default class MyPlugin extends Plugin {
    dc?: DatacoreHandle;

    async onload() {
        const result = await getDatacore(this.app, {
            consumer: this, // your plugin: identifies you and scopes cleanup to your unload
            minApi: "1.0", // the API version you built against
        });

        if (!result.ok) {
            new Notice(`My Plugin needs the Datacore Engine plugin (${result.reason}).`);
            return;
        }

        this.dc = result.engine;
        await this.dc.ready(); // optional: wait for the initial vault index
        console.log(`${this.dc.query("@page and #book").length} books`);
    }
}
```

### Options

| Option      | Default        | Meaning                                                                                                   |
| ----------- | -------------- | --------------------------------------------------------------------------------------------------------- |
| `consumer`  | (required)     | Your `Plugin` (or `{ id, name?, component? }`). Everything created through the handle is disposed when it unloads. |
| `minApi`    | any version    | Lowest API version you support, with caret semantics: `"1.0"` accepts any `1.x` engine at or above 1.0.   |
| `timeoutMs` | `10000`        | How long to wait for an engine that is installed and enabled but has not loaded yet.                      |
| `reconnect` | `true`         | Reconnect (and replay subscriptions) when the engine reloads.                                             |

### When the engine is not available

`getDatacore()` never throws for a missing engine. It resolves with `{ ok: false, reason, message }`:

| `reason`        | When                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------- |
| `not-installed` | The `datacore-engine` plugin is not installed. Reported immediately.                         |
| `disabled`      | It is installed but turned off. Reported immediately.                                        |
| `incompatible`  | The engine's API version does not satisfy `minApi` (different major, or a lower minor).      |
| `timeout`       | It is enabled but did not finish loading within `timeoutMs`.                                 |

`message` is a human-readable explanation, suitable for a log line. A good pattern is to show a `Notice` and leave your
plugin's Datacore features off; if your plugin can work without the engine, keep going.

If you only want the engine when it is already running (for example inside a command callback), use the synchronous
variant. It returns `undefined` when the engine is not active or does not satisfy `minApi`:

```ts
import { tryGetDatacore } from "@yankeeinlondon/datacore-client";

const dc = tryGetDatacore({ consumer: this, minApi: "1.0" });
if (dc) new Notice(`${dc.query("#todo").length} notes tagged #todo`);
```

## Query

```ts
import { isMarkdownPage, type MarkdownPage, type MarkdownTaskItem } from "@yankeeinlondon/datacore-client";

// Throws a DatacoreError with code "invalid-query" on a bad query.
const books = dc.query<MarkdownPage>("@page and #book");
const open = dc.query<MarkdownTaskItem>("@task and $completed = false");

// Or get a Result instead of throwing.
const result = dc.tryQuery("@page and rating > 3");
if (result.successful) console.log(result.value.length);
else console.warn(result.error);

// Single objects, links, expressions.
const page = dc.page("Projects/Datacore.md");
const target = dc.resolveLink("[[Datacore#Roadmap]]");
const total = dc.evaluate("1 + 2"); // 3
const rating = page?.value("rating"); // a field value, case-insensitive key

// A view of the API scoped to one file: relative links and `this` resolve against it.
const local = dc.local("Daily/2026-11-12.md");
local.currentFile();
```

Results are immutable snapshots shared with other plugins; never mutate them.

Dates and durations are luxon objects. Create new ones with the engine's copy (`dc.luxon.DateTime.now()`) so they
compare correctly with engine values. `dc.coerce` converts loose values (`dc.coerce.date("2026-11-12")`), and
`dc.array(list)` wraps an array in the engine's chainable `DataArray`.

## Subscribe

```ts
const subscription = dc.subscribe<MarkdownTaskItem>(
    "@task and $completed = false",
    (tasks, meta) => {
        // Called once immediately (meta.initial === true), then whenever the result set changes.
        renderTasks(tasks);
    },
    { debounce: 250 } // ms after the last index change; default 500, 0 = immediate
);

subscription.dispose(); // optional: stops early
```

Other reactive hooks: `dc.watchFile(path, cb)` follows one file's indexed object, `dc.onRevision(cb)` fires on every
index change, and `dc.on(event, cb)` listens for `"initialized"`, `"index-progress"`, `"rename"` and
`"display-settings"`. Each returns a `Disposable`.

You do not need to dispose anything in `onunload`: every subscription made through the handle is disposed when your
plugin unloads.

## Lifecycle: reconnect and release

The handle is tied to your plugin, not to one engine instance.

- **Engine unloads** (the user disables or updates it): the handle becomes `revoked`. Any call then throws a
  `DatacoreError` with code `"revoked"`; check `dc.revoked` or listen with `dc.onRevoked(cb)`. Your subscriptions stay
  registered but stop firing.
- **Engine comes back**: the handle reconnects automatically, replays every live subscription (each fires again with
  fresh results), and calls `dc.onReconnected(cb)` listeners. Pass `reconnect: false` to stay disconnected instead.
  If the new engine no longer satisfies `minApi`, the handle stays revoked.
- **Your plugin unloads**: the client calls `dc.release()` for you. It disposes your subscriptions and removes you from
  the engine's list of connected consumers. Call `release()` yourself only if you want to disconnect earlier (for
  example from a settings toggle); it is idempotent. `dc.disposeAll()` disposes subscriptions but keeps the
  connection.

```ts
import { isDatacoreError } from "@yankeeinlondon/datacore-client";

dc.onRevoked(() => this.statusBar.setText("Datacore: offline"));
dc.onReconnected(() => this.statusBar.setText("Datacore: online"));

try {
    dc.query("@page");
} catch (error) {
    if (isDatacoreError(error) && error.code === "revoked") return; // the engine is reloading
    throw error;
}
```

## Guards and value helpers

Engine objects come from another plugin's bundle, so `instanceof` checks against your own classes never match. Use
the guards instead; they check structure (`$types`) or cross-bundle brands.

```ts
import {
    compare,
    isDateTime,
    isLink,
    isMarkdownPage,
    isTask,
    literalToString,
    typeOf,
} from "@yankeeinlondon/datacore-client";

for (const item of dc.query("@page or @task")) {
    if (isMarkdownPage(item)) console.log(item.$path, item.$tags);
    else if (isTask(item)) console.log(item.$status, item.$completed);
}

const due = page?.value("due");
if (isDateTime(due)) console.log(due.toISODate());
if (isLink(due)) console.log(dc.resolveLink(due));

typeOf(due); // "date" | "link" | "string" | "number" | … | undefined
literalToString(due); // display text, using the engine's default formats
[3, 1, 2].sort((a, b) => compare(a, b)); // the engine's ordering for any literal values
```

- Indexed objects: `isIndexable`, `hasIndexType`, `isFile`, `isMarkdownPage`, `isSection`, `isBlock`, `isListBlock`,
  `isCodeblock`, `isDatablock`, `isListItem`, `isTask`, `isCanvas`, `isCanvasCard`.
- Values: `isLink`, `isDateTime`, `isDuration`, `isDataArray`, `isDataObject`, `isLiteralArray`, `typeOf`,
  `wrapValue`, `isTruthy`, `equals`, `compare`, `literalToString`, `mapLeaves`.
- Grouped results: `isGrouping`, `isGroupLeaf`, `isGroupElement`, `groupingSize`, `sliceGrouping`.
- Errors: `isDatacoreError` (errors are identified by `code`, see `ERROR_CODES`).
- Versions: `satisfiesApi`, `parseVersion`.

## Versioning

The client re-exports the API contract. The contract's version is the API version: the engine reports it as
`dc.apiVersion`, and `minApi` is checked against it. It follows strict semver: new members arrive in minor versions,
and optional features are announced as capabilities (`dc.has("write")`). Client-only fixes are client patch releases
and do not change the API version.

`window.dc` is typed by this package too, for scripts and the developer console. Plugins should use `getDatacore()`.

## License

MIT
