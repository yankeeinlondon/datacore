import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { Link } from "expression/literal";
import { YamlConversion } from "index/types/yaml";

describe("YamlConversion.yaml", () => {
    // Upstream converted its own `literal` function instead of the argument, so every value became null.
    it("converts the given value", () => {
        expect(YamlConversion.yaml("text")).toBe("text");
        expect(YamlConversion.yaml(3)).toBe(3);
        expect(YamlConversion.yaml(true)).toBe(true);
        expect(YamlConversion.yaml(null)).toBeNull();
        expect(YamlConversion.yaml([1, "a"])).toEqual([1, "a"]);
        expect(YamlConversion.yaml({ a: 1, b: [2] })).toEqual({ a: 1, b: [2] });
        expect(YamlConversion.yaml(Link.file("Books/Dune.md"))).toBe("[[Books/Dune.md|Dune]]");
        expect(YamlConversion.yaml(DateTime.fromISO("2026-11-12T00:00:00Z", { zone: "utc" }))).toBe(
            "2026-11-12T00:00:00.000Z"
        );
    });
});
