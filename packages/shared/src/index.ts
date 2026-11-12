/**
 * Pure functions and constants shared by the engine, the client, and the view plugins.
 *
 * Rules (Engine Room spec, D9): pure functions and constants only. No classes, no module state, and no runtime import
 * of `obsidian`. Code here is bundled into each consumer separately, so anything stateful or class-based would be
 * duplicated per bundle and break identity checks.
 *
 * @packageDocumentation
 */

export * from "./deferred";
export * from "./indexables";
export * from "./media";
export * from "./registry";
export * from "./text";
export * from "./values/index";
