import { describe, expect, it } from "vitest";
import type { DisplaySettings } from "@yankeeinlondon/datacore-contract";
import { h, render } from "preact";
import { Lit, SETTINGS_CONTEXT } from "../ui/markdown";

/** Render `Lit` for a value with the given null placeholder, and return the container. */
function renderLit(value: null | undefined, nullAs: string, inline: boolean): HTMLElement {
    const settings = { nullAs, maxRecursiveRenderDepth: 4 } as DisplaySettings;
    const container = document.createElement("div");
    render(h(SETTINGS_CONTEXT.Provider, { value: settings }, h(Lit, { value, inline })), container);
    return container;
}

describe("Lit null placeholder", () => {
    it.each([
        ["-", true],
        ["-", false],
        ["*", false],
        ["# none", false],
        ["", false],
    ])("renders nullAs %j as plain text (inline: %s)", (nullAs, inline) => {
        const container = renderLit(null, nullAs, inline);

        expect(container.textContent).toBe(nullAs);
        expect(container.querySelector("ul, li, h1")).toBeNull();
    });

    it("treats undefined like null", () => {
        expect(renderLit(undefined, "-", false).textContent).toBe("-");
    });
});
