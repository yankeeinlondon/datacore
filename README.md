# Datacore

Datacore is a work-in-progress re-imagining of [Dataview](https://github.com/blacksmithgu/obsidian-dataview.git) with a
focus on 2-10x better query and rendering performance, as well as fully interactable views.

## Documentation

You can find the current documentation at https://blacksmithgu.github.io/datacore/.

## Roadmap

Datacore is a work in progress. For more details, check out the [roadmap](ROADMAP.md).

### Differences from Dataview

Datacore is fundamentally the same thing as dataview - an index over Markdown files that supports live-updating views
and metadata. However, Datacore focuses on substantial index changes for performance, as well as a new sleek UI which
completely replaces traditional Dataview queries. Datacore supports all query operations that Dataview does, with some
extra functionality.

- **New Javascript API**: Javascript-based views are now React-based and support internal state, flickerless updates on
  index changes, and a new query API which is much more performant than `dv.pages().where(...)`.
- **WYSIWYG Views**: Datacore queries now use a responsive table view and can be manipulated with a table editor much more akin to
  what you would see in places like Notion and Airtable.
- **Functioning Embeds**: Markdown page, image, and video embeds now work in all views, and a new special view type
  which is just a list of embeds has been added.
- **Live Editing**: Values inside of table views can now be edited; task views include more nuanced rendering of
  metadata like due date and more operations for manipulating tasks directly.
- **Section / Block Queries**: Datacore indexes all files (including attachments, PDFs, and images), and supports queries
  at section and block level granularity.

## Compiling & Building

This is a pnpm workspace (Node 22, see `.nvmrc`). Key development and devops operations (checks, building and
installing into a vault, parity checks, releases, publishing) are run as [`just`](https://github.com/casey/just)
recipes from the root `justfile`; run `just` to list them. The recipes wrap the pnpm scripts and `scripts/*` below.

```bash
pnpm install
pnpm build      # every package except the docs site; plugins land in packages/<plugin>/build/plugin
pnpm check      # format check, lint, typecheck, tests, plugin manifests
```

Copy a built plugin into a vault (`engine` or `view-preact`):

```bash
./scripts/install-built /path/to/your/vault engine
./scripts/install-built /path/to/your/vault view-preact
```

## Formatting & Running Tests

```bash
pnpm fmt        # format with oxfmt
pnpm test       # Vitest in every package
```

## Releasing plugins

Each Obsidian plugin in this monorepo (`packages/engine`, `packages/view-preact`) is published to its own **release
repo**, because the community store and BRAT expect one plugin per GitHub repository:
[`yankeeinlondon/datacore-engine`](https://github.com/yankeeinlondon/datacore-engine) and
[`yankeeinlondon/datacore-view-preact`](https://github.com/yankeeinlondon/datacore-view-preact) (set by `releaseRepo`
in each package's `package.json`). The release repo holds only the root `manifest.json` / `manifest-beta.json`,
`versions.json`, `README.md` and `LICENSE`, plus GitHub releases tagged with the bare version (`0.1.0-beta.1`, `1.0.0`;
no `v`) carrying `main.js`, `manifest.json` and `styles.css`.

1. Version: `pnpm changeset` with your change, then `pnpm release:version` (bumps `package.json`, writes changelogs, and
   syncs `manifest.json` / `manifest-beta.json` / `versions.json`). For BRAT betas, enter Changesets pre-release mode
   first (`pnpm changeset pre enter beta`) to get `x.y.z-beta.N`; `pnpm changeset pre exit` before a store release.
   Commit.
2. Publish, from a clean working tree (requires an authenticated [`gh`](https://cli.github.com)):

    ```bash
    node scripts/release-plugin.mjs engine --dry-run   # build, prepare the release repo, print what would be pushed
    node scripts/release-plugin.mjs engine             # push the root files and create the GitHub release
    node scripts/release-plugin.mjs view-preact
    ```

    The script refuses to run if the working tree is dirty, the manifests disagree with `package.json`, or the version
    already has a release. A prerelease version (`-beta.N`) updates only `manifest-beta.json` in the release repo (BRAT's
    channel) and is published as a GitHub prerelease; a stable version updates the root `manifest.json`, which the
    community store reads.

The store README for a release repo comes from `tools/release-repo/<plugin>/README.md` when present, otherwise from the
package's `README.md`; `LICENSE` comes from `LICENSE.txt`.

**From GitHub Actions:** the manually dispatched "Release plugin" workflow (`.github/workflows/release-plugins.yml`) runs
the same script. It needs a repository secret **`RELEASE_TOKEN`**: a personal access token with "Contents: Read and
write" on both release repos (the default `GITHUB_TOKEN` cannot write to other repositories).

## Contributing

**Discord**: <https://discord.gg/KwZUX4BYba>.

Contributions are welcome; for any contributions beyond bug fixes, we recommend reaching out via email or discord to make sure what you are trying to implement is reasonable / feasible!