# P2 — `datacore-view-preact`: Implementation Plan

| | |
|---|---|
| **Spec** | [spec.md](./spec.md) §4.2, §7.4, §8.2, §9, §11.5, §12 (P2), §14.2 |
| **Branch** | `p2-view-preact` (from `master` at the end of P1, `f2c11da`) |
| **Goal** | The Preact views, hooks, and script blocks live in their own plugin, `datacore-view-preact`, which reaches the engine **only** through `@yankeeinlondon/datacore-client` (plus private `shared`). The engine plugin contains no rendering code. |
| **Out of scope** | npm publishing and release CI (P3); the shared ES-module script loader (§11.5, later); field writes (1.1); Vue views (P5) |

## Starting point (inventory at `f2c11da`)

P1 left the UI inside the engine, already rewired onto the contract API (`ViewServices`: `engine`, `app`, `reader`).
What still ties it to engine code:

| UI dependency | Used by | P2 destination |
|---|---|---|
| `Literals.is{String,Number,Boolean,Null,Date,Duration,Link,Array,Object,Function}`, `Literals.equals` (→ `compare`) | `ui/markdown.tsx`, `ui/hooks.tsx`, `views/list.tsx`, `views/table.tsx`, `local-api.tsx`, `script-cache.ts` | Identity-safe helpers in `shared`, re-exported by the client (step 2) |
| `Groupings.{count,slice,isGrouping,isElementGroup}` | `views/table.tsx`, `views/list.tsx` | Same |
| `Link.infer`, `Link.parseInner` (bare `path#header` / `path\|display` without `[[ ]]`) | `ui/markdown.tsx` | **Contract gap:** `parseLink` only accepts `[[…]]` syntax (step 3) |
| `EngineLink.file` | `local-api.tsx` | `engine.fileLink` |
| `instanceof MarkdownListItem` / `MarkdownSection` / `MarkdownCodeblock` | `views/list.tsx`, `script-cache.ts` | Client guards `isListItem` / `isSection` / `isCodeblock` |
| `utils/normalizers` (`currentLocale`, `renderMinimalDate`, `renderMinimalDuration`, `getParentFolder`, `getFileTitle`, `lineRange`), `utils/media`, `utils/deferred` | markdown, embed, javascript, script cache, embed queue | `shared` (pure; luxon **type-only**, see the rules below) |
| `utils/javascript` (sucrase `transpile`, `asyncEvalInContext`, `isHostModule`) | `ui/javascript.tsx`, `script-cache.ts`, `local-api.tsx` | `view-preact` (only the views run scripts) |
| `api/result` (`Result`) | `ui/embed-queue.ts` | A local `Result` in view-preact, or a small one in `shared` if the engine can use it too |

Engine lint: 23 warnings. 5 (`script-cache.ts` ×4, `local-api.tsx` ×1) move with the views; 18 stay (step 9).

## Exit criteria

1. **`datacore-view-preact`** (id `datacore-view-preact`, "Datacore View: Preact") contains the codeblock processors,
   the script-facing local API (hooks, components, `dc.require`), the script cache, and the embed queue. Its datacore
   dependencies are `@yankeeinlondon/datacore-client` and `@yankeeinlondon/datacore-shared` only. Lint and pnpm
   isolation enforce this.
2. **The engine has no rendering code:** no `preact`, `sucrase`, codeblock processors, or CodeMirror modes; the bundle
   module list contains no `preact`. It keeps the settings tab, the reindex command, the registry host, and `window.dc`.
3. **Identity-safe value helpers** (`compare`, `equals`, `toString`, type predicates, groupings) are public in the
   client. There is one implementation (in `shared`), used by the engine and the views alike. Tests pass foreign
   `Link`/`DateTime`/`Duration`/`DataArray` copies.
4. **Codeblock languages** `dc`/`dct`/`dcx`/`dctx` with syntax highlighting. `datacore*` is never registered.
5. **Migration command** "Convert datacore code blocks to dc": preview with per-note counts, then rewrite. Fence-aware
   and idempotent; unit-tested on tricky inputs.
6. **Parity:** the parity vault (`fixtures/vault`) renders identically before (P1 engine) and after (engine +
   view-preact), checked by script.
