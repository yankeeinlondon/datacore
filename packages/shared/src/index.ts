/**
 * Pure functions and constants shared by the engine and the view plugins.
 *
 * Rules (Engine Room spec, D9): pure functions and constants only. No classes, no module state, and no runtime import
 * of `obsidian`. Code here is bundled into each plugin separately, so anything stateful or class-based would be
 * duplicated per bundle and break identity checks.
 *
 * @packageDocumentation
 */

export {};
