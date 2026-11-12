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
