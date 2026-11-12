import { ErrorMessage, SimpleErrorBoundary, CURRENT_FILE_CONTEXT, DatacoreContextProvider } from "./markdown";
import { MarkdownRenderChild } from "obsidian";
import { DatacoreLocalApi } from "../api/local-api";
import { h, render, Fragment, type VNode } from "preact";
import { unmountComponentAtNode } from "preact/compat";
import { type ScriptLanguage, asyncEvalInContext, transpile } from "./scripting";
import { LoadingBoundary, ScriptContainer } from "./loading-boundary";
import type { ViewServices } from "./services";
import type { Literal } from "@yankeeinlondon/datacore-contract";
import { getParentFolder } from "@yankeeinlondon/datacore-shared";

/**
 * Renders a script by executing it and handing it the appropriate React context to execute
 * automatically.
 */
export class DatacoreJSRenderer extends MarkdownRenderChild {
    private loaded: boolean = false;

    public constructor(
        public api: DatacoreLocalApi,
        public container: HTMLElement,
        public path: string,
        public script: string,
        public language: ScriptLanguage
    ) {
        super(container);
    }

    public onload() {
        this.loaded = true;

        // Attempt to parse and evaluate the script to produce either a renderable JSX object or a function.
        try {
            const primitiveScript = transpile(this.script, this.language);
            const renderer = async () => {
                return (await asyncEvalInContext(primitiveScript, {
                    dc: this.api,
                    h: h,
                    Fragment: Fragment,
                    __filename: this.path,
                    __dirname: getParentFolder(this.path),
                })) as Promise<Literal | VNode | Function>;
            };

            this.renderScript(renderer);

            const engine = this.api.api.services.engine;

            // If the path ever changes, update the context provider and re-render.
            const renames = engine.on("rename", (newPath, oldPath) => {
                if (oldPath === this.path) {
                    this.path = this.api.path = newPath;
                    this.renderScript(renderer);
                }
            });
            this.register(() => renames.dispose());

            // Re-render with the new values when the shared display settings change.
            const displayChanges = engine.on("display-settings", () => this.renderScript(renderer));
            this.register(() => displayChanges.dispose());
        } catch (ex) {
            console.error("Datacore: failed to render the code block.", ex);
            render(
                <ErrorMessage
                    message="Datacore failed to render the code block."
                    error={ex instanceof Error ? (ex.stack ?? ex.message) : String(ex)}
                />,
                this.container
            );
        }
    }

    /** Lazily renders a script, catching errors automatically. */
    private renderScript(renderer: () => Promise<Literal | VNode | Function>) {
        render(
            <DatacoreContextProvider
                app={this.api.app}
                component={this}
                engine={this.api.api.services.engine}
                reader={this.api.api.services.reader}
                settings={this.api.api.services.engine.settings.display}
            >
                <CURRENT_FILE_CONTEXT.Provider value={this.path}>
                    <SimpleErrorBoundary message="The datacore script failed to execute.">
                        <LoadingBoundary engine={this.api.api.services.engine}>
                            <ScriptContainer executor={renderer} sourcePath={this.path} />
                        </LoadingBoundary>
                    </SimpleErrorBoundary>
                </CURRENT_FILE_CONTEXT.Provider>
            </DatacoreContextProvider>,
            this.container
        );
    }

    public onunload(): void {
        if (this.loaded) unmountComponentAtNode(this.container);
        this.loaded = false;
    }
}

/** A trivial wrapper which allows a react component to live for the duration of a `MarkdownRenderChild`. */
export class ReactRenderer extends MarkdownRenderChild {
    public constructor(
        public services: ViewServices,
        public container: HTMLElement,
        public sourcePath: string,
        public element: VNode
    ) {
        super(container);
    }

    public onload(): void {
        this.renderElement();

        // If the path ever changes, update the context provider and re-render.
        const renames = this.services.engine.on("rename", (newPath, oldPath) => {
            if (oldPath === this.sourcePath) {
                this.sourcePath = newPath;
                this.renderElement();
            }
        });
        this.register(() => renames.dispose());

        // Re-render with the new values when the shared display settings change.
        const displayChanges = this.services.engine.on("display-settings", () => this.renderElement());
        this.register(() => displayChanges.dispose());
    }

    /** Render the given element. */
    private renderElement(): void {
        render(
            <DatacoreContextProvider
                app={this.services.app}
                component={this}
                engine={this.services.engine}
                reader={this.services.reader}
                settings={this.services.engine.settings.display}
            >
                <CURRENT_FILE_CONTEXT.Provider value={this.sourcePath}>
                    <LoadingBoundary engine={this.services.engine}>{this.element}</LoadingBoundary>
                </CURRENT_FILE_CONTEXT.Provider>
            </DatacoreContextProvider>,
            this.container
        );
    }

    public onunload(): void {
        unmountComponentAtNode(this.container);
    }
}
