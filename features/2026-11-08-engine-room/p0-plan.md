# P0 — Monorepo Scaffold: Implementation Plan

| | |
|---|---|
| **Spec** | [spec.md](./spec.md) §10, §12 (P0) |
| **Branch** | `p0-monorepo` (from `master` fast-forwarded to `fork-baseline`) |
| **Goal** | New structure and tooling with **no behaviour change**: the engine package still builds the same single plugin (UI included) as `fork-baseline` |
| **Out of scope** | Identity changes (plugin id, cache name, globals), contract/client content, any engine refactor: all P1+ |

## Exit criteria

1. `pnpm install` from a clean clone; no yarn artefacts remain.
2. `pnpm -r build` succeeds. The engine's plugin bundle (`main.js`) is **equivalent to the `fork-baseline` bundle** (identical after stripping esbuild's `// path` comment lines and normalizing `node_modules/.pnpm/...` paths).
3. `pnpm test`: all **345** tests pass under Vitest (no Jest left).
4. `pnpm typecheck` (`tsc -b`), `pnpm lint` (oxlint), and `pnpm fmt:check` (oxfmt) are clean.
5. The `contract`, `client`, `shared`, `view-preact` and `view-vue` scaffolds exist and build/typecheck (empty).
6. Changesets is initialized for all packages; the docs site builds as a workspace package.
7. TypeScript and esbuild are upgraded, each in its own verified commit.

## Baseline capture (before step 1)

Build `fork-baseline` with the current toolchain and keep the artefacts outside the repo for comparison:

- `build/plugin/main.js`, `build/plugin/styles.css`, `build/library/index.js`, `datacore.api.md`
- the test count (345) and test names (`jest --listTests` + per-suite counts)

A small compare script (`scripts/compare-bundle.mjs`, removed at the end of P0) normalizes and diffs bundles.

## Steps

Each step ends green, gets its own commit(s), and is verified before the next one starts.

### 1. pnpm workspace + move the code into `packages/engine`

- Root `package.json` becomes the workspace root: `private`, `packageManager: pnpm@10.x`, `engines.node: ">=22"`, root scripts delegating to packages.
- `pnpm-workspace.yaml`: `packages/*`, `docs`.
- `git mv` into `packages/engine/`: `src/`, `esbuild.config.mjs`, `tsconfig*.json`, `api-extractor.json`, `datacore.api.md`, `manifest.json`, `manifest-beta.json`, `versions.json`, `jest.config.js`, `scripts/` (upstream release scripts; superseded by Changesets in P3). `.prettierrc` stays at the root until step 4.
- `packages/engine/package.json`: `@yankeeinlondon/datacore-engine`, `private`, with upstream's dependencies and scripts.
- **Keep exact dependency versions**: `pnpm import` from `yarn.lock` to seed `pnpm-lock.yaml`, then delete `yarn.lock`. Check that the git-hosted dependencies (`@codemirror/language` fork, `esbuild-plugin-inline-worker`) resolve.
- Root `.nvmrc` (`22`).
- **Verify:** `tsc` passes; Jest still runs 345 tests (Jest is replaced in step 2, so only fix what the move breaks); plugin + library build; bundle equivalence vs baseline; api-extractor report unchanged.

### 2. Jest → Vitest

- Add `vitest`, `jsdom`, `vite-tsconfig-paths` to the engine; `vitest.config.ts` with `environment: "jsdom"`, path resolution via the engine's `baseUrl: "src"`, and `setupFiles`.
- **Shared Obsidian test setup** (spec §4.2.1): `obsidian` resolved to a shim module (`test/shims/obsidian.ts`: `TFile`, `TFolder`, and whatever else the suites touch) via `resolve.alias`, plus polyfills for `Array.prototype.contains` / `remove`. Remove the per-file `jest.mock` + polyfill in `datastore-revision.test.ts`.
- Convert tests with a codemod: explicit `import { describe, it, test, expect, … } from "vitest"`, `jest.*` → `vi.*`.
- Remove `jest`, `ts-jest`, `@types/jest`, `jest.config.js`, and the `jest` block in `tsconfig.json`. This also eliminates the `strip-ansi` hoisting workaround.
- **Verify:** 345 tests pass, same suite/test names as the baseline listing.

