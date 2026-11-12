import { describe, expect, it } from "vitest";
import { DEFAULT_DISPLAY_SETTINGS, DEFAULT_SETTINGS, migrateSettings } from "settings";

describe("migrateSettings", () => {
    it("returns defaults for missing or invalid data", () => {
        expect(migrateSettings(undefined)).toEqual(DEFAULT_SETTINGS);
        expect(migrateSettings(null)).toEqual(DEFAULT_SETTINGS);
        expect(migrateSettings("nonsense")).toEqual(DEFAULT_SETTINGS);
    });

    it("carries over upstream Datacore's flat keys", () => {
        const settings = migrateSettings({
            importerNumThreads: 4,
            defaultDateFormat: "yyyy-MM-dd",
            renderNullAs: "∅",
            defaultPageSize: 25,
            defaultPagingEnabled: false,
            indexInlineFields: false,
        });
        expect(settings.importerNumThreads).toBe(4);
        expect(settings.indexInlineFields).toBe(false);
        expect(settings.display).toEqual({
            ...DEFAULT_DISPLAY_SETTINGS,
            dateFormat: "yyyy-MM-dd",
            nullAs: "∅",
            pageSize: 25,
            pagingEnabled: false,
        });
        expect(settings).not.toHaveProperty("defaultDateFormat");
    });

    it("reads the current nested shape, which wins over legacy keys", () => {
        const settings = migrateSettings({ defaultPageSize: 25, display: { pageSize: 100, nullAs: "n/a" } });
        expect(settings.display.pageSize).toBe(100);
        expect(settings.display.nullAs).toBe("n/a");
    });

    it("ignores values of the wrong type", () => {
        const settings = migrateSettings({ importerNumThreads: "many", display: { pageSize: "lots" } });
        expect(settings.importerNumThreads).toBe(DEFAULT_SETTINGS.importerNumThreads);
        expect(settings.display.pageSize).toBe(DEFAULT_DISPLAY_SETTINGS.pageSize);
    });

    it("never shares the default display object", () => {
        const settings = migrateSettings({});
        expect(settings.display).not.toBe(DEFAULT_SETTINGS.display);
    });
});
