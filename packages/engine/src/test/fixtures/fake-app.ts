/**
 * In-memory stand-ins for the parts of Obsidian's `App` that the engine uses: the vault, the metadata cache, and the
 * file manager. They emit the same events Obsidian does so the engine's change handling runs unmodified.
 */
import { Events, TFile, TFolder } from "obsidian";
import type { App, CachedMetadata, FileManager, MetadataCache, Vault } from "obsidian";
import type { BuiltNote } from "test/fixtures/note-builder";

function basename(path: string): string {
    const name = path.substring(path.lastIndexOf("/") + 1);
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.substring(0, dot) : name;
}

function extension(path: string): string {
    const dot = path.lastIndexOf(".");
    return dot > path.lastIndexOf("/") ? path.substring(dot + 1) : "";
}

/** In-memory vault: a folder tree of TFile/TFolder plus file contents. Emits Obsidian's vault events. */
export class FakeVault extends Events {
    readonly root: TFolder;
    private readonly contents = new Map<string, string>();
    private readonly entries = new Map<string, TFile | TFolder>();
    private clock = 1_000;

    constructor() {
        super();
        this.root = new TFolder();
        this.root.path = "/";
        this.root.name = "";
        this.entries.set("/", this.root);
    }

    getFiles(): TFile[] {
        return [...this.entries.values()].filter((entry): entry is TFile => entry instanceof TFile);
    }

    getAbstractFileByPath(path: string): TFile | TFolder | null {
        return this.entries.get(path === "" ? "/" : path) ?? null;
    }

    getFileByPath(path: string): TFile | null {
        const entry = this.entries.get(path);
        return entry instanceof TFile ? entry : null;
    }

    async cachedRead(file: TFile): Promise<string> {
        return this.read(file);
    }

    async read(file: TFile): Promise<string> {
        const content = this.contents.get(file.path);
        if (content === undefined) throw new Error(`File not found: ${file.path}`);
        return content;
    }

    async process(file: TFile, transform: (data: string) => string): Promise<string> {
        const updated = transform(await this.read(file));
        this.write(file.path, updated);
        return updated;
    }

    /** Create or overwrite a file (no events; see `FakeApp` for event-emitting helpers). Returns the file. */
    write(path: string, content: string): TFile {
        const existing = this.getFileByPath(path);
        const file = existing ?? this.createFile(path);
        const now = this.tick();
        if (!existing) file.stat.ctime = now;
        file.stat.mtime = now;
        file.stat.size = content.length;
        this.contents.set(path, content);
        return file;
    }

    /** Remove a file (no events). Returns the removed file. */
    remove(path: string): TFile {
        const file = this.getFileByPath(path);
        if (!file) throw new Error(`File not found: ${path}`);
        this.detach(file);
        this.entries.delete(path);
        this.contents.delete(path);
        return file;
    }

    /** Move a file (no events). Returns the file, now at its new path. */
    move(from: string, to: string): TFile {
        const file = this.getFileByPath(from);
        if (!file) throw new Error(`File not found: ${from}`);
        const content = this.contents.get(from)!;
        this.detach(file);
        this.entries.delete(from);
        this.contents.delete(from);

        this.place(file, to);
        this.contents.set(to, content);
        file.stat.mtime = this.tick();
        return file;
    }

    private createFile(path: string): TFile {
        const file = new TFile();
        this.place(file, path);
        return file;
    }

    private place(file: TFile, path: string): void {
        file.path = path;
        file.name = path.substring(path.lastIndexOf("/") + 1);
        file.basename = basename(path);
        file.extension = extension(path);
        const parent = this.ensureFolder(path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "");
        file.parent = parent;
        parent.children.push(file);
        this.entries.set(path, file);
    }

    private ensureFolder(path: string): TFolder {
        if (path === "") return this.root;
        const existing = this.entries.get(path);
        if (existing instanceof TFolder) return existing;

        const folder = new TFolder();
        folder.path = path;
        folder.name = path.substring(path.lastIndexOf("/") + 1);
        const parent = this.ensureFolder(path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "");
        folder.parent = parent;
        parent.children.push(folder);
        this.entries.set(path, folder);
        return folder;
    }

    private detach(file: TFile): void {
        const siblings = file.parent?.children;
        if (siblings) siblings.splice(siblings.indexOf(file), 1);
    }

    private tick(): number {
        return (this.clock += 1_000);
    }
}

/** In-memory metadata cache with Obsidian-like link resolution. Emits `resolve` like Obsidian's MetadataCache. */
export class FakeMetadataCache extends Events {
    private readonly cache = new Map<string, CachedMetadata>();

    constructor(private readonly vault: FakeVault) {
        super();
    }

    getFileCache(file: TFile): CachedMetadata | null {
        return this.cache.get(file.path) ?? null;
    }

    set(path: string, metadata: CachedMetadata): void {
        this.cache.set(path, metadata);
    }

    delete(path: string): void {
        this.cache.delete(path);
    }

    move(from: string, to: string): void {
        const metadata = this.cache.get(from);
        this.cache.delete(from);
        if (metadata) this.cache.set(to, metadata);
    }

    /** Resolve link text to a file: exact path (with or without `.md`), else first file with a matching basename. */
    getFirstLinkpathDest(linkpath: string, _sourcePath: string): TFile | null {
        const target = linkpath.split("#")[0]!;
        const exact = this.vault.getFileByPath(target) ?? this.vault.getFileByPath(`${target}.md`);
        if (exact) return exact;
        const name = target.substring(target.lastIndexOf("/") + 1);
        return this.vault.getFiles().find((file) => file.basename === name || file.name === name) ?? null;
    }
}

/** A fake Obsidian `App` with helpers that change the vault and emit the events Obsidian would. */
export class FakeApp {
    readonly vault = new FakeVault();
    readonly metadataCache = new FakeMetadataCache(this.vault);
    readonly fileManager = {} as FileManager;

    /** The fake typed as Obsidian's `App`, for passing to engine constructors. */
    asApp(): App {
        return this as unknown as App;
    }

    /** Typed views of the fakes for engine constructors. */
    get obsidianVault(): Vault {
        return this.vault as unknown as Vault;
    }

    get obsidianMetadataCache(): MetadataCache {
        return this.metadataCache as unknown as MetadataCache;
    }

    /** Put a note in the vault and metadata cache without emitting events (for initial vault contents). */
    seed(note: BuiltNote): TFile {
        const file = this.vault.write(note.path, note.content);
        this.metadataCache.set(note.path, note.metadata);
        return file;
    }

    /** Create or update a note, emitting `create`/`modify` and then metadata `resolve`, as Obsidian does. */
    upsert(note: BuiltNote): TFile {
        const existed = this.vault.getFileByPath(note.path) !== null;
        const file = this.seed(note);
        this.vault.trigger(existed ? "modify" : "create", file);
        this.metadataCache.trigger("resolve", file);
        return file;
    }

    /** Delete a note, emitting `delete`. */
    delete(path: string): TFile {
        this.metadataCache.delete(path);
        const file = this.vault.remove(path);
        this.vault.trigger("delete", file);
        return file;
    }

    /** Rename a note, emitting `rename(file, oldPath)`. */
    rename(from: string, to: string): TFile {
        this.metadataCache.move(from, to);
        const file = this.vault.move(from, to);
        this.vault.trigger("rename", file, from);
        return file;
    }
}
