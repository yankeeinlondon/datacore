/** Recognize and create coded Datacore errors without relying on the engine's classes. */
import type { DatacoreError, DatacoreErrorCode } from "@yankeeinlondon/datacore-contract";

/** True if `value` is a Datacore error (from the engine or this client), whatever bundle created it. */
export function isDatacoreError(value: unknown): value is DatacoreError {
    return (
        value instanceof Error &&
        (value as { name?: unknown }).name === "DatacoreError" &&
        typeof (value as { code?: unknown }).code === "string"
    );
}

/** Create a Datacore error with the given code. */
export function datacoreError(code: DatacoreErrorCode, message: string): DatacoreError {
    return Object.assign(new Error(message), { name: "DatacoreError" as const, code });
}
