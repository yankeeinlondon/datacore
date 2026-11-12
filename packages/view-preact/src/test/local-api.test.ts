import { describe, expect, expectTypeOf, it } from "vitest";
import type { DatacoreApi, DatacoreLocalQueryApi } from "@yankeeinlondon/datacore-contract";
import { PreactViewApi } from "../api/api";
import type { ViewServices } from "../ui/services";

const SCRIPT_PATH = "Scripts/View.md";

/** Every member of the contract's path-scoped API (`engine.local(path)`); the type test keeps the list complete. */
const CONTRACT_MEMBERS = [
    "path",
    "currentPath",
    "currentFile",
    "page",
    "query",
    "tryQuery",
    "fullquery",
    "tryFullQuery",
    "parseQuery",
    "tryParseQuery",
    "evaluate",
    "tryEvaluate",
    "resolveLink",
    "resolvePath",
    "fileLink",
    "headerLink",
    "blockLink",
    "parseLink",
    "tryParseLink",
    "inferLink",
    "luxon",
    "coerce",
    "array",
] as const;

/** The members that are plain values rather than methods. */
const VALUE_MEMBERS = new Set<string>(["path", "luxon", "coerce"]);

/**
 * An engine whose path-scoped API records every call and answers `<member>-result`, except `page`, which looks the path
 * up in `pages`.
 */
function fakeEngine(pages: Record<string, unknown> = {}) {
    const calls: [string, unknown[]][] = [];
    const scopedPaths: string[] = [];
    const luxon = { name: "luxon" };
    const coerce = { name: "coerce" };
    const local = new Proxy(
        {},
        {
            get(_target, member) {
                if (member === "path") return SCRIPT_PATH;
                if (member === "luxon") return luxon;
                if (member === "coerce") return coerce;
                return (...args: unknown[]) => {
                    calls.push([String(member), args]);
                    if (member === "page") {
                        const target = args[0];
                        return pages[typeof target === "string" ? target : (target as { path: string }).path];
                    }
                    return `${String(member)}-result`;
                };
            },
        }
    );
    const engine = {
        luxon,
        coerce,
        local(path: string) {
            scopedPaths.push(path);
            return local;
        },
    } as unknown as DatacoreApi;

    const services = { engine, app: { vault: {} } } as unknown as ViewServices;
    const dc = new PreactViewApi(services).local(SCRIPT_PATH);
    return { dc, calls, scopedPaths, luxon, coerce };
}

describe("script dc: contract members", () => {
    it("lists every member of DatacoreLocalQueryApi", () => {
        expectTypeOf<(typeof CONTRACT_MEMBERS)[number]>().toEqualTypeOf<keyof DatacoreLocalQueryApi>();
    });

    it("scopes the engine API to the script's file", () => {
        const { scopedPaths } = fakeEngine();
        expect(scopedPaths).toEqual([SCRIPT_PATH]);
    });

    it.each(CONTRACT_MEMBERS)("has %s", (member) => {
        const { dc } = fakeEngine();
        const expectedType = member === "path" ? "string" : VALUE_MEMBERS.has(member) ? "object" : "function";
        expect(typeof dc[member]).toBe(expectedType);
    });

    it("exposes the script path and the engine's luxon and coerce", () => {
        const { dc, luxon, coerce } = fakeEngine();
        expect(dc.path).toBe(SCRIPT_PATH);
        expect(dc.currentPath()).toBe(SCRIPT_PATH);
        expect(dc.luxon).toBe(luxon);
        expect(dc.coerce).toBe(coerce);
    });

    it.each(
        CONTRACT_MEMBERS.filter((member) => !VALUE_MEMBERS.has(member) && member !== "currentPath" && member !== "page")
    )("forwards %s to the path-scoped engine API", (member) => {
        const { dc, calls } = fakeEngine();
        const args = ["first", "second"];
        const method = dc[member] as (...args: unknown[]) => unknown;

        const result = method.apply(dc, args);

        expect(result).toBe(`${member}-result`);
        expect(calls).toHaveLength(1);
        const [calledMember, calledArgs] = calls[0]!;
        expect(calledMember).toBe(member);
        // Methods without parameters (currentFile) pass nothing; the rest pass their arguments through.
        expect(calledArgs.slice(0, 1)).toEqual(member === "currentFile" ? [] : ["first"]);
    });
});

describe("script dc.page", () => {
    const page = { $id: "Parity/Data/Parity Book 03.md", $types: ["page"] };

    it("returns the page at a path", () => {
        const { dc } = fakeEngine({ [page.$id]: page });
        expect(dc.page(page.$id)).toBe(page);
    });

    it("returns the page a link points to", () => {
        const { dc } = fakeEngine({ [page.$id]: page });
        expect(dc.page({ path: page.$id } as Parameters<typeof dc.page>[0])).toBe(page);
    });

    it("returns undefined for a missing page", () => {
        const { dc } = fakeEngine();
        expect(dc.page("Missing.md")).toBeUndefined();
    });
});
