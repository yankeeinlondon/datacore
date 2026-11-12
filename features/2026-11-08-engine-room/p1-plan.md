# P1 — Contract, Client & Engine API: Implementation Plan

| | |
|---|---|
| **Spec** | [spec.md](./spec.md) §7, §8, §12 (P1) |
| **Branch** | `p1-contract` (from `master` after P0 is merged) |
| **Goal** | The engine is reachable **only** through a versioned contract: `datacore-contract` defines it, `datacore-engine` implements and registers it, `datacore-client` locates and wraps it. |
| **Out of scope** | Moving the views out of the engine (P2), field writes (1.1), custom functions (1.2), npm publishing (P3) |

## Sequencing correction to the spec

Spec §12 lists "Preact removed from the engine" under P1, but the views only move to `datacore-view-preact` in P2.
The resolution: **in P1 the UI stays inside the engine plugin but consumes the engine exclusively through the new
API**, as if it were already a separate consumer. P2 then becomes a mechanical move plus the Preact removal. The spec
is updated accordingly at the end of P1.

## Exit criteria

1. `datacore-contract` defines the full v1 surface (§7.5): `DatacoreApi`, `ScopedDatacore`, `DatacoreLocalQueryApi`,
   data shapes, events, `IndexProgress`/`EngineStatus`, registry protocol types, capability names, brand keys. It
   contains no logic. api-extractor report committed.
