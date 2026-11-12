/**
 * Datacore Engine settings: the single settings tab for the plugin family (Engine Room spec §8.2).
 *
 * The tab is described once, as setting definitions. Obsidian 1.13+ renders them itself (and indexes them for settings
 * search) through `getSettingDefinitions()`; older versions call `display()`, which renders the same definitions.
 */
import type { ConsumerInfo, DisplaySettings } from "@yankeeinlondon/datacore-contract";
import { DateTime } from "luxon";
import { type App, type Plugin, PluginSettingTab, Setting } from "obsidian";
import type { Settings } from "settings";

/** One setting row. `render` adds the controls to a `Setting` that already has the name and description. */
export interface SettingItem {
    name: string;
    desc?: string;
    aliases?: string[];
    render: (setting: Setting) => void;
}

/** A titled group of rows. */
export interface SettingGroup {
    type: "group";
    heading: string;
    items: SettingItem[];
}

/** Obsidian 1.13+'s declarative setting definitions (not in the `obsidian` typings this package builds against). */
export type SettingDefinition = SettingItem | SettingGroup;

/** What the settings tab needs from the engine plugin. */
export interface EngineSettingsHost extends Plugin {
    settings: Settings;
    updateSettings(settings: Partial<Omit<Settings, "display">>): Promise<void>;
    updateDisplay(display: Partial<DisplaySettings>): Promise<void>;
    /** Index state, for the diagnostics rows. */
    indexStatus(): { initialized: boolean; objects: number; revision: number };
    /** Plugins currently connected through the client (view plugins and others). */
    consumers(): ConsumerInfo[];
    /** Drop the index and reindex the whole vault (also the "Reindex entire vault" command). */
    reindex(): Promise<void>;
}

const LUXON_FORMATS =
    "Uses luxon date formatting (https://github.com/moment/luxon/blob/master/docs/formatting.md#formatting-with-tokens-strings-for-cthulhu).";

/** Whether `format` is a usable luxon format string. */
function isValidFormat(format: string): boolean {
    try {
        DateTime.fromMillis(Date.now()).toFormat(format);
        return true;
    } catch {
        return false;
    }
}

/** The engine's settings tab. */
export class GeneralSettingsTab extends PluginSettingTab {
    constructor(
        app: App,
        private readonly plugin: EngineSettingsHost
    ) {
        super(app, plugin);
    }

    /** Obsidian 1.13+: the tab's settings, rendered and searched by Obsidian. */
    public getSettingDefinitions(): SettingDefinition[] {
        return [
            { type: "group", heading: "Display", items: this.displayItems() },
            { type: "group", heading: "Indexing", items: this.indexingItems() },
            { type: "group", heading: "Diagnostics", items: this.diagnosticItems() },
        ];
    }

    /** Older Obsidian: render the same definitions by hand. */
    public display(): void {
        const { containerEl } = this;
        containerEl.empty();
        for (const definition of this.getSettingDefinitions()) {
            if ("type" in definition) {
                new Setting(containerEl).setName(definition.heading).setHeading();
                for (const item of definition.items) renderItem(containerEl, item);
            } else {
                renderItem(containerEl, definition);
            }
        }
    }

    private displayItems(): SettingItem[] {
        const plugin = this.plugin;
        const display = () => plugin.settings.display;
        return [
            {
                name: "Pagination",
                desc:
                    "If enabled, splits up views into pages of results which can be traversed via buttons at the top and " +
                    "bottom of the view. This substantially improves the performance of large views, and can help with " +
                    "visual clutter. Note that this setting can also be set on a per-view basis.",
                render: (setting) =>
                    setting.addToggle((toggle) =>
                        toggle
                            .setValue(display().pagingEnabled)
                            .onChange((value) => plugin.updateDisplay({ pagingEnabled: value }))
                    ),
            },
            {
                name: "Default page size",
                desc: "The number of entries to show per page, by default. This can be overriden on a per-view basis.",
                render: (setting) =>
                    setting.addDropdown((dropdown) => {
                        const options: Record<string, string> = {
                            25: "25",
                            50: "50",
                            100: "100",
                            200: "200",
                            500: "500",
                        };
                        const current = String(display().pageSize);
                        if (!(current in options)) options[current] = current;
                        dropdown
                            .addOptions(options)
                            .setValue(current)
                            .onChange(async (value) => {
                                const parsed = parseFloat(value);
                                if (!isNaN(parsed)) await plugin.updateDisplay({ pageSize: parsed | 0 });
                            });
                    }),
            },
            {
                name: "Scroll on page change",
                desc:
                    "If enabled, table that are paged will scroll to the top of the table when the page changes. " +
                    "This can be overriden on a per-view basis.",
                render: (setting) =>
                    setting.addToggle((toggle) =>
                        toggle
                            .setValue(display().scrollOnPageChange)
                            .onChange((value) => plugin.updateDisplay({ scrollOnPageChange: value }))
                    ),
            },
            {
                name: "Empty values",
                desc: "What to show for unset/empty properties.",
                aliases: ["null"],
                render: (setting) =>
                    setting.addText((text) =>
                        text.setValue(display().nullAs).onChange((value) => plugin.updateDisplay({ nullAs: value }))
                    ),
            },
            {
                name: "Default date format",
                desc: `The default format that dates are rendered in. ${LUXON_FORMATS}`,
                render: (setting) =>
                    setting.addText((text) =>
                        text.setValue(display().dateFormat).onChange(async (value) => {
                            if (isValidFormat(value)) await plugin.updateDisplay({ dateFormat: value });
                        })
                    ),
            },
            {
                name: "Default date/time format",
                desc: `The default format that date-times are rendered in. ${LUXON_FORMATS}`,
                render: (setting) =>
                    setting.addText((text) =>
                        text.setValue(display().dateTimeFormat).onChange(async (value) => {
                            if (isValidFormat(value)) await plugin.updateDisplay({ dateTimeFormat: value });
                        })
                    ),
            },
            {
                name: "Maximum recursive render depth",
                desc:
                    "Maximum depth that objects will be rendered to (i.e., how many levels of subproperties will be " +
                    "rendered by default). This avoids infinite recursion due to self-referential objects and ensures " +
                    "that rendering objects is acceptably performant.",
                render: (setting) =>
                    setting.addText((text) =>
                        text.setValue(String(display().maxRecursiveRenderDepth)).onChange(async (value) => {
                            const parsed = parseInt(value);
                            if (!isNaN(parsed)) await plugin.updateDisplay({ maxRecursiveRenderDepth: parsed });
                        })
                    ),
            },
        ];
    }

