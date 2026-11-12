import { type App, MarkdownView, type WorkspaceLeaf } from "obsidian";

/** Escapes a string for use inside a regular expression. */
function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whether `text` has a fenced code block (possibly quoted or indented) in one of `languages`. */
export function hasCodeBlockIn(text: string, languages: readonly string[]): boolean {
    if (languages.length === 0) return false;
    const names = languages.map(escapeRegExp).join("|");
    return new RegExp(`^[ \\t>]*(?:\`{3,}|~{3,})[ \\t]*(?:${names})(?:[ \\t]|$)`, "m").test(text);
}

/**
 * Rebuilds the open markdown views that contain code blocks in `languages`, keeping their scroll and cursor.
 *
 * Needed when the plugin loads after the workspace layout (enabled or reloaded while notes are open): an editor
 * resolves a fence's highlighting mode when it parses the note and keeps the result, so blocks parsed before the
 * `dc*` modes existed stay unhighlighted, and reading views keep showing them as plain code, until the note is
 * reopened. At startup the plugin loads before the layout, so nothing needs rebuilding.
 *
 * Uses the private `WorkspaceLeaf.rebuildView` (Obsidian 1.15: re-opens the leaf's view state and ephemeral state);
 * if it is missing, the views are left as they are.
 */
export async function rebuildViewsWithCodeBlocks(app: App, languages: readonly string[]): Promise<void> {
    const leaves: WorkspaceLeaf[] = [];
    app.workspace.iterateAllLeaves((leaf) => {
        // Deferred (not yet shown) leaves are not MarkdownViews yet; they will parse with the modes in place.
        if (leaf.view instanceof MarkdownView && hasCodeBlockIn(leaf.view.getViewData(), languages)) leaves.push(leaf);
    });

    for (const leaf of leaves) {
        const rebuild = (leaf as unknown as { rebuildView?: () => Promise<void> }).rebuildView;
        if (typeof rebuild !== "function") return;
        try {
            await rebuild.call(leaf);
        } catch (error) {
            console.warn("Datacore View: Preact: could not refresh an open note after loading.", error);
        }
    }
}
