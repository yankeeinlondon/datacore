import { EngineHost } from "api/engine-host";
import { Datacore } from "index/datacore";
import { DateTime } from "luxon";
import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { DisplaySettings } from "@yankeeinlondon/datacore-contract";
import { migrateSettings, Settings } from "settings";

/**
 * @internal Datacore Engine: indexes the vault and serves queries to other plugins through the shared registry
 * (`getDatacore()` in the client) and to scripts and the console through `window.dc`. It renders nothing; the views
 * live in datacore-view-preact.
 */
export default class DatacorePlugin extends Plugin {
    /** Plugin-wide default settings. */
    public settings: Settings;

    /** Central internal state. */
    public core: Datacore;

    async onload() {
        this.settings = migrateSettings(await this.loadData());
        this.addSettingTab(new GeneralSettingsTab(this.app, this));

        // Initialize the core API for usage in all views and downstream apps.
        this.addChild((this.core = new Datacore(this.app, this.manifest.version, this.settings)));

        // Publish the engine to other plugins (shared registry) and to scripts (`window.dc`).
        const host = new EngineHost(this.core, {
            host: window,
            pluginId: this.manifest.id,
            engineVersion: this.manifest.version,
        });
        host.start();
        this.register(() => host.stop());

        // Useful debug and non-debug commands.
        // Drops the current index and reindexes all items.
        this.addCommand({
            id: "datacore-reindex-vault",
            name: "Reindex entire vault",
            callback: async () => {
                console.debug("Datacore: dropping the datastore and reindexing all items.");
                await this.core.reindex();
            },
        });

        // Initialize as soon as the workspace is ready.
        this.app.workspace.onLayoutReady(async () => this.core.initialize());
    }

    /** Update the given settings to new values. */
    async updateSettings(settings: Partial<Omit<Settings, "display">>) {
        Object.assign(this.settings, settings);
        await this.saveData(this.settings);
    }

    /** Update display settings and notify every view (they re-render on the `display-settings` event). */
    async updateDisplay(display: Partial<DisplaySettings>) {
        this.settings.display = { ...this.settings.display, ...display };
        await this.saveData(this.settings);
        this.core.notifyDisplaySettings({ ...this.settings.display });
    }
}

/** Datacore Engine settings: the single settings tab for the plugin family (Engine Room spec §8.2). */
class GeneralSettingsTab extends PluginSettingTab {
    constructor(
        app: App,
        private plugin: DatacorePlugin
    ) {
        super(app, plugin);
    }

