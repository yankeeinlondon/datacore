/**
 * @module api
 */
import { App, Component, type MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import { DatacoreJSRenderer } from "../ui/javascript";
import { DatacoreLocalApi } from "./local-api";
import type { ViewServices } from "../ui/services";
import * as preact from "preact";

/**
 * The views' entry point: renders datacore code blocks and creates the script-facing `dc` API. It reaches the engine
 * only through the contract API in its services (Engine Room spec D9).
 * @public
 */
export class PreactViewApi {
    public constructor(public readonly services: ViewServices) {}

    /** Get access to preact functions. */
    get preact(): typeof preact {
        return preact;
    }

    /** Central Obsidian app object. */
    get app(): App {
        return this.services.app;
    }

    ///////////////
    // Local API //
    ///////////////

    /** Construct a local API for the file at the given path. */
    public local(path: string): DatacoreLocalApi {
        return new DatacoreLocalApi(this, path);
    }

    /////////////////////
    // Visual Elements //
    /////////////////////

    /**
     * Run the given DatacoreJS script, rendering it into the given container. This function
     * will return quickly; actual rendering is done asynchronously in the background.
     *
     * Returns a markdown render child representing the rendered object.
     */
    public executeJs(
        source: string,
        container: HTMLElement,
        component: Component | MarkdownPostProcessorContext,
        sourcePath: string
    ): MarkdownRenderChild {
        return this.renderScript(source, container, component, sourcePath, "js");
    }

    /**
     * Similar to `executeJs`, but for JSX scripts. If you are unsure if your input will be JS
     * or JSX, use this one, as it also supports regular javascript (albeit at at a mild performance
     * hit to rendering).
     */
    public executeJsx(
        source: string,
        container: HTMLElement,
        component: Component | MarkdownPostProcessorContext,
        sourcePath: string
    ): MarkdownRenderChild {
        return this.renderScript(source, container, component, sourcePath, "jsx");
    }

    /**
     * Similar to `executeJs`, but for TypeScript scripts. Use the TSX variant for TSX supprot.
     */
    public executeTs(
        source: string,
        container: HTMLElement,
        component: Component | MarkdownPostProcessorContext,
        sourcePath: string
    ): MarkdownRenderChild {
        return this.renderScript(source, container, component, sourcePath, "ts");
    }

    /**
     * Similar to `executeTs`, but for TSX scripts. If you are unsure if your input will be TS
     * or TSX, use this one, as it also supports regular javascript (albeit at at a mild performance
     * hit to rendering).
     *
     * This generally will also work if you are unsure if your input is javascript or typescript,
     * though beware there are a few niche cases where javascript and typescript diverge in syntax.
     */
    public executeTsx(
        source: string,
        container: HTMLElement,
        component: Component | MarkdownPostProcessorContext,
        sourcePath: string
    ): MarkdownRenderChild {
        return this.renderScript(source, container, component, sourcePath, "tsx");
    }

    /** Render a JS/TS/JSX/TSX script into the container, as a child of the given component. */
    public renderScript(
        source: string,
        container: HTMLElement,
        component: Component | MarkdownPostProcessorContext,
        sourcePath: string,
        language: "js" | "ts" | "jsx" | "tsx"
    ): DatacoreJSRenderer {
        let local = new DatacoreLocalApi(this, sourcePath);
        const renderer = new DatacoreJSRenderer(local, container, sourcePath, source, language);
        component.addChild(renderer);

        return renderer;
    }
}