7. **Lifecycle:** both load orders work; disabling and re-enabling the engine recovers the views (a "Datacore Engine
   is not enabled" notice while it is off); everything runs alongside upstream Datacore.
8. **`enableJs`** is resolved per the decision below. No setting exists that nothing reads.
9. **No global `Array.isArray` patch.**
10. **Lint:** engine at 0 warnings with `--deny-warnings`; view-preact at 0 with `--deny-warnings`.

## Decisions to confirm before starting

1. **Where the value helpers live.** *Recommended:* implement them in `shared` (pure functions; luxon and `Link` used
   only through guards and instance methods). The client re-exports them as public API (it already bundles `shared`),
   and the engine's `Literals`/`Groupings` namespaces become thin re-exports, so the engine and every consumer sort
   and stringify identically. *Alternative:* implement them in the client and keep the engine's own copy. That gives
   two implementations, which can drift.
2. **`enableJs`.** Every `dc*` block is a script, and the default is `false`, so enforcing the setting as it stands
   would switch every view off. *Recommended:* **drop it.** Installing and enabling `datacore-view-preact` is the
   opt-in to running scripts, and Obsidian already asks users to trust plugins. The view plugin then has no settings
   tab at all (spec §8.2 allows this). *Alternative:* keep it in view-preact, default `true`, enforced. When it is
   off, blocks render a notice instead of running.
3. **`Array.isArray` patch.** *Recommended:* **remove it.** Keep `DataArray` interop explicit: engine internals and the
   helpers use `isArray(x) || isDataArray(x)`, and `dc.array()`/`.array()` convert. This is a documented breaking change
   for scripts that relied on `Array.isArray(dataArray) === true`. *Alternative:* keep it, but install it only from
   view-preact for script contexts. This is not recommended, because it is still a vault-wide global.
4. **Link inference contract gap.** *Recommended:* add `inferLink(linkpath: string, display?: string): Link` to
   `DatacoreQueryApi`, matching `Link.infer` + `splitOnUnescapedPipe` semantics (contract **minor** bump). This is
   also useful to third parties. *Alternative:* the views build `[[…]]` text and call `parseLink`. That breaks on
   paths containing `]]` or `|`.

## Rules for code moving into `shared`

- Pure functions and constants only; no classes, no state, no runtime `obsidian` (existing lint).
- **luxon is type-only.** Functions may call methods on `DateTime`/`Duration` values they receive (`toFormat`,
  `shiftTo`, …), but never construct luxon values from an imported copy. When a function needs to construct one, the
  caller passes in `engine.luxon`. This keeps luxon out of the view bundle and avoids cross-copy objects.
- No Obsidian prototype extensions (`includes`, not `contains`).

## Steps

Each step is gated on `pnpm check && pnpm build` and committed separately. Steps 1–4 happen **inside the engine**
(UI still bundled there), so every step is a runnable plugin. Step 5 is then a mechanical move, as in P1.

### 1. Parity vault and baseline

- `fixtures/vault/`: a generated vault (a committed generator script, `fixtures/generate.ts`, producing the 300
  book/author/task notes used in P0/P1), plus one note per view and hook: `Table` (paged, grouped, default paging),
  `List` (grouped, nested list items), `Card`, `Callout`, `Stack`/`Group`, `Literal` over each value type,
  `Markdown`, `Link`/`LinkEmbed`/`SpanEmbed`, form controls, `useQuery`/`useFullQuery`/`useFile`/`useCurrentFile`/
  `useIndexUpdates`, `dc.require` (relative import, `__filename`/`__dirname`, a host module), and an error case.
  Notes use `datacorejsx` etc. for the baseline; the migration command (step 7) converts them, which also tests it.
- `fixtures/parity.ts`: drives a running Obsidian through `obsidian-cli eval`. **It never steals focus:** it renders
  each note with `MarkdownRenderer.render()` into a detached element owned by a throwaway `Component`, so it opens no
  leaves and no settings, and sends no keystrokes. It waits for `dc.ready()` and the views' debounce, then writes a
  normalized HTML snapshot per note (strip generated ids and timestamps).
- Capture the **baseline** from the P1 build and commit the snapshots (`fixtures/parity/baseline/`).

### 2. Identity-safe value helpers (`shared` → client)

- Port from `expression/literal.ts` into `shared/src/values/`: `wrapValue`, `typeOf`, the type predicates (`isString`
  … `isFunction`, with `isLink`/`isDate`/`isDuration`/`isDataArray` built on brands and luxon's cross-copy checks),
  `compare` (with the optional link normalizer), `equals`, `toString` (with `ToStringSettings` = the display settings'
  formats), `isTruthy`, `mapLeaves`, and `Groupings` (`isElementGroup`, `isGrouping`, `isLeaf`, `count`, `slice`).
  Move `renderMinimalDate`/`renderMinimalDuration`/`normalizeDuration`/`currentLocale` with them.
- Client: re-export as public API. This replaces P1's partial `typeOf`/`isTruthy`/`isGrouping` in `client/src/values.ts`
  (one implementation). api-extractor report updated (client minor).
- Engine: `Literals`/`Groupings` re-export the `shared` functions. `deepCopy` stays engine-only (it constructs values).
  Engine tests cover behaviour; new `shared` tests cover foreign copies (separately constructed `Link`/luxon/`DataArray`).
- **Verify:** all engine tests unchanged and green; bundle check shows a single copy of the helpers.

### 3. Close the contract gaps the views need

- `inferLink` (decision 4), implemented in `QueryApiImpl`, with tests.
- Pure utilities into `shared`: `getParentFolder`, `getFileTitle`, `lineRange` (+ `lineSpan`), `utils/media` (link
  type-only), `utils/deferred`. The engine imports them from `shared`.
- Re-check `local-api.tsx` and `api.ts` for any remaining engine-runtime reach (e.g. `DataArray` construction must go
  through `engine.array`, and `Coerce` through `engine.coerce`).

### 4. Rewire the UI imports in place, then tighten the lint rule

- Replace every UI import of `expression/**`, `index/**`, `api/result`, and `utils/{normalizers,media,deferred}` with
  the client/`shared`. `instanceof` engine classes → client guards. `Link.infer`/`parseInner` → `engine.inferLink`.
- `utils/javascript.ts` moves under `ui/` (it is view-only).
- Tighten the P1 boundary rule: `src/ui/**`, `src/api/ui/**`, `api/{api,local-api,script-cache}.ts` may import only
  `@yankeeinlondon/datacore-client`, `@yankeeinlondon/datacore-shared`, `preact*`, `obsidian`, and each other.
- **Verify:** tests and the parity script (identical to the baseline).

### 5. Move the views into `datacore-view-preact`

- `git mv` the UI files (`ui/**`, `api/ui/**`, `api/{api,local-api,script-cache}.ts(x)`, CSS) into
  `packages/view-preact/src/`, keeping history. Rename `DatacoreViewApi` → `PreactViewApi` (no clash with the contract).
- Dependencies: `preact`, `sucrase`, `builtin-modules`, `@datastructures-js/queue`; `luxon` as a **type-only** dev
  dependency. esbuild config copied from the engine (JSX, CSS bundling into `styles.css`).
- `main.ts`: `getDatacore(app, { consumer: this, reconnect: true })`. Until it resolves, and while the handle is
  revoked, blocks render a notice: "Datacore Engine is not enabled", with the reason from the client (`not-installed`,
  `disabled`, `incompatible`, `timeout`). On reconnect, the open blocks re-render: each block's component subscribes to
  the handle's connection state.
- Move the UI tests that exist (and the fake-vault fixture if view tests need it; P1 decision 3) and add tests for
  the connection states with a fake provider.
- Engine: delete the moved code, the codeblock processors, the CodeMirror modes, `EmbedQueue`, `ViewServices`, and the
  `preact`/`sucrase`/`@datastructures-js/queue` dependencies; drop the Preact JSX settings from its tsconfig/esbuild.
- **Verify:** both bundles' module lists (engine: no `preact`/`sucrase`; view: no engine modules, one copy of
  client + shared); smoke-load both `main.js` files under jsdom with a stubbed `obsidian`, in both load orders; parity
  script against the baseline (still with `datacore*` fences, which view-preact registers **temporarily** until step 6).

### 6. Codeblock languages `dc` / `dct` / `dcx` / `dctx`

- Register the four processors (priority −100 as today) and the CodeMirror modes (`javascript`, `text/typescript`,
  `jsx`, `text/typescript-jsx`), reverting the modes on unload. Remove the temporary `datacore*` registration.
- Spec §14.2: record what Obsidian does when two plugins register the same language (test with a throwaway plugin in
  the scratch vault). Only defensive handling is needed, since the names no longer collide with upstream.
- Docs pages that show `datacore*` fences: update the language names. The docs site rewrite stays out of scope.

### 7. Migration command: "Convert datacore code blocks to dc"

- Pure core in view-preact, `convertFences(text) → { text, changes }`: a line-based fence scanner that honours
  ```` ``` ```` / `~~~` fences of any length, indentation, and blockquote/callout prefixes (`> `). It rewrites only an
  opening fence's info string (`datacorejs→dc`, `datacorets→dct`, `datacorejsx→dcx`, `datacoretsx→dctx`), keeps
  anything after the language word, and **does not** touch fences nested inside another fence (e.g. a `datacorejsx`
  example inside a ```` ````markdown ```` block). Idempotent.
- Command: scans markdown files (`vault.cachedRead`), shows a modal listing affected notes and counts, and on confirm
  rewrites each with `vault.process` (re-running the pure function on the current content). Reports a summary notice.
- Tests: plain, tilde, long fences, indented, callout-nested, nested-in-fence, info strings with attributes, CRLF,
  already-converted, and no-op files. Then convert the parity vault and confirm the snapshots are unchanged apart from
  the language class.

### 8. `enableJs`

- Per decision 2. Recommended path: remove `enableJs` from the engine's `Settings`, `ENGINE_KEYS`, and the migration
  (a stale key in `data.json` is ignored and dropped on next save), with a settings-migration test. Alternative: move
  it to view-preact with default `true`, enforce it in the codeblock processor, and add a single toggle (or command).

### 9. Engine cleanup: `Array.isArray`, lint to zero

- **`Array.isArray` patch (decision 3):** audit every `Array.isArray` in the engine for places that relied on the patch
  to accept `DataArray` (e.g. `data-array.ts` flatten/expand, the evaluator's list handling, `Literals.isArray`,
  `Coerce`). Switch those to `isArray || isDataArray`, add tests that pass `DataArray`s through each path, then delete
  the patch. The parity script must stay identical.
- **Lint, 18 remaining:**
  - template-literal/stringification (11): format values explicitly (`String()`, `JSON.stringify`, or
    `Literals.toString` where it is a user-facing value).
  - `unbound-method` (6, expression evaluator/functions and `datacore.ts`): arrow wrappers or `this: void` signatures
    on the function-table types.
  - `prefer-setting-definitions` (1): implement `getSettingDefinitions()` alongside `display()`, which older Obsidian
    versions still use. If the declarative API cannot express the dropdowns or the diagnostics, disable the rule for
    that line with a reason.
- Turn on `--deny-warnings` for the engine and view-preact.
- **Settings tab diagnostics (spec §8.2):** index status and connected consumers (from `ConsumerInfo`). This becomes
  meaningful now that view-preact is a real consumer.

### 10. Verification, docs, outcome

- Parity script: identical to the baseline (apart from the expected language-class difference).
- Manual check in the scratch vault (driven with `obsidian-cli`, with no focus-stealing actions while the machine is
  in use):
  - install both plugins with `install-built` (extend it to take a package);
  - engine-first and view-first load orders;
  - disable the engine → notice; re-enable → views recover without reopening notes;
  - upstream Datacore installed alongside, with both `datacorejsx` and `dcx` blocks rendering from their own plugins;
  - the migration command on a copy of the vault.
- Update the spec (P2 ✅, decisions, §14.2 answer), and write the P2 outcome here.

## Risks

| Risk | Mitigation |
|---|---|
| Parity snapshots are noisy (ids, timing, debounce) | Normalize HTML; wait for `dc.ready()` plus a settle period; render detached so layout state does not leak in |
| Removing the `Array.isArray` patch changes engine behaviour on `DataArray` values | Audit plus `DataArray` tests per path before removal; parity check after |
| Two luxon copies (engine vs. view bundle) | luxon is type-only in `shared`/view-preact; values come from `engine.luxon`; bundle check asserts no luxon in view-preact |
| Reconnect leaves stale blocks after an engine restart | Blocks subscribe to connection state and re-render; tested with a fake provider and manually |
| The migration command corrupts notes | Pure, fence-aware function with edge-case tests; preview before writing; `vault.process` re-reads current content; recommend a backup in the modal |
| `inferLink` widens the contract | Small, link-only, mirrors existing engine behaviour; api-extractor review |
| Test/driver scripts steal focus on a machine in use | Parity and manual checks render detached and use `eval` only; nothing opens leaves, settings, or modals unless the step needs it, and those steps are flagged to run when the machine is free |
