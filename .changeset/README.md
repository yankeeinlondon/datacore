# Changesets

Every package in this workspace is versioned with [Changesets](https://github.com/changesets/changesets): the published
npm packages (`@yankeeinlondon/datacore-contract`, `@yankeeinlondon/datacore-client`) and the private plugin packages
(`@yankeeinlondon/datacore-engine`, `@yankeeinlondon/datacore-view-preact`, …), which are tagged and released as
Obsidian plugins.

- Add a changeset with your change: `pnpm changeset`
- Release: `pnpm release:version` (bumps versions, writes changelogs, syncs each plugin's `manifest.json` /
  `versions.json`), then commit and tag.

See the Engine Room spec (§10.4) for the release flow.
