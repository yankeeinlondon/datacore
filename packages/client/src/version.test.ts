import { describe, expect, it } from "vitest";
import { parseVersion, satisfiesApi } from "./version";

describe("API version negotiation", () => {
    it("parses partial and prerelease versions", () => {
        expect(parseVersion("1")).toEqual({ major: 1, minor: 0, patch: 0 });
        expect(parseVersion("1.2.3-beta.1")).toEqual({ major: 1, minor: 2, patch: 3 });
        expect(parseVersion("not a version")).toBeUndefined();
    });

    it("uses caret semantics for 1.x and later", () => {
        expect(satisfiesApi("1.4.0", "1.2")).toBe(true);
        expect(satisfiesApi("1.1.9", "1.2")).toBe(false);
        expect(satisfiesApi("2.0.0", "1.2")).toBe(false);
    });

    it("treats every 0.x minor as breaking", () => {
        expect(satisfiesApi("0.3.5", "0.3.0")).toBe(true);
        expect(satisfiesApi("0.4.0", "0.3.0")).toBe(false);
        expect(satisfiesApi("0.0.2", "0.0.1")).toBe(false);
    });
});
