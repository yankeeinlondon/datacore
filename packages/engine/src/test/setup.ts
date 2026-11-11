/**
 * Shared Vitest setup for the engine.
 *
 * Obsidian patches several built-in prototypes at runtime, and parts of the engine currently rely on them (see the
 * Engine Room spec, §4.2.1). Polyfill the ones the engine uses so unit tests exercise the same code paths. These are
 * removed from engine code in P1, at which point this file shrinks accordingly.
 */

// `Array.prototype.contains`/`remove` are typed by Obsidian's own declarations (pulled in via src/typings).
function definePolyfill<K extends keyof Array<unknown>>(name: K, implementation: Array<unknown>[K]): void {
    if (Object.prototype.hasOwnProperty.call(Array.prototype, name)) return;
    Object.defineProperty(Array.prototype, name, { value: implementation, configurable: true, writable: true });
}

definePolyfill("contains", function <T>(this: T[], target: T): boolean {
    return this.includes(target);
});

definePolyfill("remove", function <T>(this: T[], target: T): void {
    const index = this.indexOf(target);
    if (index !== -1) this.splice(index, 1);
});

export {};
