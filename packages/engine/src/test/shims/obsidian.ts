/**
 * Minimal runtime stand-in for the `obsidian` module in unit tests.
 *
 * The `obsidian` npm package ships type declarations only, so any engine module that imports a runtime value from it
 * cannot load under Vitest without this shim. It implements just enough real behaviour for the engine to run headless:
 * an event bus, the Component lifecycle, and the vault file classes. Add to it only as tests need more.
 */

/** Handle for an event subscription (matches Obsidian's `EventRef` shape closely enough for the engine). */
export interface EventRef {
    e: Events;
    name: string;
    fn: (...data: unknown[]) => unknown;
    ctx?: unknown;
}

/** Simple synchronous event bus with Obsidian's `Events` API. */
export class Events {
    private readonly handlers = new Map<string, EventRef[]>();

    on(name: string, callback: (...data: never[]) => unknown, ctx?: unknown): EventRef {
        const ref: EventRef = { e: this, name, fn: callback as EventRef["fn"], ctx };
        const list = this.handlers.get(name) ?? [];
        list.push(ref);
        this.handlers.set(name, list);
        return ref;
    }

    off(name: string, callback: (...data: never[]) => unknown): void {
        const list = this.handlers.get(name);
        if (!list) return;
        this.handlers.set(
            name,
            list.filter((ref) => ref.fn !== (callback as EventRef["fn"]))
        );
    }

    offref(ref: EventRef): void {
        const list = this.handlers.get(ref.name);
        if (!list) return;
        this.handlers.set(
            ref.name,
            list.filter((candidate) => candidate !== ref)
        );
    }

    trigger(name: string, ...data: unknown[]): void {
        // Snapshot: handlers may unsubscribe while being dispatched.
        for (const ref of (this.handlers.get(name) ?? []).slice()) ref.fn.apply(ref.ctx, data);
    }

    tryTrigger(ref: EventRef, args: unknown[]): void {
        ref.fn.apply(ref.ctx, args);
    }
}

/** Obsidian's Component lifecycle: load/unload, child components, and cleanup registration. */
export class Component {
    private loaded = false;
    private readonly children: Component[] = [];
    private cleanups: (() => unknown)[] = [];

    load(): void {
        if (this.loaded) return;
        this.loaded = true;
        void this.onload();
        // Snapshot: loading a child may add further children.
        for (const child of this.children.slice()) child.load();
    }

    onload(): void | Promise<void> {}

    unload(): void {
        if (!this.loaded) return;
        this.loaded = false;
        while (this.children.length > 0) this.children.pop()!.unload();
        const cleanups = this.cleanups;
        this.cleanups = [];
        for (const cleanup of cleanups) cleanup();
        this.onunload();
    }

    onunload(): void {}

    addChild<T extends Component>(component: T): T {
        this.children.push(component);
        if (this.loaded) component.load();
        return component;
    }

    removeChild<T extends Component>(component: T): T {
        const index = this.children.indexOf(component);
        if (index !== -1) {
            this.children.splice(index, 1);
            component.unload();
        }
        return component;
    }

    register(cleanup: () => unknown): void {
        this.cleanups.push(cleanup);
    }

    registerEvent(ref: EventRef): void {
        this.register(() => ref.e.offref(ref));
    }

    registerInterval(id: number): number {
        this.register(() => window.clearInterval(id));
        return id;
    }
}

/** Base class for vault files and folders. */
export class TAbstractFile {
    path = "";
    name = "";
    parent: TFolder | null = null;
}

/** A file in the vault. */
export class TFile extends TAbstractFile {
    basename = "";
    extension = "";
    stat = { ctime: 0, mtime: 0, size: 0 };
}

/** A folder in the vault. */
export class TFolder extends TAbstractFile {
    children: TAbstractFile[] = [];

    isRoot(): boolean {
        return this.parent === null;
    }
}
