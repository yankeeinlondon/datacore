---
title: Lifecycle
sidebar_position: 2
---

The engine is a separate plugin, so it can be disabled, updated, or reloaded while your plugin keeps running. The
handle from `getDatacore()` is built for that.

## Cleanup when your plugin unloads

When you pass your plugin as `consumer`, the client registers cleanup on it. When your plugin unloads, the client:

1. disposes every subscription and event listener you made through the handle (`subscribe`, `watchFile`,
   `onRevision`, `on`), and
2. calls `release()`, which disconnects the handle and removes your plugin from the engine's list of connected
   plugins (shown under **Diagnostics** in the Datacore Engine settings tab).

You do not need to dispose anything in `onunload`. If you passed `{ id, component }` instead, the same happens when
`component` unloads; with a bare `{ id }`, call `release()` yourself.

### Doing it by hand

```ts
dc.disposeAll(); // dispose every subscription and listener made through this handle; the handle stays usable
dc.release();    // dispose everything and disconnect; the handle then behaves as revoked. Safe to call twice.
```

Use `release()` when part of your plugin stops needing the engine before the plugin itself unloads. To start again,
call `getDatacore()` for a new handle.

## When the engine reloads

If the user disables Datacore Engine, updates it, or reloads it:

1. The engine announces that it is going away, then revokes your connection. `dc.revoked` becomes `true` and the
   callbacks registered with `dc.onRevoked()` run.
2. While revoked, every engine call on the handle (`query`, `subscribe`, ...) throws a `DatacoreError` with code
   `revoked`. Your subscriptions stop calling back.
3. When the engine is enabled again, the handle reconnects by itself: `dc.revoked` becomes `false`, every subscription
   and event listener you made is set up again on the new engine (each subscription gets a fresh first call with
   `meta.initial === true`), and the callbacks registered with `dc.onReconnected()` run.

You keep using the same handle and the same `Disposable`s throughout; disposing one after a reconnect stops the
replayed subscription.

```ts
dc.onRevoked(() => this.showPlaceholder("Datacore Engine is not running."));
dc.onReconnected(() => this.refresh());
```

The handle only reconnects to an engine whose API still satisfies your `minApi`. If an update made it incompatible,
the handle stays revoked.

To opt out of reconnecting, pass `reconnect: false` to `getDatacore()`. The handle then stays revoked after the engine
unloads, and you call `getDatacore()` again when you want a new one.

## Errors

Errors from the engine and the client are `DatacoreError`s: ordinary `Error`s with `name === "DatacoreError"` and a
`code`. Because they may come from another plugin's bundle, check them with `isDatacoreError()`, not `instanceof`:

```ts
import { isDatacoreError } from "@yankeeinlondon/datacore-client";

try {
    dc.query(input);
} catch (error) {
    if (isDatacoreError(error) && error.code === "invalid-query") {
        new Notice(error.message);
    } else if (isDatacoreError(error) && error.code === "revoked") {
        // the engine is reloading
    } else {
        throw error;
    }
}
```

The codes are listed in `ERROR_CODES`:

| Code | Meaning |
|---|---|
| `revoked` | The handle is disconnected: the engine unloaded, or `release()` was called. |
| `invalid-query` | A query (or a link passed to `parseLink`) did not parse. |
| `evaluation-failed` | `evaluate` failed. |
| `not-installed`, `disabled`, `incompatible`, `timeout` | The same as the `getDatacore()` [failure reasons](../plugin-authors/index.md#failure-reasons). |

`datacoreError(code, message)` creates one, if you want to report engine problems the same way.
