/** Image embeds: detecting them and reading their `WxH` display size. */
import type { Link } from "@yankeeinlondon/datacore-contract";

export const IMAGE_EXTENSIONS = Object.freeze(
    new Set([
        ".tif",
        ".tiff",
        ".gif",
        ".png",
        ".apng",
        ".avif",
        ".jpg",
        ".jpeg",
        ".jfif",
        ".pjepg",
        ".pjp",
        ".svg",
        ".webp",
        ".bmp",
        ".ico",
        ".cur",
    ])
);

/** Determines if the given link points to an embedded image. */
export function isImageEmbed(link: Link): boolean {
    if (!link.path.includes(".")) return false;

    const extension = link.path.substring(link.path.lastIndexOf("."));
    return link.type == "file" && link.embed && IMAGE_EXTENSIONS.has(extension);
}

/** Extract text of the form 'WxH' or 'W' from the display of a link. */
export function extractImageDimensions(link: Link): [number, number] | [number] | undefined {
    if (!link.display) return undefined;

    const both = /^(\d+)x(\d+)$/iu.exec(link.display);
    if (both?.[1] && both[2]) return [parseInt(both[1]), parseInt(both[2])];

    const width = /^(\d+)/.exec(link.display);
    if (width?.[1]) return [parseInt(width[1])];

    // No match.
    return undefined;
}
