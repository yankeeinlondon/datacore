/** Private Obsidian APIs the views use (not in the public `obsidian` typings). */
import "obsidian";

declare module "obsidian" {
    /** Context Obsidian passes to an embed creator. */
    interface EmbedContext {
        app: App;
        linktext: string;
        sourcePath: string;
        showInline: boolean;
        depth: number;
        containerEl: HTMLElement;
        displayMode: boolean;
    }

    /** A rendered file embed. */
    type FileEmbed = FileView & { loadFile: (file: TFile) => void };

    /** An embed creator: a class in older Obsidian versions, a factory function in Obsidian 1.15+. */
    type EmbedCreator =
        | (new (context: EmbedContext, file: TFile, subpath?: string) => FileEmbed)
        | ((context: EmbedContext, file: TFile, subpath?: string) => FileEmbed);

    interface App {
        embedRegistry: {
            /** Private API. Returned a class up to some 1.x release; Obsidian 1.15 returns a factory function. */
            getEmbedCreator: (file: TFile) => EmbedCreator;
        };
    }
}