2. The engine's classes (`MarkdownPage`, `Link`, …) `implements` the contract interfaces, and `EngineApiImpl
   implements DatacoreApi`. The compiler and `expectTypeOf` tests catch drift.
3. `datacore-client`: `getDatacore`/`tryGetDatacore` (load-order independent, timeout, `not-installed`/`disabled`/
   `incompatible`/`timeout`), scoped handles (auto-dispose, revocation, reconnect), identity-safe guards and value
   helpers. Tested without Obsidian (fake app + registry). api-extractor report committed.
4. The engine registers as the `host` provider on `window[Symbol.for("datacore-engine.registry")]`, revokes handles on
   unload, and exposes `window.dc` (§8.5).
5. Reactivity: `subscribe`, `watchFile`, `onRevision`, `on(...)` with the semantics in §7.6. The revision rule is a
   contract test.
6. Engine identity: plugin id `datacore-engine`, cache `datacore-engine/cache/<appId>` keyed by index schema version,
   `EngineSettings` split from view settings (§8.2–8.4).
7. The engine's UI code uses **only** the contract API, with no `core`/`datastore`/`initializer`/`settings` internals.
   This is enforced by a lint rule scoped to `src/ui/**` and `src/api/ui/**`.
8. No Obsidian prototype extensions in engine code; the test polyfills are removed.
9. Lint: zero warnings in `contract`, `client`, `shared`; the engine warning count is reduced (target: zero) and
   `--deny-warnings` is on for every package that reaches zero.
10. The upstream library build (`src/index.ts` + engine api-extractor report) is retired; api-extractor runs on
    `contract` and `client` instead.

## Steps

Each step ends green (CI sequence) and is committed separately. Steps 1–2 are cleanup that de-risks the rest.

### 1. Engine hygiene (no behaviour change)

- Replace Obsidian prototype extensions with standard JS: `Array.contains` → `includes` (9×), `Array.remove` →
  `indexOf`/`splice` (1×), `String.contains` → `includes` (1×, `utils/media.ts`, which the test polyfill never
  covered). Remove the polyfills from `src/test/setup.ts`.
- `console.log` → `console.debug`/`console.warn` (2×).
- Fix the 3 `no-misused-promises` violations (async overrides of void lifecycle methods): `onload() { void
  this.load…() }` pattern, then remove their per-file ESLint downgrade.
- Mechanical oxlint warnings: unused vars/params, useless escapes and spreads, the double non-null assertion.
- **Verify:** tests, plus a bundle module-set comparison against P0.

### 2. Engine API test harness

- A fake-vault fixture for engine tests: in-memory `Vault`/`MetadataCache` stand-ins rich enough to construct
  `Datacore`, index a few markdown/canvas files, and run queries. The P1 API tests are built on it, so it comes first.
- Port the `datastore-revision` test onto it as the first **contract test** (the revision rule).

### 3. Contract: types and protocol constants

- **Data shapes** as interfaces mirroring today's classes: `Indexable` hierarchy (`File`, `MarkdownPage`,
  `MarkdownSection`, `MarkdownBlock` + list/codeblock/datablock, `MarkdownListItem`/`MarkdownTaskItem`, `Canvas` +
  cards, `GenericFile`), `Link`, `Literal`/`DataObject`, `Field`/`Provenance`, `IndexQuery`, `Expression` (opaque),
  `SearchResult`, `DataArray`, `Result`.
- **API:** `DatacoreApi`, `ScopedDatacore`, `DatacoreLocalQueryApi`, `SubscribeOptions`, `SubscriptionMeta`,
  `Disposable`, `IndexProgress`, `EngineStatus`, `ConsumerInfo`.
- **Registry protocol:** `EngineRegistry`, `EngineProvider`, `ProviderEvent`, `REGISTRY_PROTOCOL_VERSION`.
- **Constants:** `ENGINE_REGISTRY_KEY`, `ENGINE_PLUGIN_ID`, brand keys (`LINK_BRAND_KEY`, `DATA_ARRAY_BRAND_KEY`),
  capability names (`CAPABILITIES`, with `write`/`functions` reserved), error codes (`DatacoreErrorCode`). Errors are
  identified by `code` rather than class, so they survive bundle boundaries.
- **Design rule:** no classes, no logic. `luxon` types are a type-only peer dependency.
- api-extractor config + report; `expectTypeOf` tests for key shapes.

### 4. Engine implements the contract

- Engine classes `implements` the contract interfaces (type-only change; mismatches are fixed in the contract or in the
  classes, whichever reflects intended behaviour).
- **Brands:** `Link` and `DataArrayImpl` carry their contract brand symbols.
- **`instanceof` audit (§7.4):** every engine `instanceof` that can see consumer-created values switches to
  brand/guard checks. Tests pass "foreign" `Link`/`DateTime`/`DataArray` copies (separately constructed classes)
  through `evaluate`, `query` and links.
- **`EngineApiImpl implements DatacoreApi`**: query/evaluate/links/coerce/array/`local(path)` wrap existing engine
  calls. `status()`/`ready()`/`index-progress` come from the initializer. `apiVersion` is stamped at build time from
  the contract's `package.json` (esbuild `define`); `engineVersion` from the engine's.
- **Reactivity (§7.6):** `subscribe` (initial call; re-run on revision; diff by `$id` + `$revision`; debounce default
  500 ms, `0` = immediate), `watchFile`, `onRevision`, `on("rename" | "initialized" | "index-progress")`, each
  returning a `Disposable`. Identical queries share one evaluation per revision.
- **Verify:** API tests on the fake vault (queries, subscriptions fire only on changes, debounce, dispose), the
  revision contract test, and foreign-copy tests.

### 5. Registry, scoping, and `window.dc` (engine side)

- `main.ts` `onload`: get-or-create the registry on `window`, register the `host` provider (priority 100), activate,
  drain waiters. `onunload`: emit `deactivating`, revoke all issued handles, deregister.
- `connect(consumer)` returns a `ScopedDatacore` that tracks the consumer's subscriptions; revocation disposes them,
  and later calls throw an error with code `revoked`.
- `window.dc`: read-only getter; never overwrites a foreign `window.dc` (warn instead); removed on unload.
- **Verify:** registry tests (engine-first and consumer-first load orders; unload/reload; foreign `window.dc`).

### 6. Client

- `getDatacore(app, { minApi, timeoutMs, consumer, reconnect })`: get-or-create the registry, wait for an active
  provider or time out. Failure reasons are derived from `app.plugins.manifests[ENGINE_PLUGIN_ID]` /
  `enabledPlugins`. The semver check on `apiVersion` uses a tiny local comparator, not a dependency.
- `tryGetDatacore` (synchronous).
- Scoped handle wrapper: auto-dispose when the consumer `Component` unloads; `onRevoked`; reconnect on re-activation.
- **Guards** (structural/brand-based): `isIndexable`, `isMarkdownPage`, `isSection`, `isBlock`, `isListItem`,
  `isTask`, `isCanvas`, `isLink`, `isDataArray`, `isDateTime`/`isDuration` (luxon's cross-copy checks).
- **Value helpers** (identity-safe `Literals` replacements): `typeOf`, `compare`, `isTruthy`, grouping helpers. Ported
  from `expression/literal.ts` with `instanceof` replaced by guards.
- `declare global { interface Window { dc?: DatacoreApi } }`.
- **Verify:** unit tests with a fake `app` and an in-test provider (all failure reasons, timeouts, both load orders,
  revocation + reconnect, version negotiation); guard/helper tests including foreign copies; api-extractor report.

### 7. Engine identity and settings

- Manifest: id `datacore-engine`, name "Datacore Engine", author Ken Snyder, version reset to `0.1.0` (new plugin
  identity), `versions.json` restarted. The upstream changelog is archived.
- Cache: `datacore-engine/cache/${app.appId}`; entries keyed by an **index schema version** constant, not the plugin
  version. Verify whether IndexedDB is shared across vaults (spec §14.1) and record the answer.
- **Settings (§8.2):** `EngineSettings` = indexing + `display: DisplaySettings` (formats, `nullAs`, paging, page size,
  scroll-on-page-change, render depth). `binaryop` stringification reads `display`. `enableJs` is the only
  view-specific option; it stays in the engine plugin until P2 moves it to `datacore-view-preact`. One settings tab,
  permanently owned by the engine. A one-time migration reads upstream-style flat `data.json` keys if present.
- Contract: `DisplaySettings`, `dc.settings.display`, and the `display-settings` event (views re-render on change).

### 8. Rewire the in-engine UI onto the API

- `ui/hooks.tsx`, `ui/loading-boundary.tsx`, `ui/javascript.tsx`, `api/local-api.tsx`, `api/api.ts`: replace every
  `core.*` internal access with the `DatacoreApi` obtained the same way a consumer would (`connect()` against the
  in-process provider). Hooks are built on `subscribe`/`watchFile`/`onRevision`, keeping debounce semantics.
- The script-facing `dc` keeps every documented member except `dc.core` (spec §9.2). Its removal lands here.
- Lint rule: `src/ui/**` and `src/api/ui/**` may not import `index/**` or `expression/**` runtime modules (types from
  the contract only).
- **Verify:** tests; a parity smoke vault (manual) renders the same views.

### 9. Retire the upstream library build; reporting

- Remove `src/index.ts` (library entry), `tsconfig.library.json`, `tsconfig.api-extractor.json`, the engine
  api-extractor config, and `datacore.api.md`. Their role passes to the contract/client reports.
- CI runs api-extractor for `contract` and `client` (report diffs fail via `git diff --exit-code`).
- Turn on `--deny-warnings` for packages at zero warnings.
- Update the spec (P1 ✅, sequencing note, findings) and write the P1 outcome.

## Risks

| Risk | Mitigation |
|---|---|
| Contract interfaces drift from engine classes | `implements` on every class + `expectTypeOf` tests + api-extractor reports |
| Subscription cost (re-run every query each revision) | Share evaluation for identical queries; debounce; measure on a large fixture |
| Renaming the plugin id loses users' settings | Pre-release only (no users yet); one-time `data.json` migration helper for testers |
| Removing `dc.core` breaks scripts that used internals | Documented breaking change; parity vault covers the documented surface |
| Prototype-extension removal changes behaviour subtly | `Array.contains` and `includes` are equivalent (no `NaN` cases in this code); covered by tests |

## Decisions taken before starting

1. The renamed `datacore-engine` plugin restarts at **0.1.0** (new plugin identity).
2. **One settings tab, owned by the engine, permanently** (spec §8.2): indexing + display defaults shared by all
   views; view plugins keep only plugin-specific options.
3. The fake-vault test fixture lives in `packages/engine/src/test/fixtures/`, promoted to a shared test package only
   if `view-preact` needs it in P2.

## Outcome (2026-11-11)

P1 is implemented on branch `p1-contract` (20 commits after `ee8998c`). `pnpm check` (format, lint, typecheck, tests,
manifests) and `pnpm build` (including api-extractor reports) pass. Tests: contract 7, shared 6, client 20, engine 389.

### Exit criteria

| # | Criterion | Result |
|---|---|---|
| 1 | Contract defines the v1 surface, no logic, API report | ✅ `datacore-contract`: 105 exports; constants are the only runtime code; `datacore-contract.api.md` |
| 2 | Engine classes `implements` the contract; drift caught | ✅ 18 `implements` clauses; a deliberate mismatch fails with TS2420 |
| 3 | Client: locator, scoped/reconnecting handles, guards, helpers; tested without Obsidian | ✅ `getDatacore`/`tryGetDatacore`, reconnect with subscription replay, guards and value helpers; 20 tests + end-to-end test against the real engine |
| 4 | Host provider registration, revocation, `window.dc` | ✅ `EngineHost`; both load orders, restart, revocation, foreign `window.dc` tested |
| 5 | Reactivity per §7.6; revision rule as a contract test | ✅ `subscribe`/`watchFile`/`onRevision`/typed events; shared evaluation per revision; revision rule tested against the real engine |
| 6 | Identity, cache, settings | ✅ `datacore-engine` 0.1.0; cache `datacore-engine/cache/<appId>` keyed by `INDEX_SCHEMA_VERSION`; engine-owned `display` settings with upstream migration |
| 7 | UI uses only the contract API; lint-enforced | ✅ `ViewServices` (engine/app/reader); lint forbids runtime imports of engine internals from UI code |
| 8 | No Obsidian prototype extensions in the engine | ✅ replaced; test polyfills removed |
| 9 | Zero warnings in contract/client/shared; `--deny-warnings` | ✅ contract, client, shared, view-preact at 0 with `--deny-warnings`; engine 152 → 23 |
| 10 | Upstream library build retired | ✅ api-extractor now runs on contract and client |

### Deviations

- **Preact stays in the engine plugin until P2** (sequencing correction above). In P1 the UI was rewired onto the
  contract API; the boundary rule covers engine *internals* (Datacore, datastore, cache, importers, settings, the API
  implementation). The UI still imports the engine's pure value helpers (`Literals`, `Groupings`, `Link` runtime),
  which P2 ports to identity-safe versions in `shared`/client before moving the views out.
- **`resolveLink` added to the contract** (link/link text → page, section, or block). The script loader needs it,
  and so will third-party plugins.
- **Registry functions live in `shared`** (pure functions over the registry object) and are bundled into both the
  engine and the client. The client bundles `shared` (`tsdown noExternal`), since `shared` is not published.
- **Workspace packages use a `source` export condition** (TypeScript sources for tsc/Vitest/esbuild in the workspace;
  `dist` for api-extractor and npm).
- **The engine's `DatacoreApi` (UI facade) was renamed `DatacoreViewApi`** to avoid clashing with the contract's
  `DatacoreApi`. `window.datacore` was removed in favour of `window.dc`.

### Bugs found and fixed

- Canvas file and web cards claimed to be text cards (`$types = CanvasTextCard.TYPES`).
- `tryQuery`/`tryFullQuery` threw on an unparseable query instead of returning a failure.
- `useIndexUpdates` never honoured `debounce: 0` (`settings?.debounce && settings.debounce == 0` is never true).
- Identity checks (`instanceof Link/DateTime/Duration/DataArrayImpl`) failed for values from other bundles; they now
  use brands and luxon's cross-copy checks.

### Findings carried into P2+

- **Global `Array.isArray` patch:** `data-array.ts` replaces `Array.isArray` so `DataArray`s count as arrays. That
  changes a global for every plugin in the vault; revisit before the store submission.
- **Value-helper port:** `Literals.compare`/`toString`/groupings need identity-safe versions (in `shared` or the client)
  before the views can leave the engine.
- **Remaining engine lint (23):** 16 template-literal/stringification findings in error messages, 6 unbound-method
  references in the expression engine, and Obsidian's declarative settings API (`getSettingDefinitions`).
- **`enableJs` is never read:** the setting exists but nothing enforces it. Decide in P2 whether JS views are gated.
- **IndexedDB scope across vaults** (spec §14.1) is still unverified in Obsidian; the cache name is vault-scoped
  either way.

### Manual check

Pending (needs Obsidian): install the P1 build (`packages/engine/scripts/install-built <vault>`, now
`.obsidian/plugins/datacore-engine/`) in the scratch vault, remove the old `datacore` plugin folder from P0, and
confirm: the views render as in P0, `window.dc` works in the console, the settings tab shows the Display and Indexing
sections (changing the page size re-renders tables), and the startup progress counter appears.
