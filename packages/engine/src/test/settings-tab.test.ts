import { describe, expect, it } from "vitest";
import { Setting } from "obsidian";
import { DEFAULT_SETTINGS } from "settings";
import {
    describeConsumers,
    describeIndex,
    GeneralSettingsTab,
    type EngineSettingsHost,
    type SettingGroup,
} from "settings-tab";

function tab(overrides: Partial<EngineSettingsHost> = {}): GeneralSettingsTab {
    const host = {
        settings: { ...DEFAULT_SETTINGS, display: { ...DEFAULT_SETTINGS.display } },
        updateSettings: () => Promise.resolve(),
        updateDisplay: () => Promise.resolve(),
        indexStatus: () => ({ initialized: true, objects: 1234, revision: 7 }),
        consumers: () => [{ id: "datacore-view-preact", name: "Datacore View: Preact" }],
        reindex: () => Promise.resolve(),
        ...overrides,
    } as unknown as EngineSettingsHost;
    return new GeneralSettingsTab({} as never, host);
}

describe("GeneralSettingsTab", () => {
    it("describes every setting as a definition, in three groups", () => {
        const groups = tab().getSettingDefinitions() as SettingGroup[];
        expect(groups.map((group) => group.heading)).toEqual(["Display", "Indexing", "Diagnostics"]);
        expect(groups.flatMap((group) => group.items.map((item) => item.name))).toEqual([
            "Pagination",
            "Default page size",
            "Scroll on page change",
            "Empty values",
            "Default date format",
            "Default date/time format",
            "Maximum recursive render depth",
            "Inline fields",
            "Importer threads",
            "Importer utilization",
            "Index status",
            "Connected plugins",
            "Reindex vault",
        ]);
    });

    it("gives every editable setting a control and the diagnostics live text", () => {
        const groups = tab().getSettingDefinitions() as SettingGroup[];
        const rendered = groups.flatMap((group) =>
            group.items.map((item) => {
                const setting = new Setting(document.createElement("div")) as unknown as Setting & {
                    controls: string[];
                    desc: string;
                };
                item.render(setting);
                return { name: item.name, controls: setting.controls, desc: setting.desc };
            })
        );
        const editable = rendered.slice(0, 10);
        expect(editable.filter((row) => row.controls.length !== 1).map((row) => row.name)).toEqual([]);
        expect(rendered[10]?.desc).toBe(`Ready: ${(1234).toLocaleString()} objects indexed (revision 7).`);
        expect(rendered[11]?.desc).toBe("Datacore View: Preact");
    });
});

describe("diagnostics text", () => {
    it("describes the index", () => {
        expect(describeIndex({ initialized: false, objects: 0, revision: 0 })).toBe("Indexing the vault…");
        expect(describeIndex({ initialized: true, objects: 3, revision: 2 })).toBe(
            "Ready: 3 objects indexed (revision 2)."
        );
    });

    it("lists each connected plugin once, by name", () => {
        expect(describeConsumers([])).toMatch(/^None\./);
        expect(
            describeConsumers([
                { id: "b-plugin" },
                { id: "datacore-view-preact", name: "Datacore View: Preact" },
                { id: "datacore-view-preact", name: "Datacore View: Preact" },
            ])
        ).toBe("b-plugin, Datacore View: Preact");
    });
});
