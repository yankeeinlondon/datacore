/**
 * Client for datacore-engine.
 *
 * Locates the single shared engine from any Obsidian plugin (`getDatacore`) and provides identity-safe helpers for
 * the values it returns. Re-exports the full API contract, so consumers only ever install this package.
 *
 * @packageDocumentation
 */

export * from "@yankeeinlondon/datacore-contract";
export * from "./errors";
export * from "./guards";
export * from "./locate";
export * from "./values";
export { parseVersion, satisfiesApi, type Version } from "./version";
import "./global";
