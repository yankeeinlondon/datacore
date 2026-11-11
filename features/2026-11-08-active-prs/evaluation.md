# Upstream Open PR Evaluation (pre hard-fork)

| | |
|---|---|
| **Date** | 2026-11-08 |
| **Upstream** | `blacksmithgu/datacore` — fork `master` identical to upstream at `1a83c5b` |
| **Context** | [Engine Room spec](../2026-11-08-engine-room/spec.md) — split into `datacore-client` / `datacore-engine` / `datacore-preact` / `datacore-vue` |
| **Method** | One subagent per PR: read PR + discussion, read affected code, `git apply --check` against master |

## Verdicts

| PR | Title | Size | Applies | Lands in | Verdict |
|---|---|---|---|---|---|
| #180 | Object revision matches datastore revision | +1/-1 | ✅ | engine | **MERGE NOW** |
| #184 | Startup indexing progress rendering | +42/-9 | ✅ | engine + preact | **MERGE WITH CHANGES** |
| #122 | Log errors to console | +2/-0 | ✅ | preact | **MERGE WITH CHANGES** |
| #150 | `__filename` / `__dirname` in JS views | +27/-8 | ✅ | preact | **MERGE WITH CHANGES** |
| #181 | `dc.require('obsidian')` + builtins | +3/-0 | ✅ | preact | **MERGE WITH CHANGES** (or defer) |
| #84 | ES module import/export for scripts | +361/-51 | ❌ 8/13 files | preact (+engine leak) | **DEFER** |
| #157 | Multi-value inline fields | +299/-38 | ✅ | engine + client contract | **SKIP** (cherry-pick 2 fixes) |
| #87 | File access time tracking | +110/-5 | ❌ | engine | **SKIP** (cherry-pick extras) |

## Details

### #180 — MERGE NOW
`Datastore.store()` uses `this.revision++`, so stored objects carry `$revision = storeRevision - 1`. Changing it to `++this.revision` makes "objects changed in revision N have `$revision === N`". This is correct, and nothing in the code depends on the off-by-one. Side effect: the first object now gets revision 1 rather than 0, which no longer collides with the `?? 0` fallback.
- Cherry-pick only the one-line commit (`8a8a63c`), not the PR branch, which carries stale merge commits.
- Add a store/delete/store revision test; it doubles as a future `subscribe` contract test.
- User impact: scripts that used the `revision - 1` workaround need updating.

