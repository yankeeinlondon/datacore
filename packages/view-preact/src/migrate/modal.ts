import { type App, Modal, Notice, Setting, type TFile } from "obsidian";
import { LANGUAGE_RENAMES } from "./convert-fences";
import { convertNotes, findPendingNotes, type MigrationVault, type PendingNote, plural } from "./migration";

/** The command's name, also the modal title. */
export const CONVERT_COMMAND_NAME = "Convert datacore code blocks to dc";

/** Scans the vault, then opens the preview modal, or reports that there is nothing to convert. */
export async function startConversion(app: App): Promise<void> {
    const vault: MigrationVault = app.vault;
    const pending = await findPendingNotes(vault);
    if (pending.length === 0) {
        new Notice("No datacore code blocks to convert.");
        return;
    }
    new ConvertBlocksModal(app, vault, pending).open();
}

/** Lists the notes and block counts the conversion will change, and runs it on confirm. */
class ConvertBlocksModal extends Modal {
    private running = false;

    constructor(
        app: App,
        private readonly vault: MigrationVault,
        private readonly pending: readonly PendingNote[]
    ) {
        super(app);
    }

    onOpen(): void {
        const { contentEl } = this;
        const blocks = this.pending.reduce((total, note) => total + note.blocks, 0);
        const renames = Object.entries(LANGUAGE_RENAMES)
            .map(([from, to]) => `${from} → ${to}`)
            .join(", ");

        this.setTitle(CONVERT_COMMAND_NAME);
        contentEl.createEl("p", {
            text:
                `${plural(blocks, "code block")} in ${plural(this.pending.length, "note")} use upstream Datacore's ` +
                `languages. Converting renames them (${renames}) so that Datacore View: Preact renders them. ` +
                "Upstream Datacore does not render the converted blocks.",
        });
        contentEl.createEl("p", {
            cls: "mod-warning",
            text: "This rewrites the notes listed below. Back up your vault before converting.",
        });

        const list = contentEl.createDiv({ cls: "datacore-convert-list" }).createEl("ul");
        for (const note of this.pending) {
            const item = list.createEl("li");
            item.createSpan({ text: note.file.path });
            item.createSpan({ cls: "datacore-convert-count", text: ` (${plural(note.blocks, "block")})` });
        }

        new Setting(contentEl)
            .addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()))
            .addButton((button) =>
                button
                    .setButtonText(`Convert ${plural(this.pending.length, "note")}`)
                    .setCta()
                    .onClick(() => {
                        if (this.running) return;
                        this.running = true;
                        button.setDisabled(true).setButtonText("Converting…");
                        void this.convert();
                    })
            );
    }

    onClose(): void {
        this.contentEl.empty();
    }

    private async convert(): Promise<void> {
        const files: TFile[] = this.pending.map((note) => note.file);
        const summary = await convertNotes(this.vault, files);
        this.close();

        let message = `Converted ${plural(summary.blocks, "code block")} in ${plural(summary.notes, "note")}.`;
        if (summary.failures.length > 0) {
            message += ` ${plural(summary.failures.length, "note")} could not be converted; see the developer console.`;
            for (const { file, error } of summary.failures) {
                console.error(`Datacore View: Preact: could not convert ${file.path}`, error);
            }
        }
        new Notice(message, summary.failures.length > 0 ? 0 : undefined);
    }
}
