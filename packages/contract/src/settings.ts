/** Settings shared through the contract. */

/**
 * Presentation defaults shared by every view plugin, owned by the engine's settings tab. Read them via
 * `dc.settings.display`; subscribe to `on("display-settings", …)` to re-render when they change.
 */
export interface DisplaySettings {
    /** Luxon format for dates. */
    readonly dateFormat: string;
    /** Luxon format for date-times. */
    readonly dateTimeFormat: string;
    /** How empty (null) values render. */
    readonly nullAs: string;
    /** Whether views page their results by default. */
    readonly pagingEnabled: boolean;
    /** Default number of rows per page. */
    readonly pageSize: number;
    /** Whether paged views scroll to the top on page change. */
    readonly scrollOnPageChange: boolean;
    /** How many levels of nested objects render before being collapsed. */
    readonly maxRecursiveRenderDepth: number;
}
