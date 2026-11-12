/** Protocol constants the engine and its clients must agree on. Values only; no logic. */

/** Key for the shared engine registry on the main window: `window[Symbol.for(ENGINE_REGISTRY_KEY)]`. */
export const ENGINE_REGISTRY_KEY = "datacore-engine.registry" as const;

/** Obsidian plugin id of the engine host plugin. Part of the contract: it never changes. */
export const ENGINE_PLUGIN_ID = "datacore-engine" as const;

/** Version of the registry object's own shape (independent of the API version). */
export const REGISTRY_PROTOCOL_VERSION = 1 as const;

/** Brand keys (`Symbol.for(key)`) that identify engine values across plugin bundles. */
export const BRAND_KEYS = {
    link: "datacore.link",
    dataArray: "datacore.data-array",
} as const;

/** Values of `Indexable.$types` that identify each kind of indexed object. */
export const INDEX_TYPES = {
    file: "file",
    markdown: "markdown",
    page: "page",
    section: "section",
    block: "block",
    listBlock: "block-list",
    codeblock: "codeblock",
    datablock: "datablock",
    listItem: "list-item",
    task: "task",
    canvas: "canvas",
    canvasCard: "canvas-card",
    canvasTextCard: "canvas-text-card",
    canvasFileCard: "canvas-file-card",
    canvasWebCard: "canvas-web-card",
    taggable: "taggable",
    linkable: "linkable",
    linkbearing: "links",
    fieldbearing: "fields",
} as const;

/**
 * Optional capabilities an engine can advertise (`dc.has(capability)`). Version 1.0 advertises `query` and
 * `subscribe`; `write` (field edits, 1.1) and `functions` (custom expression functions, 1.2) are reserved.
 */
export const CAPABILITIES = {
    query: "query",
    subscribe: "subscribe",
    write: "write",
    functions: "functions",
} as const;

/** A capability name. */
export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

/** Error codes carried by `DatacoreError.code`. */
export const ERROR_CODES = {
    /** The handle was revoked because the engine unloaded. */
    revoked: "revoked",
    /** The engine plugin is not installed. */
    notInstalled: "not-installed",
    /** The engine plugin is installed but disabled. */
    disabled: "disabled",
    /** The engine's API version does not satisfy the requested `minApi`. */
    incompatible: "incompatible",
    /** No engine became available within the timeout. */
    timeout: "timeout",
    /** A query string failed to parse. */
    invalidQuery: "invalid-query",
    /** An expression failed to parse or evaluate. */
    evaluationFailed: "evaluation-failed",
} as const;

/** An error code. */
export type DatacoreErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
