import { describe, expect, expectTypeOf, it } from "vitest";
import { ENGINE_PLUGIN_ID, ENGINE_REGISTRY_KEY } from "./index";

describe("protocol constants", () => {
    it("exposes the registry key as a literal type", () => {
        expect(ENGINE_REGISTRY_KEY).toBe("datacore-engine.registry");
        expectTypeOf(ENGINE_REGISTRY_KEY).toEqualTypeOf<"datacore-engine.registry">();
    });

    it("exposes the engine plugin id as a literal type", () => {
        expect(ENGINE_PLUGIN_ID).toBe("datacore-engine");
        expectTypeOf(ENGINE_PLUGIN_ID).toEqualTypeOf<"datacore-engine">();
    });
});
