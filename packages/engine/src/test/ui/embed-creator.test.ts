import { describe, expect, it } from "vitest";
import { TFile, type EmbedContext, type FileEmbed } from "obsidian";
import { createEmbed } from "api/ui/embed";

const context = { linktext: "Note", sourcePath: "", showInline: false, depth: 0, displayMode: true } as EmbedContext;
const file = new TFile();

describe("createEmbed", () => {
    it("calls a factory-style creator (Obsidian 1.15+) without new", () => {
        const made = { kind: "factory" } as unknown as FileEmbed;
        const calls: unknown[][] = [];
        const factory = (...args: unknown[]) => {
            calls.push(args);
            return made;
        };

        expect(createEmbed(factory, context, file, "#Review")).toBe(made);
        expect(calls).toEqual([[context, file, "#Review"]]);
    });

    it("constructs a class-style creator (older Obsidian) with new", () => {
        class LegacyEmbed {
            constructor(
                readonly context: EmbedContext,
                readonly file: TFile,
                readonly subpath?: string
            ) {}
        }

        const embed = createEmbed(
            LegacyEmbed as unknown as new () => FileEmbed,
            context,
            file
        ) as unknown as LegacyEmbed;
        expect(embed).toBeInstanceOf(LegacyEmbed);
        expect(embed.file).toBe(file);
        expect(embed.subpath).toBeUndefined();
    });
});
