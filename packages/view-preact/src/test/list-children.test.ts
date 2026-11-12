import { afterEach, describe, expect, it } from "vitest";
import type { DisplaySettings } from "@yankeeinlondon/datacore-contract";
import { h, render } from "preact";
import { ListView, type ListViewProps } from "../api/ui/views/list";
import { SETTINGS_CONTEXT } from "../ui/markdown";

/** The parts of an indexed list item or task the list view reads. */
interface FakeItem {
    $id: string;
    $types: string[];
    $text: string;
    $elements: FakeItem[];
}

function item(text: string, elements: FakeItem[] = [], task = false): FakeItem {
    const types = task ? ["list-item", "task"] : ["list-item"];
    return { $id: text, $types: types, $text: text, $elements: elements };
}

let container: HTMLElement | undefined;
afterEach(() => {
    if (container) render(null, container);
    container = undefined;
});

/** Render a list of items, showing each item's text, and return the container. */
function renderList(props: Omit<ListViewProps<FakeItem>, "renderer">): HTMLElement {
    const settings = { pageSize: 50 } as DisplaySettings;
    container = document.createElement("div");
    const renderer = (row: FakeItem) => h("span", { class: "text" }, row.$text);
    render(h(SETTINGS_CONTEXT.Provider, { value: settings }, h(ListView<FakeItem>, { ...props, renderer })), container);
    return container;
}

/** The text of each nested `li` under the given list, as a tree of `[text, children]`. */
function tree(list: Element | null): unknown[] {
    if (!list) return [];
    return Array.from(list.children).map((li) => {
        const text = li.querySelector(":scope > span.text")?.textContent;
        const children = tree(li.querySelector(":scope > ul, :scope > ol"));
        return children.length > 0 ? [text, children] : text;
    });
}

const rows = [
    item("Read chapter one", [], true),
    item("Write notes", [item("Child note", [item("Grandchild note")])], true),
];

describe("ListView children", () => {
    it("nests the child items of list items and tasks by default", () => {
        const list = renderList({ rows }).querySelector("ul.datacore-list-unordered");

        expect(tree(list)).toEqual(["Read chapter one", ["Write notes", [["Child note", ["Grandchild note"]]]]]);
    });

    it("stops at maxChildDepth", () => {
        const list = renderList({ rows, maxChildDepth: 1 }).querySelector("ul.datacore-list-unordered");

        expect(tree(list)).toEqual(["Read chapter one", ["Write notes", ["Child note"]]]);
    });

    it("shows no children with maxChildDepth 0 or childSource null", () => {
        for (const props of [{ maxChildDepth: 0 }, { childSource: null }]) {
            const list = renderList({ rows, ...props }).querySelector("ul.datacore-list-unordered");
            expect(tree(list)).toEqual(["Read chapter one", "Write notes"]);
        }
    });

    it("nests block list children too", () => {
        const block = renderList({ rows, type: "block" });

        expect(
            Array.from(block.querySelectorAll(".datacore-block-list-item > span.text")).map((el) => el.textContent)
        ).toEqual(["Read chapter one", "Write notes", "Child note", "Grandchild note"]);
    });

    it("still reads children and $children of other values", () => {
        const plain = [{ name: "parent", children: [{ name: "child" }], $children: [{ name: "other" }] }];
        container = document.createElement("div");
        const settings = { pageSize: 50 } as DisplaySettings;
        render(
            h(
                SETTINGS_CONTEXT.Provider,
                { value: settings },
                h(ListView<{ name: string }>, {
                    rows: plain,
                    renderer: (row: { name: string }) => h("span", { class: "text" }, row.name),
                })
            ),
            container
        );

        expect(tree(container.querySelector("ul.datacore-list-unordered"))).toEqual([["parent", ["other", "child"]]]);
    });
});
