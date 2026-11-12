/** In-memory `FileCache` (the IndexedDB-backed cache's test double). */
import type { Cached, FileCache } from "index/persister";

export class MemoryCache implements FileCache {
    readonly entries = new Map<string, Cached<Partial<unknown>>>();

    constructor(private readonly version: string) {}

    async loadFile(path: string): Promise<Cached<Partial<unknown>> | undefined> {
        return this.entries.get(path);
    }

    async storeFile(path: string, data: Partial<unknown>): Promise<void> {
        this.entries.set(path, { version: this.version, time: Date.now(), data });
    }

    async recreate(): Promise<void> {
        this.entries.clear();
    }

    async synchronize(existing: string[] | Set<string>): Promise<Set<string>> {
        const keep = new Set(existing);
        const removed = new Set<string>();
        // Deleting from a Map while iterating it is well-defined.
        for (const path of this.entries.keys()) {
            if (!keep.has(path)) {
                this.entries.delete(path);
                removed.add(path);
            }
        }
        return removed;
    }
}
