/**
 * Engine settings. The engine's settings tab is the single settings tab for the plugin family (Engine Room spec §8.2):
 * indexing options plus display defaults shared by every view plugin through the contract (`dc.settings.display`).
 */
import type { DisplaySettings } from "@yankeeinlondon/datacore-contract";

/** @internal All engine settings. */
export interface Settings {
    /** The number of threads the importer will use for importing. */
    importerNumThreads: number;
    /** The CPU utilization (between 0.1 and 1.0) that importer threads should use. */
    importerUtilization: number;
    /**
     * Whether to index inline fields. Inline field parsing requires a full scan of the document, which can make
     * indexing take 2-3x longer.
     */
    indexInlineFields: boolean;
    /**
     * Whether to index list and task item text and states. Indexing lists & tasks requires some additional regex
     * parsing which makes indexing modestly slower.
     */
    indexListItems: boolean;

    /** Presentation defaults shared by all views; also used when the engine stringifies values in expressions. */
    display: DisplaySettings;

    /** Are JavaScript views enabled? View-specific: moves to datacore-view-preact in P2. */
    enableJs: boolean;
}

/** Default display settings. */
export const DEFAULT_DISPLAY_SETTINGS: Readonly<DisplaySettings> = Object.freeze<DisplaySettings>({
    dateFormat: "MMMM dd, yyyy",
    dateTimeFormat: "h:mm a - MMMM dd, yyyy",
    nullAs: "-",
    pagingEnabled: true,
    pageSize: 50,
    scrollOnPageChange: false,
    maxRecursiveRenderDepth: 5,
});

/** Default settings for the plugin. */
export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze<Settings>({
    importerNumThreads: 2,
    importerUtilization: 0.75,
    indexInlineFields: true,
    indexListItems: true,
    display: DEFAULT_DISPLAY_SETTINGS,
    enableJs: false,
});

/** Upstream Datacore's flat setting keys for display options, mapped to their `display` equivalents. */
const LEGACY_DISPLAY_KEYS: Readonly<Record<string, keyof DisplaySettings>> = {
    defaultDateFormat: "dateFormat",
    defaultDateTimeFormat: "dateTimeFormat",
    renderNullAs: "nullAs",
    defaultPagingEnabled: "pagingEnabled",
    defaultPageSize: "pageSize",
    scrollOnPageChange: "scrollOnPageChange",
    maxRecursiveRenderDepth: "maxRecursiveRenderDepth",
};

/** Keys whose values are copied as-is when present. */
const ENGINE_KEYS: readonly (keyof Settings)[] = [
    "importerNumThreads",
    "importerUtilization",
    "indexInlineFields",
    "indexListItems",
    "enableJs",
];

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Build settings from saved plugin data, filling in defaults. Accepts both the current shape and upstream Datacore's
 * flat `data.json` keys (e.g. `defaultDateFormat`), so settings carry over when migrating.
 */
export function migrateSettings(saved: unknown): Settings {
    const settings: Settings = { ...DEFAULT_SETTINGS, display: { ...DEFAULT_DISPLAY_SETTINGS } };
    if (!isRecord(saved)) return settings;

    const writable = settings as unknown as Record<string, unknown>;
    for (const key of ENGINE_KEYS) {
        if (saved[key] !== undefined && typeof saved[key] === typeof DEFAULT_SETTINGS[key]) writable[key] = saved[key];
    }

    const display: Record<string, unknown> = { ...settings.display };
    for (const [legacy, key] of Object.entries(LEGACY_DISPLAY_KEYS)) {
        if (saved[legacy] !== undefined && typeof saved[legacy] === typeof DEFAULT_DISPLAY_SETTINGS[key]) {
            display[key] = saved[legacy];
        }
    }
    if (isRecord(saved["display"])) {
        for (const key of Object.keys(DEFAULT_DISPLAY_SETTINGS) as (keyof DisplaySettings)[]) {
            const value = saved["display"][key];
            if (value !== undefined && typeof value === typeof DEFAULT_DISPLAY_SETTINGS[key]) display[key] = value;
        }
    }
    settings.display = display as unknown as DisplaySettings;
    return settings;
}