### 3. Scaffold the other packages + TypeScript project references

- `tsconfig.base.json` (shared options). Each package has its own `tsconfig.json` extending it; the root `tsconfig.json` has `references` only; `pnpm typecheck` = `tsc -b`.
- **`packages/contract`** (`@yankeeinlondon/datacore-contract`, `0.0.0`): `strict`, `src/index.ts` placeholder, tsdown config (ESM + d.ts, `exports` map), api-extractor config, Vitest with one `expectTypeOf` smoke test.
- **`packages/client`** (`@yankeeinlondon/datacore-client`, `0.0.0`): same setup; depends on `contract` (`workspace:^`), re-exports it.
- **`packages/shared`** (`@yankeeinlondon/datacore-shared`, private): `strict`, source-only (`exports` → `src/index.ts`), Vitest.
- **`packages/view-preact`** (`@yankeeinlondon/datacore-view-preact`, private): manifest (`datacore-view-preact`, "Datacore View: Preact"), minimal no-op `Plugin` subclass, esbuild config, depends on `client` + `shared` only.
- **`packages/view-vue`** (`@yankeeinlondon/datacore-view-vue`, private): manifest (`datacore-view-vue`, "Datacore View: Vue"), README, tsconfig. No build yet.
- The engine keeps its current (non-`strict`) flags.
- **Verify:** `pnpm -r build`, `pnpm typecheck`, `pnpm test` all green; engine bundle still equivalent.

### 4. oxlint + oxfmt

- `oxfmt --migrate=prettier` → `.oxfmtrc.json`; delete `.prettierrc` and Prettier. **One commit** reformats the repo with oxfmt; its SHA goes in `.git-blame-ignore-revs`.
- `.oxlintrc.json`: TypeScript, import, Vitest and oxc plugins; type-aware rules via `oxlint-tsgolint`; `no-restricted-imports`:
  - view packages may not import `@yankeeinlondon/datacore-engine`;
  - `shared` may not import `obsidian` at runtime; `class` declarations are banned in `shared` (rule or a custom check).
- `eslint-plugin-obsidianmd` via `jsPlugins`. **If incompatible** (alpha support), fall back to a minimal `eslint.config.mjs` that runs only the obsidianmd rules, and record that in the spec.
- Existing engine findings: fix trivial ones; for the rest, set the rule level with a comment linking to a follow-up (no blanket disables).
- **Verify:** `pnpm lint` and `pnpm fmt:check` clean; tests and builds still green; the engine bundle is equivalent apart from formatting-only source changes (verified via test pass + compare script output review).

### 5. Changesets

- `@changesets/cli`; `.changeset/config.json`: `privatePackages: { version: true, tag: true }`, `ignore: ["docs"]`, `updateInternalDependencies: "patch"`, `access: "public"` for the npm packages.
- `scripts/sync-plugin-manifests.mjs`: after `changeset version`, copy each plugin package's version into its `manifest.json` and append to `versions.json` (`version → minAppVersion`). The root `version` script = `changeset version && node scripts/sync-plugin-manifests.mjs`.
- No publishing workflow yet (P3).
- **Verify:** a dry run (`changeset version` on a throwaway branch with a test changeset) bumps the right packages and syncs manifests; then discard it.

### 6. Docs as a workspace package

- Remove `docs/yarn.lock`; the docs package becomes `@yankeeinlondon/datacore-docs` (private), installed by the root pnpm install.
- Update `.github/workflows/deploy-docs.yml` and `test-deploy-docs.yml`: pnpm (`pnpm/action-setup`), Node 22, `pnpm --filter @yankeeinlondon/datacore-docs build`.
- **Verify:** `pnpm --filter @yankeeinlondon/datacore-docs build` succeeds locally.

