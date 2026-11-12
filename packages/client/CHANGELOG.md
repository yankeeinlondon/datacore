# @yankeeinlondon/datacore-client

## 1.0.1

### Patch Changes

- JSR: luxon's types now resolve for JSR consumers; the JSR build leaves out the `window.dc` global typing, which JSR does not allow (the README shows how to declare it). No API change.
- Updated dependencies
  - @yankeeinlondon/datacore-contract@1.0.1

## 1.0.0

### Major Changes

- 903f144: First stable release (API 1.0). `@yankeeinlondon/datacore-contract` defines the datacore-engine API: the `DatacoreApi` / `ScopedDatacore` interfaces, indexable and value shapes, the load-order-independent registry protocol, and protocol constants. `@yankeeinlondon/datacore-client` lets any Obsidian plugin locate the shared engine (`getDatacore()` / `tryGetDatacore()` with `minApi` negotiation, `not-installed` / `disabled` / `incompatible` / `timeout` failures, automatic reconnect and release on unload) and provides identity-safe guards and value helpers. The client re-exports the contract, so consumers install only the client. From 1.0.0 the contract follows strict semver: additive changes are minor, removals or changes are major.

### Patch Changes

- Updated dependencies [903f144]
  - @yankeeinlondon/datacore-contract@1.0.0
