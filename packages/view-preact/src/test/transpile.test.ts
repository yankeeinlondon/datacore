import { describe, it, expect } from "vitest";
import { transpile } from "../ui/scripting";

describe("transpile", () => {
    it.each(["jsx", "tsx"] as const)("compiles %s without development-only props", (language) => {
        const code = transpile('return <div class="x"><span>{1}</span><></></div>;', language);

        expect(code).toContain("h(");
        expect(code).toContain("Fragment");
        expect(code).not.toContain("__self");
        expect(code).not.toContain("__source");
        expect(code).not.toContain("_jsxFileName");
    });

    it("leaves plain javascript untouched", () => {
        const script = "return 1 + 1;";
        expect(transpile(script, "js")).toBe(script);
    });
});
