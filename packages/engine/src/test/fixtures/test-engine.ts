/**
 * Runs a real `Datacore` headless over an in-memory vault, for engine and API tests.
 *
 * The engine is unmodified: only its environment services are swapped (in-process importer instead of web workers,
 * in-memory cache instead of IndexedDB), and the fake app emits Obsidian's vault/metadata events.
 */
import { QUERY } from "expression/parser";
import { Datacore } from "index/datacore";
import type { Indexable } from "index/types/indexable";
import { InProcessImporter } from "index/web-worker/in-process-importer";
import { DEFAULT_SETTINGS, Settings } from "settings";
import { FakeApp } from "test/fixtures/fake-app";
import { MemoryCache } from "test/fixtures/memory-cache";
import { BuiltNote, NoteBuilder } from "test/fixtures/note-builder";

export const TEST_ENGINE_VERSION = "test";

export interface TestEngineOptions {
    /** Notes present in the vault before the engine initializes. */
    notes?: (NoteBuilder | BuiltNote)[];
    /** Share a cache between engine instances to exercise cached startup. */
    cache?: MemoryCache;
    /** Engine settings overrides. */
    settings?: Partial<Settings>;
}

/** A running headless engine plus helpers that mutate the vault and wait for the engine to catch up. */
export interface TestEngine {
    app: FakeApp;
    core: Datacore;
    cache: MemoryCache;
    /** Create or update a note; resolves once the engine has re-indexed it. */
    write(note: NoteBuilder | BuiltNote): Promise<void>;
    /** Delete a note; resolves once the engine has dropped it. */
    remove(path: string): Promise<void>;
    /** Rename a note; resolves once the engine has re-indexed it at the new path. */
    rename(from: string, to: string): Promise<void>;
    /** Run a query in the engine's query language and return the matching objects. */
    query<T extends Indexable = Indexable>(query: string): T[];
    /** Unload the engine. */
    dispose(): void;
}

function built(note: NoteBuilder | BuiltNote): BuiltNote {
    return note instanceof NoteBuilder ? note.build() : note;
}

/** Resolve on the next occurrence of a Datacore event. */
function nextEvent(core: Datacore, event: "update" | "rename" | "initialized"): Promise<void> {
    return new Promise((resolve) => {
        const ref = core.on(event as "update", () => {
            core.offref(ref);
            resolve();
        });
    });
}

/** Start a headless engine over the given notes and wait for the initial index to finish. */
export async function createTestEngine(options: TestEngineOptions = {}): Promise<TestEngine> {
    const app = new FakeApp();
    for (const note of options.notes ?? []) app.seed(built(note));

    const cache = options.cache ?? new MemoryCache();
    const settings: Settings = { ...DEFAULT_SETTINGS, ...options.settings };
    const core = new Datacore(app.asApp(), TEST_ENGINE_VERSION, settings, {
        importer: new InProcessImporter(app.obsidianVault, app.fileManager, app.obsidianMetadataCache),
        persister: cache,
    });

    const initialized = nextEvent(core, "initialized");
    core.load();
    core.initialize();
    await initialized;

    return {
        app,
        core,
        cache,
        async write(note) {
            const updated = nextEvent(core, "update");
            app.upsert(built(note));
            await updated;
        },
        async remove(path) {
            const updated = nextEvent(core, "update");
            app.delete(path);
            await updated;
        },
        async rename(from, to) {
            const renamed = nextEvent(core, "rename");
            app.rename(from, to);
            await renamed;
        },
        query<T extends Indexable = Indexable>(query: string): T[] {
            return core.datastore.search(QUERY.query.tryParse(query)).orElseThrow().results as T[];
        },
        dispose() {
            core.unload();
        },
    };
}
