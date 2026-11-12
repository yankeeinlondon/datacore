# @yankeeinlondon/datacore-contract

The API contract of the **Datacore Engine** Obsidian plugin: TypeScript interfaces, data shapes, the registry protocol,
and the protocol constants that the engine and its clients agree on.

## Are you writing an Obsidian plugin? Use the client instead

If you want to **query the vault from your plugin**, install
[`@yankeeinlondon/datacore-client`](https://www.npmjs.com/package/@yankeeinlondon/datacore-client), not this package:

```sh
pnpm add @yankeeinlondon/datacore-client
```

```ts
import { getDatacore, isTask, type MarkdownPage } from "@yankeeinlondon/datacore-client";

const result = await getDatacore(this.app, { consumer: this, minApi: "1.0" });
if (result.ok) {
    const books = result.engine.query<MarkdownPage>("@page and #book");
}
```

The client re-exports everything in this package (every type and constant below is importable from it) and adds
`getDatacore()`, reconnect handling, and identity-safe guards. Do not depend on both: two copies of the contract would
split its branded types. See the client's README for the full guide.

Depend on the contract directly only if you are **implementing** the engine side of the protocol, or you need the types
without any runtime code.

## Install

```sh
pnpm add @yankeeinlondon/datacore-contract
# or: npm install @yankeeinlondon/datacore-contract
```

Also on [JSR](https://jsr.io/@yankeeinlondon/datacore-contract), as TypeScript source with the same API:

```sh
npx jsr add @yankeeinlondon/datacore-contract
# or: deno add jsr:@yankeeinlondon/datacore-contract
```

## What is in it

- **The engine API**: `DatacoreApi` (queries, expressions, links, subscriptions, events, status), `ScopedDatacore`
  (the per-consumer handle with `revoked`, `onRevoked`, `disposeAll`, `release`), `DatacoreLocalQueryApi`,
  `SubscribeOptions`, `SubscriptionMeta`, `EngineStatus`, `IndexProgress`, `Disposable`.
- **Indexed objects**: `Indexable`, `MarkdownPage`, `MarkdownSection`, `MarkdownBlock`, `MarkdownListItem`,
  `MarkdownTaskItem`, `MarkdownCodeblock`, `MarkdownDatablock`, `Canvas` and canvas cards, plus fields
  (`Field`, `FrontmatterEntry`, `InlineField`).
- **Values**: `Literal`, `Link`, `DataObject`, `DataArray`, `Grouping`, `Coerce`, `Result`, the query and expression
  ASTs (`IndexQuery`, `Expression`), and `DisplaySettings`.
- **Registry protocol**: `EngineRegistry`, `EngineProvider`, `ProviderEvent`: the load-order independent handshake the
  engine and clients perform on the main `window` under `Symbol.for(ENGINE_REGISTRY_KEY)`.
- **Constants**: `ENGINE_PLUGIN_ID` (`"datacore-engine"`), `ENGINE_REGISTRY_KEY`, `REGISTRY_PROTOCOL_VERSION`,
  `BRAND_KEYS`, `INDEX_TYPES`, `CAPABILITIES`, `ERROR_CODES`.

The package is almost entirely types; its runtime code is the constants above. Date and duration types come from
luxon (`@types/luxon` is a dependency); the engine supplies luxon itself at runtime as `dc.luxon`.

## Versioning

This package's version **is** the Datacore API version. The engine reports it as `apiVersion`, and clients compare it
with `getDatacore({ minApi })`. From 1.0.0 it follows strict semver:

- Adding a member, type, event or capability is a **minor** release.
- Removing or changing a member is a **major** release.
- Optional features within a major are announced through capabilities (`dc.has("write")`). Version 1.0 advertises
  `query` and `subscribe`; `write` and `functions` are reserved for later minors.

## License

MIT