### 7. Toolchain upgrades (separately)

- **7a TypeScript** → latest 5.x across the workspace. Fix any new errors. Verify: typecheck, tests, builds.
- **7b esbuild** → current version in the engine (and view-preact). Pay particular attention to `esbuild-plugin-inline-worker`, a git-hosted fork with a `esbuild@latest` peer: confirm the worker still bundles and runs (worker import test + bundle inspection). If the plugin breaks, vendor a small inline-worker plugin into `packages/engine/build/` rather than pin esbuild forever. Verify: tests, bundle sanity (the worker is present), plugin loads in a scratch vault.

### 8. CI

- `.github/workflows/ci.yml`: on push/PR → pnpm install (frozen) → `typecheck`, `lint`, `fmt:check`, `test`, `build`.
- **Verify:** workflow syntax check locally (`actionlint` if available); first run happens on push.

### 9. Wrap-up

- Remove `scripts/compare-bundle.mjs` (or keep it under `scripts/dev/` if still useful).
- Update the spec: mark P0 ✅ and record any deviations (e.g. an obsidianmd fallback).
- Changeset entries are not needed for P0 (nothing user-facing is released).

## Manual check (once, after step 7)

Install the built engine plugin (still id `datacore` in P0) into a scratch vault without upstream Datacore. Confirm it indexes, a `datacorejsx` view renders, and the progress counter shows on startup. A single smoke test confirms "no behaviour change" beyond the automated bundle comparison.

## Risks specific to P0

| Risk | Mitigation |
|---|---|
| Git-hosted dependencies misbehave under pnpm | `pnpm import` from `yarn.lock`; verify both resolve in step 1 before going further |
| Bundle drift hidden by the move | Normalized bundle comparison after steps 1, 3 and 4 |
| oxlint JS plugin (alpha) can't run obsidianmd | ESLint fallback for those rules only |
| esbuild upgrade breaks worker inlining | Isolated step 7b; vendor a minimal plugin if needed |
| Reformat commit makes blame noisy | `.git-blame-ignore-revs` |

## Outcome (2026-11-11)

P0 is complete on branch `p0-monorepo` (20 commits after `ca33fbd`). Every step was verified before the next began. The
full CI sequence (`pnpm install --frozen-lockfile`, `fmt:check`, `lint`, `typecheck`, `test`, `build`,
`manifests:check`, `git diff --exit-code`) passes from a clean install.

### Exit criteria

| # | Criterion | Result |
|---|---|---|
| 1 | Clean pnpm install, no yarn artefacts | ✅ `yarn.lock` and `docs/yarn.lock` removed; `pnpm-lock.yaml` tracked |
| 2 | Engine bundle equivalent to `fork-baseline` | ✅ byte-equivalent (normalized) through step 7a. After the esbuild 0.28 upgrade (7b): identical bundled module set (153), inline worker present, size within 0.2%, smoke-load exports the same `Plugin` subclass |
| 3 | 345 tests under Vitest | ✅ titles identical to the Jest baseline; plus contract (2) and client (1) tests |
| 4 | typecheck / lint / fmt clean | ✅ 0 errors (warnings are upstream code, tracked below) |
| 5 | Scaffolds build/typecheck | ✅ contract, client, shared, view-preact (no-op plugin), view-vue (identity only) |
| 6 | Changesets for all packages; docs build | ✅ dry run verified bumps, cascade and manifest sync, then discarded |
| 7 | TypeScript and esbuild upgraded separately | ✅ TS 5.9.3; esbuild 0.28.2; also ESLint 10.13.0 and `@types/node` 22 |

### Deviations from the plan

