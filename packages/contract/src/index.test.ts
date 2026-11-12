import { describe, expect, expectTypeOf, it } from "vitest";
import {
    CAPABILITIES,
    type Capability,
    type DatacoreApi,
    ENGINE_PLUGIN_ID,
    ENGINE_REGISTRY_KEY,
    ERROR_CODES,
    type DatacoreErrorCode,
    INDEX_TYPES,
    type Indexable,
    type Literal,
    type MarkdownPage,
    type MarkdownTaskItem,
    type Result,
    type ScopedDatacore,
} from "./index";

describe("protocol constants", () => {
    it("exposes the registry key and engine plugin id as literal types", () => {
        expect(ENGINE_REGISTRY_KEY).toBe("datacore-engine.registry");
        expectTypeOf(ENGINE_REGISTRY_KEY).toEqualTypeOf<"datacore-engine.registry">();
        expect(ENGINE_PLUGIN_ID).toBe("datacore-engine");
        expectTypeOf(ENGINE_PLUGIN_ID).toEqualTypeOf<"datacore-engine">();
    });

    it("names the engine's index types", () => {
        expect(INDEX_TYPES.page).toBe("page");
        expect(INDEX_TYPES.task).toBe("task");
        expect(INDEX_TYPES.linkbearing).toBe("links");
    });

    it("derives capability and error-code unions from their constants", () => {
        expectTypeOf<Capability>().toEqualTypeOf<"query" | "subscribe" | "write" | "functions">();
        expectTypeOf(ERROR_CODES.revoked).toEqualTypeOf<"revoked">();
        expectTypeOf<"timeout">().toExtend<DatacoreErrorCode>();
        expect(Object.values(CAPABILITIES)).toContain("subscribe");
    });
});

describe("data shapes", () => {
    it("narrows Result by its discriminant", () => {
        const handle = (result: Result<number, string>) =>
            result.successful ? (result.value satisfies number) : (result.error satisfies string);
        expectTypeOf(handle).returns.toEqualTypeOf<number | string>();
    });

    it("models tasks as list items with a status", () => {
        expectTypeOf<MarkdownTaskItem>().toHaveProperty("$completed").toEqualTypeOf<boolean>();
        expectTypeOf<MarkdownTaskItem>().toExtend<Indexable>();
        expectTypeOf<MarkdownPage["value"]>().returns.toEqualTypeOf<Literal | undefined>();
    });

    it("keeps indexed objects read-only", () => {
        // @ts-expect-error indexed objects are immutable snapshots
        const mutate = (page: MarkdownPage) => (page.$tags = []);
        expect(mutate).toBeTypeOf("function");
    });
});

describe("API surface", () => {
    it("extends the engine API with consumer scoping", () => {
        expectTypeOf<ScopedDatacore>().toExtend<DatacoreApi>();
        expectTypeOf<DatacoreApi["query"]>().returns.toEqualTypeOf<Indexable[]>();
        expectTypeOf<DatacoreApi["settings"]["display"]["pageSize"]>().toEqualTypeOf<number>();
    });
});
