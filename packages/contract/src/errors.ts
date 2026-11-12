/** Errors are identified by `code`, not by class, so they can be recognized across plugin bundles. */
import type { DatacoreErrorCode } from "./constants";

/** An error thrown by the engine or client. Check `code` (or use `isDatacoreError` from the client). */
export interface DatacoreError extends Error {
    readonly name: "DatacoreError";
    readonly code: DatacoreErrorCode;
}
