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

/** Key for the shared engine registry: `globalThis[Symbol.for(ENGINE_REGISTRY_KEY)]`. */
export const ENGINE_REGISTRY_KEY = "datacore-engine.registry" as const;

/** Obsidian plugin id of the engine host plugin. Part of the contract: it never changes. */
export const ENGINE_PLUGIN_ID = "datacore-engine" as const;
