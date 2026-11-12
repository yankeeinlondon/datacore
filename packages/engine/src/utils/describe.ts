/** A short, readable rendering of an arbitrary value for error and log messages (never `[object Object]` for data). */
export function describeValue(value: unknown): string {
    if (typeof value === "string") return value;
    if (typeof value === "number") return value.toString();
    if (typeof value === "boolean") return value ? "true" : "false";
    if (value === undefined) return "undefined";
    if (typeof value === "symbol") return value.toString();
    if (typeof value === "function") return `<function ${value.name || "anonymous"}>`;
    if (value === null) return "null";
    if (value instanceof Error) return value.message;
    try {
        const json = JSON.stringify(value);
        if (json !== undefined) return json;
    } catch {
        // Cyclic or otherwise unserializable; fall through.
    }
    return Object.prototype.toString.call(value);
}