- **No TypeScript project references.** `composite` requires declaration emit, which clashes with the engine's
  `noEmit` setup. Instead there is a shared `tsconfig.base.json` with per-package `tsc --noEmit`. Workspace packages
  export `src` during development and swap to `dist` via `publishConfig`, so cross-package typechecking needs no
  prebuild.
- **No `vite-tsconfig-paths`.** It only applies `baseUrl` to files matched by a tsconfig's `include`. Explicit
  Vitest aliases mirror the engine's bare-import roots instead.
- **Lint is a hybrid.** oxlint is primary (type-aware via tsgolint, untyped obsidianmd rules via `jsPlugins`,
  boundaries, local `datacore/no-class`). A minimal ESLint runs the 7 **type-aware** obsidianmd rules plus
  manifest/license validation, which oxlint's JS-plugin bridge cannot run (no TypeScript program for JS plugins).
- **Engine tsconfig modernized** (needed by tsgolint, which is TypeScript 7-based): `paths` instead of `baseUrl`,
  `moduleResolution: bundler`, no `downlevelIteration`, `include: ["src"]`. Bundles verified equivalent.
- **pnpm isolation enforced per project:** `.npmrc` sets `shamefully-hoist=false`, because a user-level `.npmrc` had
  `shamefully-hoist=true`, which silently defeats the package boundaries (D9).
- **Docs needed pnpm fixes:** `packageExtensions` (theme-classic → webpack), a `webpack` override to the
  upstream-locked 5.95.0 (Docusaurus 3.5.2 deep-imports a file later webpack moved), and an explicit
  `@docusaurus/theme-classic` devDependency for the docs typecheck.
- **Engine version aligned** to its last released manifest (0.1.29). Upstream's package.json lagged, and its release
  script always wrote `minAppVersion` 0.12.0 into `versions.json`.
- **TypeScript 7.0.2 is now the latest release** (6.0.3 is the transition release). Per D10 we stayed on 5.x
  (5.9.3); moving to 7 is a separate decision (api-extractor, tsdown d.ts generation, typescript-eslint
  `<6.1.0` peer).

### Bugs found and fixed along the way

- **Canvas cards lost data under define-semantics class fields** (`98c833b`): subclasses re-declared fields that
  `BaseCanvasCard` assigns via `Object.assign`; now `declare`d. Latent in production (es2018 + legacy semantics),
  exposed by Vitest/Oxc.
- **Two `meta()` assertions never ran** (`a350d84`): `.toBeNull` without `()`.
- **`editProvenance` could return `undefined`** for intrinsic provenance (`efe36cd`). The file was outside tsc's
  entry-point include list, so the error went unnoticed.

### Carried into P1 (from linting and the migration)

- **Registry global:** obsidianmd `no-global-this` flags `globalThis`; put the registry on `window` (spec §7.2).
- **3 `no-misused-promises` violations** (async `onload` overrides in `datacore.ts` and `javascript.tsx`, and an
  async attribute handler in `embed.tsx`): downgraded to warnings per file in `eslint.config.mjs`; fix when those
  files are reworked.
- **~150 oxlint warnings** in upstream code (81 unused vars, 16 floating promises, 11 template-literal coercions, …):
  burn down in P1, then enable `--deny-warnings`.
- **Obsidian prototype extensions** (`Array.prototype.contains`/`remove`) are still polyfilled in tests
  (`src/test/setup.ts`); remove them from engine code (spec §4.2.1).
- **Field writes (1.1):** `editProvenance` deletes a frontmatter key and then immediately re-assigns it, so deletion
  never takes effect.
- **`console.log` calls** in `main.ts`/`datacore.ts` (Obsidian guidelines allow warn/error/debug only).

### Manual check

Still to do (needs Obsidian): install the built engine plugin into a scratch vault **without** upstream Datacore
(`packages/engine/scripts/install-built <vault>`, plugin id still `datacore` in P0). Confirm it indexes, a
`datacorejsx` view renders, and the startup progress counter shows.