### #184 — MERGE WITH CHANGES
Fixes garbled `231751 / 1751` progress text on startup (issue #183). The fix renders a single text node and fires a new `index-progress` event. The initializer also yields 16 ms every 32 files so the UI can paint, which costs about 0.9 s on a 1,751-file vault. The logic is sound, and the #186 stuck-counter bug is already fixed in the latest commit.
- Change: add typed `on("index-progress")`/`trigger` overloads on `Datacore` instead of using raw `.events`.
- Optional: register the yield timer so it is cleared on unload.

### #122 — MERGE WITH CHANGES
The intent is right, but `console.error(error)` runs on every render of `SimpleErrorBoundary`, so it logs `undefined` constantly.
- Change: use `useErrorBoundary((err) => console.error("Datacore: script failed", err))`.
- Optional: keep stack traces at `ui/javascript.tsx:53` (currently `"" + ex`).
- The engine-side swallowed errors (`datacore.ts:385`, `importer.ts:120`, `importer.worker.ts:28`, `embed.tsx:171`) are left for the restructure.

### #150 — MERGE WITH CHANGES
Adds `__filename` and `__dirname` (vault-relative) to codeblock scripts and `dc.require`'d scripts. This fills a real gap: required modules receive the *caller's* `dc`, so today they cannot know their own location. The values are correct, and root files get `__dirname === ""`.
- Changes: one shared `__dirname` helper, docs (for codeblocks the values refer to the host `.md`), and an optional small test.
- Overlaps heavily with #84. Merge this first, and fold it into the future module loader.

### #181 — MERGE WITH CHANGES (or defer)
Routes any non-`[tj]sx?` string in `dc.require` to the plugin `require`, which gives access to `obsidian`, `@codemirror/*` and Node built-ins. **As written it breaks** string-path requires of markdown sections and codeblocks (`"scripts/lib.md#Foo"`). The unanchored, case-sensitive regex also misroutes modules like `events`.
- Change: use an explicit allowlist (`obsidian`, `@codemirror/*`, `@lezer/*`, `builtinModules`), wrap failures in a clear error, and update the docs.
- This is only a few lines, so it is cheap to port after the split if preferred.

### #84 — DEFER
ES `import`/`export` in scripts: sucrase's imports transform plus regex rewriting of `require` to `await dc.require`, `scriptRoots` settings, extensionless resolution in `Datastore.resolveLink`, and `export default` views.
- 8 of 13 files conflict (mostly the later `any`→`unknown` cleanup).
- It likely doesn't compile as shown (it calls undefined `addScriptRootsToSettings`).
- The regex rewriting is fragile.
- It loosens `resolveLink` for every caller, which would put module-resolution rules in the engine.
- No cache invalidation and no handling of circular imports.

The ideas are worth keeping: `ScriptDefinition`, script roots, and `export default`. Re-implement them as a **framework-agnostic module loader** shared by `datacore-preact` and `datacore-vue`, absorbing #150 and #181.

### #157 — SKIP (cherry-pick two fixes)
Adds `$infieldsMulti` (all occurrences per key) next to `$infields`.
- **Crash:** `MarkdownDatablock.from()` never sets `$infieldsMulti`, but `json()` maps over it, so any page with a datablock fails to import or persist (reproduced).
- **Not wired up:** the new extractor isn't used, so `value()` and queries still return the first value. Users get no Dataview-style arrays.
- **Storage:** every inline field is stored twice in memory and in IndexedDB, with no cache version bump.
- **API risk:** it would freeze a half-finished shape into the `datacore-client` contract.
- **Cherry-pick now:** `CanvasTextCard.json()` not serializing `$infields`, and `MarkdownCodeblock` not normalizing inline-field links.
- **Backlog:** multi-value fields done properly in the engine (a single list map, `$infields` derived from it, Dataview array semantics, a cache version bump).

### #87 — SKIP (cherry-pick extras)
Sets `$atime` on `file-open` by re-storing the page. **Data-loss bug:** the store happens without a substorer, so every file open deletes that page's sections, blocks, tasks and list items from the index. Each open also bumps the revision and re-runs every view. The maintainer rejected the design.
- **Cherry-pick:** the `.gitignore` `.docusaurus` typo fix, and possibly the `isFile`/`isTaggable`/`isLinkable`/`isLinkbearing` guards (use `includes`, not Obsidian's `contains`) as seeds for the `datacore-client` guards.
- **Backlog:** a separate "recent files" store in the engine with its own event.

## Merge plan (before P0)

Apply on a `pre-fork-upstream` branch, in this order to minimize conflicts:

1. #180 (cherry-pick `8a8a63c`) + revision test
2. #184 + typed `index-progress` event
3. #122 reworked with the `useErrorBoundary` callback
4. #150 + `__dirname` helper
5. #181 reworked with the allowlist (optional; could defer)
6. Hand-copied fixes: #157's canvas-card `$infields` serialization + codeblock inline-field link normalization; #87's `.gitignore` typo

Run `yarn jest` after each step and tag the result as the fork baseline.

## Requirements fed back into the Engine Room spec

- **Revision rule:** objects stored in revision N carry `$revision === N` (from #180).
- **Progress API:** the contract needs a typed `index-progress` event or a `status()` accessor (`{ initialized, total }`), so UIs never read `initializer` internals (from #184).
- **High-frequency UI state must never bump the index revision.** Things like access time and recent files get their own stores and events (from #87).
- **Module loader backlog:** a framework-agnostic script/module loader for the UI packages, covering ESM import/export, script roots, `__filename`/`__dirname`, builtin requires, a dependency graph, and invalidation on file change (from #84, #150, #181).
- **Engine backlog:** multi-value inline fields with Dataview semantics (from #157).

## Outcome (2026-11-08)

The merge plan was carried out on branch `pre-fork-upstream`, tagged **`fork-baseline`**. Original authors are credited as commit authors where their patch was applied as-is, and as `Co-authored-by` where it was reworked.

| Commit | Source | Notes |
|---|---|---|
| `e39f36d` | #180 | Applied as-is (author aaandreeew) |
| `8dfdeeb` | #180 follow-up | Revision regression test (fails without the fix) |
| `11b8091` | #184 | Applied as-is (author ProudBenzene) |
| `5960dab` | #184 follow-up | Typed `IndexProgress` payload + `on("index-progress")`; yield timer cleared on unload |
| `9371723` | #122 reworked | Log via `useErrorBoundary` callback; keep stacks in code block failures |
| `0cff387` | #150 | Applied as-is (author Gudine) |
| `b4f0468` | #150 follow-up | Reuse `getParentFolder`; docs ("Script Location") |
| `0b1728d` | #181 reworked | `isHostModule` allowlist (static `builtin-modules` list, mobile-safe; moved to `dependencies`); wrapped errors; tests; docs |
| `3e65ccb` | #157 (partial) | Canvas card `$infields` serialization + codeblock inline-field link normalization; tests fail without the fix |
| `97a1da7` | #87 (partial) | `.docusaurus` `.gitignore` typo |
| `e3b1651` | — | Export `IndexProgress` (`@public`) and refresh `datacore.api.md` |

Differences from the plan:
- The `is*` type guards from #87 were **not** ported. They belong in `datacore-client` (P1), written against `$types.includes`.
- No unit test for #150's script context: `ScriptCache` needs a mocked vault/datastore, and it will be covered by the module loader rewrite (spec §11.4).

Verification at `fork-baseline`: 345/345 tests (20 suites, up from 321/17), `tsc --noEmit`, library build + api-extractor, and the production plugin build all pass. A Prettier warning in `src/index/import/canvas.ts` predates this work (it is present on `master`).

Local environment note: Jest 27's reporter crashes because yarn v1 hoists `strip-ansi@7` (ESM) above `string-length`. It was worked around locally by placing `strip-ansi@6` in `node_modules/string-length/node_modules` (not committed). The P0 move to pnpm and Vitest removes the issue.
