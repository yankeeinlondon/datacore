import { describe, it, expect } from "vitest";
import { isHostModule } from "../ui/scripting";

describe("isHostModule", () => {
    it.each(["obsidian", "electron", "@codemirror/state", "@codemirror/view", "@lezer/common"])(
        "treats host module '%s' as host-provided",
        (specifier) => expect(isHostModule(specifier)).toBe(true)
    );

    it.each(["fs", "path", "events", "crypto", "node:fs", "node:path"])(
        "treats Node built-in '%s' as host-provided",
        (specifier) => expect(isHostModule(specifier)).toBe(true)
    );

    // These were misrouted by the upstream extension-regex approach (blacksmithgu/datacore#181).
    it.each([
        "scripts/lists.md#ListItem",
        "Scripts/Comp.md",
        "scripts/util.js",
        "scripts/View.TSX",
        "lib.JS",
        "components/events",
        "my-obsidian-helpers.js",
    ])("treats vault script path '%s' as a vault script", (specifier) => expect(isHostModule(specifier)).toBe(false));
});