    private indexingItems(): SettingItem[] {
        const plugin = this.plugin;
        return [
            {
                name: "Inline fields",
                desc:
                    "If enabled, inline fields will be parsed in all documents. Finding inline fields requires a full " +
                    "text scan through each document, which noticably slows down indexing for large vaults. Disabling " +
                    "this functionality will mean metadata will only come from tags, links, and Properties / frontmatter",
                render: (setting) =>
                    setting.addToggle((toggle) =>
                        // TODO: Request a full index drop + reindex for correctness.
                        toggle
                            .setValue(plugin.settings.indexInlineFields)
                            .onChange((value) => plugin.updateSettings({ indexInlineFields: value }))
                    ),
            },
            {
                name: "Importer threads",
                desc: "The number of importer threads to use for parsing metadata.",
                render: (setting) =>
                    setting.addText((text) =>
                        text.setValue(String(plugin.settings.importerNumThreads)).onChange(async (value) => {
                            const parsed = parseInt(value);
                            if (!isNaN(parsed)) await plugin.updateSettings({ importerNumThreads: parsed });
                        })
                    ),
            },
            {
                name: "Importer utilization",
                desc: "How much CPU time each importer thread should use, as a fraction (0.1 - 1.0).",
                render: (setting) =>
                    setting.addText((text) =>
                        text.setValue(plugin.settings.importerUtilization.toFixed(2)).onChange(async (value) => {
                            const parsed = parseFloat(value);
                            if (isNaN(parsed)) return;
                            await plugin.updateSettings({ importerUtilization: Math.max(0.1, Math.min(1.0, parsed)) });
                        })
                    ),
            },
        ];
    }

    /** Read-only rows; their text is computed when the tab renders. */
    private diagnosticItems(): SettingItem[] {
        const plugin = this.plugin;
        return [
            {
                name: "Index status",
                aliases: ["diagnostics"],
                render: (setting) => setting.setDesc(describeIndex(plugin.indexStatus())),
            },
            {
                name: "Connected plugins",
                aliases: ["consumers", "views", "diagnostics"],
                render: (setting) => setting.setDesc(describeConsumers(plugin.consumers())),
            },
            {
                name: "Reindex vault",
                desc: "Drop the index and rebuild it from every file in the vault.",
                aliases: ["rebuild index"],
                render: (setting) =>
                    setting.addButton((button) =>
                        button.setButtonText("Reindex").onClick(async () => {
                            button.setDisabled(true);
                            try {
                                await plugin.reindex();
                            } finally {
                                button.setDisabled(false);
                            }
                        })
                    ),
            },
        ];
    }
}

/** Render one row the way Obsidian 1.13+ does: name and description first, then the item's controls. */
function renderItem(containerEl: HTMLElement, item: SettingItem): void {
    const setting = new Setting(containerEl).setName(item.name);
    if (item.desc !== undefined) setting.setDesc(item.desc);
    item.render(setting);
}

/** "Ready: 1,234 objects indexed (revision 56)." or "Indexing the vault…". */
export function describeIndex(status: { initialized: boolean; objects: number; revision: number }): string {
    if (!status.initialized) return "Indexing the vault…";
    return `Ready: ${status.objects.toLocaleString()} objects indexed (revision ${status.revision}).`;
}

/** The connected plugins by name (each listed once), or a hint when there are none. */
export function describeConsumers(consumers: readonly ConsumerInfo[]): string {
    const names = [...new Set(consumers.map((consumer) => consumer.name ?? consumer.id))].sort((a, b) =>
        a.localeCompare(b)
    );
    if (names.length === 0) return "None. Views come from a view plugin such as Datacore View: Preact.";
    return names.join(", ");
}
