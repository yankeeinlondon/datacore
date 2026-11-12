/** Runs file imports on the calling thread; same results as the web-worker importer, without workers. */

import { canvasImport } from "index/import/canvas";
import { markdownImport } from "index/import/markdown";
import { FileImportService } from "index/web-worker/importer";
import { ImportResult } from "index/web-worker/message";
import { FileManager, MetadataCache, TFile, Vault } from "obsidian";

/**
 * Imports files synchronously in-process (no web workers). Produces the same `ImportResult` messages as
 * `importer.worker.ts`. Used by tests and anywhere background workers are unavailable.
 */
export class InProcessImporter implements FileImportService {
    public constructor(
        private readonly vault: Vault,
        private readonly fileManager: FileManager,
        private readonly metadataCache: MetadataCache
    ) {}

    public async import<T>(file: TFile): Promise<T> {
        return (await this.importFile(file)) as T;
    }

    private async importFile(file: TFile): Promise<ImportResult> {
        try {
            switch (file.extension) {
                case "markdown":
                case "md": {
                    const contents = await this.vault.cachedRead(file);
                    const metadata = this.metadataCache.getFileCache(file);
                    if (!metadata) return { type: "error", $error: `No metadata available for '${file.path}'.` };

                    return { type: "markdown", result: markdownImport(file.path, contents, metadata, file.stat) };
                }
                case "canvas": {
                    const contents = await this.vault.cachedRead(file);
                    const index = this.fileManager.linkUpdaters?.canvas?.canvas?.index?.index?.[file.path] ?? {
                        caches: {},
                        embeds: [],
                    };

                    return { type: "canvas", result: canvasImport(file.path, contents, index, file.stat) };
                }
                default:
                    return { type: "error", $error: `Unsupported file type '${file.extension}'.` };
            }
        } catch (error) {
            return { type: "error", $error: error instanceof Error ? error.message : String(error) };
        }
    }
}
