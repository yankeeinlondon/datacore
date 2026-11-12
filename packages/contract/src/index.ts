/**
 * The datacore-engine API contract.
 *
 * This package defines *what* the engine API is: interfaces, data shapes, the registry protocol, events, capability
 * names, and the protocol constants that the engine and its clients must agree on. It contains no logic. Its version is
 * the API version reported by the engine (`apiVersion`) and checked by `getDatacore({ minApi })`.
 *
 * Plugin authors should depend on `@yankeeinlondon/datacore-client`, which re-exports this package, rather than
 * depending on the contract directly (see the Engine Room spec, §7.3).
 *
 * @packageDocumentation
 */

export * from "./api";
export * from "./coerce";
export * from "./constants";
export * from "./data-array";
export * from "./errors";
export * from "./expression";
export * from "./fields";
export * from "./indexables";
export * from "./query";
export * from "./registry";
export * from "./result";
export * from "./settings";
export * from "./values";
