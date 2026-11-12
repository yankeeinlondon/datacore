import { describe, expect, it } from "vitest";
import * as contract from "@yankeeinlondon/datacore-contract";
import * as client from "./index";

describe("client", () => {
    it("re-exports the contract", () => {
        expect(client.ENGINE_REGISTRY_KEY).toBe(contract.ENGINE_REGISTRY_KEY);
        expect(client.ENGINE_PLUGIN_ID).toBe(contract.ENGINE_PLUGIN_ID);
    });
});
