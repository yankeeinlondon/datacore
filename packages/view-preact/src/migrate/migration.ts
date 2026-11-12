import type { TFile } from "obsidian";
import { convertFences } from "./convert-fences";

/** The vault operations the migration uses (a structural subset of Obsidian's `Vault`, so tests can fake it). */
export interface MigrationVault {
    getMarkdownFiles(): TFile[];
    cachedRead(file: TFile): Promise<string>;
    process(file: TFile, transform: (data: string) => string): Promise<string>;
}

/** A note with `datacore*` code blocks to convert. */
export interface PendingNote {
    file: TFile;
    /** Number of fences to rewrite, as of the scan. */
    blocks: number;
}

/** What {@link convertNotes} did. */
export interface MigrationSummary {
    /** Notes that were rewritten. */
    notes: number;
    /** Fences rewritten across those notes (counted on the content at write time). */
    blocks: number;
    /** Notes that could not be read or written. */
    failures: { file: TFile; error: unknown }[];
}

/** Cheap pre-filter: a note without this text has nothing to convert. */
const MARKER = "datacore";

/** Finds the markdown notes with `datacore*` code blocks, sorted by path. Unreadable notes are skipped. */
export async function findPendingNotes(vault: MigrationVault): Promise<PendingNote[]> {
    const pending: PendingNote[] = [];
    for (const file of vault.getMarkdownFiles()) {
        let text: string;
        try {
            text = await vault.cachedRead(file);
        } catch {
            continue;
        }
        if (!text.includes(MARKER)) continue;
        const blocks = convertFences(text).changes.length;
        if (blocks > 0) pending.push({ file, blocks });
    }
    return pending.sort((left, right) => left.file.path.localeCompare(right.file.path));
}

/**
 * Rewrites each note. The conversion runs again on the note's current content inside `vault.process`, so edits made
 * since the scan are kept and the counts reflect what was actually written. One failing note does not stop the rest.
 */
export async function convertNotes(vault: MigrationVault, files: readonly TFile[]): Promise<MigrationSummary> {
    const summary: MigrationSummary = { notes: 0, blocks: 0, failures: [] };
    for (const file of files) {
        let blocks = 0;
        try {
            await vault.process(file, (data) => {
                const result = convertFences(data);
                blocks = result.changes.length;
                return result.text;
            });
        } catch (error) {
            summary.failures.push({ file, error });
            continue;
        }
        if (blocks > 0) {
            summary.notes += 1;
            summary.blocks += blocks;
        }
    }
    return summary;
}

/** `1 block`, `2 blocks`. */
export function plural(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
