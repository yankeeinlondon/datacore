# P2.1 + P3 + P4: stabilize, publish, submit

| | |
|---|---|
| **Spec** | [spec.md](./spec.md) §10.4 (release), §12 (P3, P4) |
| **Base** | `master` at `4152d84` (P2 merged and pushed, 2026-11-12) |
| **Goal** | Everything up to, not including, the Vue view layer (P5): the P2 findings fixed, contract and client 1.0.0 on npm, both plugins released through their own repos (BRAT betas, then 1.0.0), docs live, both plugins submitted to the community store. |
| **Out of scope** | `datacore-view-vue` (P5); the shared ES-module script loader (§11.5); field writes (1.1) |

## Decisions (2026-11-12, Ken)

1. **Authority:** push to origin, create the release repos, publish to npm, and open the store PR without stopping
   to ask each time. Each is reported when done.
2. **Script `dc` gains the path-scoped contract API** (`page()`, `inferLink`, …) next to the hooks and components,
   so scripts and plugins share one documented surface. Existing members keep upstream's behaviour.
3. **Versions:** plugins ship BRAT betas as `0.1.0-beta.N`, then `1.0.0` for the store, alongside contract and
   client `1.0.0`.
4. The empty `features/2026-11-10-{callout,card,list,table}` folders are placeholders with no content; nothing to
   deliver.

## Work, in order

Local work runs in parallel (one subagent per item, each in its own worktree; none touches Obsidian or publishes).
The orchestrator merges, runs every in-app check serially, and does every outward step.

| # | Item | Kind |
|---|---|---|
| 1 | Merge P2 into `master`, push `master` and the phase branches | outward |
| 2 | **P2.1** view fixes: JSX dev props, `nullAs` placeholder, block-link embeds, `dc.List` task children, script `dc` contract members | local, then parity re-baseline (reviewed diff) |
| 3 | **npm packaging:** contract and client 1.0.0 metadata, READMEs, changeset; verified by installing the packed tarballs in an outside project | local |
| 4 | **Release tooling:** `scripts/release-plugin.mjs` (release repo files + GitHub release via `gh`), BRAT `manifest-beta.json`, a dispatchable workflow (`RELEASE_TOKEN` secret), store-ready manifests and READMEs | local |
| 5 | **Docs:** plugin family, `dc*` languages and migration, migrating from Datacore, plugin-author guide; CI docs typecheck fix; Pages URL | local |
| 6 | Merge 2–5; gates; parity | local + in-app |
| 7 | Create `yankeeinlondon/datacore-engine` and `yankeeinlondon/datacore-view-preact`; release `0.1.0-beta.1` of both | outward |
| 8 | Install both betas through BRAT in the Test Vault | in-app |
| 9 | Enable GitHub Pages; deploy docs | outward |
| 10 | Publish contract and client 1.0.0 to npm (needs one `npm login`) | outward |
| 11 | Example third-party consumer in `fixtures/` against the **published** client; verified in the Test Vault | local + in-app |
| 12 | Freeze the API reports; release `1.0.0` of both plugins | outward |
| 13 | Store PR to `obsidianmd/obsidian-releases` | outward |

## Exit criteria (spec §12)

- P3: external example plugin works against the published client; API report frozen; BRAT install works for both
  plugins.
- P4: submitted (acceptance is up to Obsidian's reviewers).

## Progress

### 1 ✅ (2026-11-12): P2 merged and pushed

`master` fast-forwarded to `4152d84`. GitHub answered the 90-commit push with "Internal Server Error" (status page
green, no large blobs); pushing in phase-sized segments (`p0-monorepo`, then `p1-contract`, then `master`) worked.

CI on `master` found two problems that local runs hid: the docs package's typecheck needs `@types/node` on a clean
install, and the docs deploy fails because GitHub Pages is not enabled on the fork. Both are handled in items 5
and 9.

### 2–6 ✅ (2026-11-12): P2.1, packaging, release tooling, docs merged

Four subagents worked in parallel worktrees; all merged into `master` with `pnpm check && pnpm build` green and
CI green on GitHub.

- **P2.1** (`5ccc27e`…`42eb605`): script JSX compiled in production mode (no `__self`/`__source`); the `nullAs`
  placeholder renders as text; embeds get `#Header` / `#^block` subpaths; `dc.List` nests list-item and task
  children (`$elements`, an upstream bug); the script `dc` implements the path-scoped contract API (`page()` was the
  only missing member). Parity re-baselined (`a531c6b`) after reviewing the diff: exactly those changes.
- **npm packaging**: contract and client 1.0.0 (ESM + CJS, types for both), READMEs, changelogs; packed tarballs
  verified in an outside project (strict `tsc` under bundler/node16/nodenext/node10, runtime ESM and CJS). The
  engine now reports API 1.0.0, and view-preact requires `minApi: "1.0"`.
- **Release tooling**: `scripts/release-plugin.mjs` (release repo files + GitHub release via `gh`; refuses dirty
  trees, existing versions, unsynced manifests), `release-plugins.yml` (manual, needs a `RELEASE_TOKEN` secret),
  `manifest-beta.json` for both plugins, store-ready descriptions.
- **Docs**: installation, migrating from Datacore, plugin-author guide; CI docs typecheck fix; site URL for Pages.
- Also: agent worktrees ignored by lint/format/git; shared's tests resolve workspace sources under the SSR
  conditions (CI runs tests before build); the fork's copyright line added to the MIT license.

**Store submission changed upstream (May 2026):** plugins are submitted through the community.obsidian.md portal
with the maintainer's Obsidian account, not by PR to `obsidian-releases` (its `community-plugins.json` is now a
mirror). Step 13 is therefore Ken's to click; everything before it is prepared.