    public display(): void {
        this.containerEl.empty();
        const display = this.plugin.settings.display;

        new Setting(this.containerEl)
            .setName("Display")
            .setDesc("Defaults shared by every Datacore view.")
            .setHeading();

        new Setting(this.containerEl)
            .setName("Pagination")
            .setDesc(
                "If enabled, splits up views into pages of results which can be traversed " +
                    "via buttons at the top and bottom of the view. This substantially improves " +
                    "the performance of large views, and can help with visual clutter. Note that " +
                    "this setting can also be set on a per-view basis."
            )
            .addToggle((toggle) => {
                toggle.setValue(display.pagingEnabled).onChange(async (value) => {
                    await this.plugin.updateDisplay({ pagingEnabled: value });
                });
            });

        new Setting(this.containerEl)
            .setName("Default page size")
            .setDesc("The number of entries to show per page, by default. This can be overriden on a per-view basis.")
            .addDropdown((dropdown) => {
                const OPTIONS: Record<string, string> = {
                    "25": "25",
                    "50": "50",
                    "100": "100",
                    "200": "200",
                    "500": "500",
                };
                const current = "" + display.pageSize;
                if (!(current in OPTIONS)) OPTIONS[current] = current;

                dropdown
                    .addOptions(OPTIONS)
                    .setValue(current)
                    .onChange(async (value) => {
                        const parsed = parseFloat(value);
                        if (isNaN(parsed)) return;

                        await this.plugin.updateDisplay({ pageSize: parsed | 0 });
                    });
            });

        new Setting(this.containerEl)
            .setName("Scroll on page change")
            .setDesc(
                "If enabled, table that are paged will scroll to the top of the table when the page changes. " +
                    "This can be overriden on a per-view basis."
            )
            .addToggle((toggle) => {
                toggle.setValue(display.scrollOnPageChange).onChange(async (value) => {
                    await this.plugin.updateDisplay({ scrollOnPageChange: value });
                });
            });

        new Setting(this.containerEl)
            .setName("Empty values")
            .setDesc("What to show for unset/empty properties.")
            .addText((text) => {
                text.setValue(display.nullAs).onChange(async (value) => {
                    await this.plugin.updateDisplay({ nullAs: value });
                });
            });

        new Setting(this.containerEl)
            .setName("Default date format")
            .setDesc(
                "The default format that dates are rendered in. Uses luxon date formatting (https://github.com/moment/luxon/blob/master/docs/formatting.md#formatting-with-tokens-strings-for-cthulhu)."
            )
            .addText((text) => {
                text.setValue(display.dateFormat).onChange(async (value) => {
                    // check if date format is valid
                    try {
                        DateTime.fromMillis(Date.now()).toFormat(value);
                    } catch {
                        return;
                    }
                    await this.plugin.updateDisplay({ dateFormat: value });
                });
            });

        new Setting(this.containerEl)
            .setName("Default date/time format")
            .setDesc(
                "The default format that date-times are rendered in. Uses luxon date formatting (https://github.com/moment/luxon/blob/master/docs/formatting.md#formatting-with-tokens-strings-for-cthulhu)."
            )
            .addText((text) => {
                text.setValue(display.dateTimeFormat).onChange(async (value) => {
                    try {
                        DateTime.fromMillis(Date.now()).toFormat(value);
                    } catch {
                        return;
                    }
                    await this.plugin.updateDisplay({ dateTimeFormat: value });
                });
            });

        new Setting(this.containerEl)
            .setName("Maximum recursive render depth")
            .setDesc(
                "Maximum depth that objects will be rendered to (i.e., how many levels of subproperties " +
                    "will be rendered by default). This avoids infinite recursion due to self-referential objects " +
                    "and ensures that rendering objects is acceptably performant."
            )
            .addText((text) => {
                text.setValue(display.maxRecursiveRenderDepth.toString()).onChange(async (value) => {
                    const parsed = parseInt(value);
                    if (isNaN(parsed)) return;
                    await this.plugin.updateDisplay({ maxRecursiveRenderDepth: parsed });
                });
            });

        new Setting(this.containerEl).setName("Indexing").setHeading();

        new Setting(this.containerEl)
            .setName("Inline fields")
            .setDesc(
                "If enabled, inline fields will be parsed in all documents. Finding inline fields requires a full text scan through each document, " +
                    "which noticably slows down indexing for large vaults. Disabling this functionality will mean metadata will only come from tags, links, and " +
                    "Properties / frontmatter"
            )
            .addToggle((toggle) => {
                toggle.setValue(this.plugin.settings.indexInlineFields).onChange(async (value) => {
                    await this.plugin.updateSettings({ indexInlineFields: value });

                    // TODO: Request a full index drop + reindex for correctness.
                });
            });

        new Setting(this.containerEl)
            .setName("Importer threads")
            .setDesc("The number of importer threads to use for parsing metadata.")
            .addText((text) => {
                text.setValue("" + this.plugin.settings.importerNumThreads).onChange(async (value) => {
                    const parsed = parseInt(value);
                    if (isNaN(parsed)) return;

                    await this.plugin.updateSettings({ importerNumThreads: parsed });
                });
            });

        new Setting(this.containerEl)
            .setName("Importer utilization")
            .setDesc("How much CPU time each importer thread should use, as a fraction (0.1 - 1.0).")
            .addText((text) => {
                text.setValue(this.plugin.settings.importerUtilization.toFixed(2)).onChange(async (value) => {
                    const parsed = parseFloat(value);
                    if (isNaN(parsed)) return;

                    const limited = Math.max(0.1, Math.min(1.0, parsed));
                    await this.plugin.updateSettings({ importerUtilization: limited });
                });
            });
    }
}
