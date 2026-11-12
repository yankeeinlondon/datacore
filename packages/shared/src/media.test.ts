import { describe, expect, it } from "vitest";
import type { Link } from "@yankeeinlondon/datacore-contract";
import { extractImageDimensions, isImageEmbed } from "./media";

const link = (path: string, embed: boolean, display?: string): Link =>
    ({ path, embed, display, type: "file" }) as unknown as Link;

describe("image embeds", () => {
    it("recognizes embedded image files", () => {
        expect(isImageEmbed(link("img/cat.png", true))).toBe(true);
        expect(isImageEmbed(link("img/cat.png", false))).toBe(false);
        expect(isImageEmbed(link("notes/cat.md", true))).toBe(false);
        expect(isImageEmbed(link("noextension", true))).toBe(false);
    });

    it("reads WxH or W from the display text", () => {
        expect(extractImageDimensions(link("a.png", true, "300x200"))).toEqual([300, 200]);
        expect(extractImageDimensions(link("a.png", true, "300"))).toEqual([300]);
        expect(extractImageDimensions(link("a.png", true, "caption"))).toBeUndefined();
        expect(extractImageDimensions(link("a.png", true))).toBeUndefined();
    });
});
