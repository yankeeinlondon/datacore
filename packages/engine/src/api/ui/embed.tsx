/**
 * @module ui
 */

import { useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "preact/hooks";
import {
    APP_CONTEXT,
    COMPONENT_CONTEXT,
    CURRENT_FILE_CONTEXT,
    READER_CONTEXT,
    ErrorMessage,
    Markdown,
} from "../../ui/markdown";
import type { Link } from "@yankeeinlondon/datacore-contract";
import { getFileTitle, lineRange } from "@yankeeinlondon/datacore-shared";
import type { EmbedContext, EmbedCreator, FileEmbed, TFile } from "obsidian";

import "./embed.css";

/** Renders an embed in the canonical Obsidian style.
 *
 * @group Components
 */
export function Embed({
    link,
    inline,
    sourcePath: maybeSourcePath,
}: {
    /** The link that is being embedded. */
    link: Link;
    /** Whether the embed should be shown inline with less padding. */
    inline: boolean;
    /** The path which the link will be resolved relative to. */
    sourcePath?: string;
}) {
    const app = useContext(APP_CONTEXT);
    const component = useContext(COMPONENT_CONTEXT);
    const currentFile = useContext(CURRENT_FILE_CONTEXT);
    const sourcePath = maybeSourcePath ?? currentFile ?? "";

    const container = useRef<HTMLDivElement | null>(null);
    const linkedFile = useMemo(
        () => app.metadataCache.getFirstLinkpathDest(link.path, sourcePath),
        [link.path, sourcePath]
    );

    useEffect(() => {
        if (!container.current) return;
        if (!linkedFile) return;

        container.current.replaceChildren();

        const embedComponent = createEmbed(
            app.embedRegistry.getEmbedCreator(linkedFile),
            {
                linktext: link.path,
                sourcePath: sourcePath,
                showInline: inline,
                app,
                depth: 0,
                containerEl: container.current,
                displayMode: true,
            },
            linkedFile,
            link.subpath
        );

        component.addChild(embedComponent);
        embedComponent.loadFile(linkedFile);

        return () => component.removeChild(embedComponent);
    }, [container.current, linkedFile, link.subpath]);

    if (!linkedFile) {
        return <ErrorMessage message={`Could not find a page at linked location: ${link.path}`} />;
    } else {
        return <div className="dc-embed" ref={container}></div>;
    }
}

/**
 * An embed of an arbitrary span of lines in a Markdown file. Operates by asynchronously loading the file and pulling
 * out the given [start, end) line span.
 *
 * Note that it's possible for the file on disk to be different than it was when you first loaded the [start, end) line span
 * - generally, datacore will asynchronously reload these files in the background and fix it's index, but you may have some
 * strange artifacts otherwise.
 *
 * @group Components
 */
export function LineSpanEmbed({
    path,
    start,
    end,
    explain,
    showExplain = true,
}: {
    path: string;
    start: number;
    end: number;
    explain?: string;
    showExplain?: boolean;
}) {
    const content = useLineSpan(path, start, end);
    const explainer = explain ?? `${getFileTitle(path)} (${start} - ${end})`;

    // To allow for the explainer to be clicked on to navigate to the given position.
    const workspace = useContext(APP_CONTEXT)?.workspace;
    const onExplainClick = useCallback(
        (event: MouseEvent) => {
            void workspace?.openLinkText(path, path, event.shiftKey);
        },
        [path]
    );

    switch (content.type) {
        case "loading":
            return <ErrorMessage message={`Reading ${path} (${start} - ${end})`} />;
        case "file-not-found":
            return <ErrorMessage message={`Could not find a file at path: ${content.path}`} />;
        case "error":
            return <ErrorMessage message={content.message} />;
        case "loaded":
            return (
                <div className="datacore-span-embed">
                    {showExplain && (
                        <a className="datacore-embed-source" onClick={onExplainClick}>
                            {explainer}
                        </a>
                    )}
                    <Markdown content={content.content} inline={false} />
                </div>
            );
    }
}

/** State tracking for loading a line span asynchronously. */
export type LineSpanContent =
    | { type: "loading" }
    | { type: "file-not-found"; path: string }
    | { type: "error"; message: string }
    | { type: "loaded"; content: string };

/** Utility hook which loads path[start..end) as long as the target file exists.
 *
 * @group Hooks
 */
export function useLineSpan(path: string, start: number, end: number): LineSpanContent {
    const app = useContext(APP_CONTEXT);
    const reader = useContext(READER_CONTEXT);

    const [state, update] = useReducer<LineSpanContent, LineSpanContent>(
        (state, event) => {
            // Ignore an error update that would override a valid current state; otherwise, update to the new state.
            if (state.type == "loaded" && event.type !== "loaded") return state;
            else return event;
        },
        { type: "loading" }
    );

    useEffect(() => {
        // Resolve the current path to see if it points to a valid file.
        const file = app.vault.getFileByPath(path);
        if (file == null) {
            update({ type: "file-not-found", path: path });
            return;
        }

        // Try to load the file asynchronously.
        void (async () => {
            try {
                const content = await reader.read(file);
                update({ type: "loaded", content: lineRange(content, start, end) });
            } catch (error) {
                update({ type: "error", message: error instanceof Error ? error.message : String(error) });
            }
        })();
    }, [path, start, end]);

    return state;
}

/**
 * Instantiate an embed from Obsidian's (private) embed creator, which is a class in older versions and an arrow-function
 * factory in Obsidian 1.15+ (calling `new` on it throws "creator is not a constructor"). Arrow functions have no
 * `prototype`; classes do.
 */
export function createEmbed(creator: EmbedCreator, context: EmbedContext, file: TFile, subpath?: string): FileEmbed {
    if (creator.prototype === undefined) {
        return (creator as (context: EmbedContext, file: TFile, subpath?: string) => FileEmbed)(context, file, subpath);
    }
    return new (creator as new (context: EmbedContext, file: TFile, subpath?: string) => FileEmbed)(
        context,
        file,
        subpath
    );
}