### 7–9 ✅ (2026-11-12): betas released, BRAT install, docs live

- Release repos created; `0.1.0-beta.1` released for both (engine: `main.js`, `manifest.json`; view-preact adds
  `styles.css`).
- **BRAT 2.2.0** in the Test Vault installed both betas into empty plugin folders: both load, report
  `0.1.0-beta.1`, `main.js` byte-identical to the release assets (BRAT rewrites `manifest.json` on one line; same
  content), and the parity snapshot is identical to the baseline.
- GitHub Pages enabled (Actions); docs deployed to https://yankeeinlondon.github.io/datacore/.

### 10–12 ✅ (2026-11-12/13): npm + JSR, example consumer, 1.0.0 plugins

- **npm:** contract and client `1.0.0`, then `1.0.1` (published by Ken; npm needs an authenticator OTP per publish,
  and `npm login` only works from his own terminal). A publish can sit in npm's validation window for minutes:
  `npm view` returns 404 and re-publishing gets E409 "Cannot publish over previously staged version" until it
  clears. `npm stage list` empty means wait, not approve. Both packages also carry a stray `0.0.0-stage` version.
- **JSR** (Ken's standing preference: publish to JSR too): `scripts/stage-jsr.mjs` stages a self-contained copy
  (client includes shared's source under `_shared/`; contract via `jsr:`). Two server-side rules the dry run
  misses: no global type augmentation (the JSR client omits `window.dc` typing) and, for luxon (no bundled types),
  a `@ts-types="npm:@types/luxon"` directive is needed or the types become `any` (fixed in **1.0.1**).
- **Verified against the published 1.0.1 packages** in fresh projects outside the repo: npm (strict `tsc` with
  `skipLibCheck: false`, ESM runtime), Deno (`jsr:` import), JSR via npm (`npx jsr add`; needs `skipLibCheck: true`
  because JSR's d.ts imports `@types/luxon`, TS6137; documented). Each probe includes a deliberate misuse of a luxon
  type that must fail.
- **Example consumer** `examples/consumer-plugin/` (outside the workspace, npm lockfile resolving the client from the
  registry): live "Datacore: N pages" status bar, a tagged-count command, "engine off" and recovery across an engine
  reload, listed in the engine's Diagnostics. **P3 exit criterion met.**
- **API frozen:** each build regenerates the api-extractor reports and CI fails on any uncommitted change, so every
  public API change needs a reviewed, committed report.
- **Plugins 1.0.0** released to both release repos (root `manifest.json` at 1.0.0, "Latest"); BRAT upgraded the
  Test Vault from `0.1.0-beta.1` to `1.0.0`; parity identical.

### 13: store submission (Ken)

Submitted through community.obsidian.md with Ken's Obsidian account (the old `obsidian-releases` PR flow ended in
May 2026). Not yet in the hourly `community-plugins.json` mirror as of 2026-11-13.

## Outcome (2026-11-13)

Everything before the Vue view layer is done except the store's acceptance, which is up to Obsidian's review:

| Exit criterion | Result |
|---|---|
| P2 findings fixed | ✅ P2.1: five view fixes and the script `dc` contract API; parity re-baselined from a reviewed diff |
| Contract and client 1.0 on npm (and JSR) | ✅ 1.0.1 on both registries, verified as an outside consumer |
| Release CI / tooling to per-plugin repos | ✅ `release-plugin.mjs` (+ manual workflow needing a `RELEASE_TOKEN` secret) |
| BRAT install works for both plugins | ✅ beta install and upgrade to 1.0.0 in the Test Vault |
| External example plugin works against the published client | ✅ `examples/consumer-plugin` |
| API report frozen | ✅ CI fails on any unreviewed change |
| Docs | ✅ https://yankeeinlondon.github.io/datacore/ |
| P4: submitted to the store | Submitted by Ken; awaiting review |

Open, minor: `DatacoreHandle` in the client API report lists only `onReconnected` (the rest comes from the
contract's `ScopedDatacore`); the release workflow needs a `RELEASE_TOKEN` secret to run from Actions.
