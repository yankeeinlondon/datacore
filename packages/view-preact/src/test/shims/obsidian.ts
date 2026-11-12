/**
 * Minimal runtime stand-in for the `obsidian` module in unit tests (the npm package ships types only). Implements just
 * what the view tests load: the Component lifecycle, render children, and vault file classes.
 */

export class Component {
    private loaded = false;
    private readonly children: Component[] = [];
    private cleanups: (() => unknown)[] = [];

    load(): void {
        if (this.loaded) return;
        this.loaded = true;
        void this.onload();
        for (const child of this.children.slice()) child.load();
    }

    onload(): void | Promise<void> {}

    unload(): void {
        if (!this.loaded) return;
        this.loaded = false;
        while (this.children.length > 0) this.children.pop()?.unload();
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
}

/** A component tied to a rendered element. */
export class MarkdownRenderChild extends Component {
    constructor(public containerEl: HTMLElement) {
        super();
    }
}

/** Base class for vault files and folders. */
export class TAbstractFile {
    path = "";
    name = "";
}

/** A file in the vault. */
export class TFile extends TAbstractFile {
    basename = "";
    extension = "";
}
