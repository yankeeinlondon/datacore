import { describe, it, expect } from "vitest";
import { Datastore } from "index/datastore";
import { GenericFile } from "index/types/files";
import { Indexable } from "index/types/indexable";
import { DateTime } from "luxon";
import { MetadataCache, Vault } from "obsidian";
import { DEFAULT_SETTINGS } from "settings";

/** Construct a datastore with minimal stubs; revision tracking does not touch the vault or metadata cache. */
function emptyDatastore(): Datastore {
    return new Datastore({} as Vault, {} as MetadataCache, DEFAULT_SETTINGS);
}

function file(path: string): Indexable {
    const now = DateTime.fromMillis(0);
    return new GenericFile(path, now, now, 0);
}

describe("Datastore revisions", () => {
    it("starts at revision zero", () => {
        expect(emptyDatastore().revision).toEqual(0);
    });

    it("stamps stored objects with the datastore revision after the store", () => {
        const store = emptyDatastore();
        const first = file("a.txt");

        store.store(first);
        expect(store.revision).toEqual(1);
        expect(first.$revision).toEqual(store.revision);
    });

    it("keeps $revision equal to the store revision across store/delete/store", () => {
        const store = emptyDatastore();
        const alpha = file("alpha.txt");
        const beta = file("beta.txt");

        store.store(alpha);
        const afterAlpha = store.revision;
        expect(alpha.$revision).toEqual(afterAlpha);

        expect(store.delete(alpha.$id)).toBe(true);
        expect(store.revision).toEqual(afterAlpha + 1);

        store.store(beta);
        expect(beta.$revision).toEqual(store.revision);
        expect(store.revision).toEqual(afterAlpha + 2);
    });

    it("assigns strictly increasing revisions to successive stores", () => {
        const store = emptyDatastore();
        const revisions = ["one.txt", "two.txt", "three.txt"].map((path) => {
            const object = file(path);
            store.store(object);
            return object.$revision!;
        });

        expect(revisions).toEqual([1, 2, 3]);
    });
});
