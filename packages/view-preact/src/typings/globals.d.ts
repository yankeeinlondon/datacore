/**
 * Obsidian loads each plugin as a CommonJS module, so `require` exists at runtime. The views use it only for host
 * modules (`obsidian`, `electron`, `@codemirror/*`, Node built-ins on desktop) requested by scripts via `dc.require`.
 */
declare function require(id: string): unknown;
