import { EngineHost } from "api/engine-host";
import { Datacore } from "index/datacore";
import { Plugin } from "obsidian";
import type { ConsumerInfo, DisplaySettings } from "@yankeeinlondon/datacore-contract";
import { migrateSettings, Settings } from "settings";
import { type EngineSettingsHost, GeneralSettingsTab } from "settings-tab";

/**
 * @internal Datacore Engine: indexes the vault and serves queries to other plugins through the shared registry
 * (`getDatacore()` in the client) and to scripts and the console through `window.dc`. It renders nothing; the views
 * live in datacore-view-preact.
 */
export default class DatacorePlugin extends Plugin implements EngineSettingsHost {
    /** Plugin-wide default settings. */
    public settings: Settings;

    /** Central internal state. */
    public core: Datacore;

    /** Publishes the engine to other plugins; knows which consumers are connected. */
    private host: EngineHost | undefined;

    async onload() {
        this.settings = migrateSettings(await this.loadData());
        this.addSettingTab(new GeneralSettingsTab(this.app, this));

        // Initialize the core API for usage in all views and downstream apps.
        this.addChild((this.core = new Datacore(this.app, this.manifest.version, this.settings)));

        // Publish the engine to other plugins (shared registry) and to scripts (`window.dc`).
        const host = (this.host = new EngineHost(this.core, {
            host: window,
            pluginId: this.manifest.id,
            engineVersion: this.manifest.version,
        }));
        host.start();
        this.register(() => {
            host.stop();
            this.host = undefined;
        });

        // Useful debug and non-debug commands.
        // Drops the current index and reindexes all items.
        this.addCommand({
            id: "datacore-reindex-vault",
            name: "Reindex entire vault",
            callback: () => this.reindex(),
        });

        // Initialize as soon as the workspace is ready.
        this.app.workspace.onLayoutReady(async () => this.core.initialize());
    }

    /** Drop the index and reindex every file. */
    async reindex(): Promise<void> {
        console.debug("Datacore: dropping the datastore and reindexing all items.");
        await this.core.reindex();
    }

    /** Index state for the settings tab's diagnostics. */
    indexStatus(): { initialized: boolean; objects: number; revision: number } {
        return { initialized: this.core.initialized, objects: this.core.datastore.size, revision: this.core.revision };
    }

    /** Plugins connected through the client, for the settings tab's diagnostics. */
    consumers(): ConsumerInfo[] {
        return this.host?.consumers() ?? [];
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
