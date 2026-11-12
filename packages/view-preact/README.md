# Datacore View: Preact

The `datacore-view-preact` Obsidian plugin (`@yankeeinlondon/datacore-view-preact`): Preact views and the `dc`, `dct`,
`dcx`, and `dctx` script blocks (JavaScript, TypeScript, JSX, TSX), on top of `datacore-engine`. It reaches the engine
only through `@yankeeinlondon/datacore-client` and `@yankeeinlondon/datacore-shared` (lint enforces this).

## Script surface (`dc`)

Every script block, and every script loaded with `dc.require`, gets its own `dc` object (`DatacoreLocalApi` in
`src/api/local-api.tsx`), scoped to the file the script lives in. User documentation:
[`docs/docs/code-views/local-api.md`](../../docs/docs/code-views/local-api.md).

`dc` has:

- **The engine's path-scoped query API**: every member of the contract's `DatacoreLocalQueryApi` (what
  `engine.local(path)` returns), forwarded to the engine:
  - context: `path`, `currentPath()`, `currentFile()`;
  - pages and queries: `page()`, `query()`, `tryQuery()`, `fullquery()`, `tryFullQuery()`, `parseQuery()`,
    `tryParseQuery()`;
  - expressions: `evaluate()`, `tryEvaluate()`;
  - links and paths: `resolveLink()`, `resolvePath()`, `fileLink()`, `headerLink()`, `blockLink()`, `parseLink()`,
    `tryParseLink()`, `inferLink()`;
  - values: `luxon`, `coerce`, `array()`.

  Relative links and `this` in expressions resolve against the script's file. `currentFile()` keeps upstream's
  signature (typed as always returning a page); the other members match the contract.
- **Hooks**: Preact's `useState`, `useCallback`, `useReducer`, `useMemo`, `useEffect`, `useContext`, `useRef`,
  `createContext`; and Datacore's `useQuery`, `useFullQuery`, `useFile`, `useCurrentFile`, `useCurrentPath`,
  `useIndexUpdates`, `useArray`, `useInterning`.
- **Components**: `Stack`, `Group`, `Literal`, `Markdown`, `Link`, `LinkEmbed`, `SpanEmbed`, `Icon`, `embed()`,
  `Table` (and the deprecated `VanillaTable`), `List`, `Card`, `Callout`, `Button`, `Textbox`, `Checkbox`, `Slider`,
  `Switch`, `VanillaSelect`.
- **Modules and host objects**: `require()` (vault scripts, script sections, and host modules such as `obsidian`),
  `preact`, `app`.

Upstream Datacore's script `dc` never had `page()`. Members it did have keep upstream's names, signatures, and
behaviour, so existing scripts run unchanged. A test (`src/test/local-api.test.ts`) fails if the contract gains a
member that `dc` lacks.
