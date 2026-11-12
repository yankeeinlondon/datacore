/**
 * Datacore Parity Helper (development only, never released).
 *
 * Exposes `window.__datacoreParity.render(path)`, which renders a note with Obsidian's `MarkdownRenderer` into an
 * off-screen, invisible container (no workspace leaf, no focus change) and resolves with the container's HTML once it
 * has stopped changing. Driven by `fixtures/parity.ts` through `obsidian-cli eval`.
 */
const { Component, MarkdownRenderer, Plugin, TFile } = require("obsidian");

const POLL_MS = 100;

module.exports = class DatacoreParityPlugin extends Plugin {
    onload() {
        window.__datacoreParity = {
            render: (path, options) => this.render(path, options),
            renderMarkdown: (markdown, sourcePath, options) => this.renderMarkdown(markdown, sourcePath, options),
            mount: (path) => this.mount(path),
            html: (id) => this.mounted.get(id)?.container.innerHTML,
            unmount: (id) => this.unmount(id),
        };
        this.register(() => {
            for (const id of Array.from(this.mounted.keys())) this.unmount(id);
        });
        this.register(() => delete window.__datacoreParity);
    }

    /** Live off-screen renders (for lifecycle checks): id → { host, container, component }. */
    mounted = new Map();
    nextId = 1;

    /** Render a note off-screen and keep it alive until `unmount`, so it reacts to later changes. */
    async mount(path) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) throw new Error(`No such note: ${path}`);
        const { host, container } = this.createHost();
        const component = new Component();
        component.load();
        await MarkdownRenderer.render(this.app, await this.app.vault.cachedRead(file), container, path, component);
        const id = this.nextId++;
        this.mounted.set(id, { host, container, component });
        return id;
    }

    unmount(id) {
        const mounted = this.mounted.get(id);
        if (!mounted) return false;
        mounted.component.unload();
        mounted.host.remove();
        this.mounted.delete(id);
        return true;
    }

    /** An invisible, off-screen container that never takes focus. */
    createHost() {
        const host = activeDocument.body.createDiv({ cls: "datacore-parity-host" });
        host.setAttribute("aria-hidden", "true");
        Object.assign(host.style, {
            position: "fixed",
            left: "-100000px",
            top: "0",
            width: "900px",
            visibility: "hidden",
            pointerEvents: "none",
        });
        return { host, container: host.createDiv({ cls: "markdown-preview-view markdown-rendered" }) };
    }

    async render(path, options) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) throw new Error(`No such note: ${path}`);
        return this.renderMarkdown(await this.app.vault.cachedRead(file), path, options);
    }

    /** Render arbitrary markdown as if it were the note at `sourcePath` (useful for ad-hoc probes). */
    async renderMarkdown(markdown, sourcePath, { settleMs = 1000, timeoutMs = 20000 } = {}) {
        const { host, container } = this.createHost();
        const component = new Component();
        component.load();

        try {
            await MarkdownRenderer.render(this.app, markdown, container, sourcePath, component);

            const started = Date.now();
            let last = container.innerHTML;
            let stableSince = Date.now();
            while (Date.now() - started < timeoutMs) {
                await new Promise((resolve) => window.setTimeout(resolve, POLL_MS));
                const current = container.innerHTML;
                if (current !== last) {
                    last = current;
                    stableSince = Date.now();
                } else if (
                    Date.now() - stableSince >= settleMs &&
                    !container.querySelector(".datacore-loading-boundary")
                ) {
                    return { html: current, settled: true };
                }
            }
            return { html: last, settled: false };
        } finally {
            component.unload();
            host.remove();
        }
    }
};
