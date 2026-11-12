# @yankeeinlondon/datacore-contract

## 1.0.1

### Patch Changes

- JSR: luxon's types now resolve for JSR consumers (Deno and npm-compat). luxon ships no types, so the JSR build marks every type-only luxon import with `@ts-types="npm:@types/luxon"`; before, `DateTime`/`Duration` fell back to `any`. `DatacoreApi.luxon` is typed through a named type-only import (same type). No API change.

## 1.0.0

### Major Changes

- 903f144: First stable release (API 1.0). `@yankeeinlondon/datacore-contract` defines the datacore-engine API: the `DatacoreApi` / `ScopedDatacore` interfaces, indexable and value shapes, the load-order-independent registry protocol, and protocol constants. `@yankeeinlondon/datacore-client` lets any Obsidian plugin locate the shared engine (`getDatacore()` / `tryGetDatacore()` with `minApi` negotiation, `not-installed` / `disabled` / `incompatible` / `timeout` failures, automatic reconnect and release on unload) and provides identity-safe guards and value helpers. The client re-exports the contract, so consumers install only the client. From 1.0.0 the contract follows strict semver: additive changes are minor, removals or changes are major.
