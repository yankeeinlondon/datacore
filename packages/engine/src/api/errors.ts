/** Engine errors, identified by `code` (not class) so consumers in other bundles can recognize them. */
import type * as Contract from "@yankeeinlondon/datacore-contract";

/** An error with a contract error code. */
export class DatacoreError extends Error implements Contract.DatacoreError {
    public readonly name = "DatacoreError" as const;

    public constructor(
        public readonly code: Contract.DatacoreErrorCode,
        message: string
    ) {
        super(message);
    }
}
