import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    clearOperatorTrustConfig,
    getCoordinationUrlSource,
    resolveCoordinationBaseUrl,
    writeOperatorCoordinationUrlOverride,
} from "./operator-trust-config";

describe("operator-trust-config", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubEnv("NEXT_PUBLIC_COORDINATION_URL", "http://env-coord:8787");
        clearOperatorTrustConfig();
    });

    it("prefers runtime override over build env", () => {
        writeOperatorCoordinationUrlOverride("http://127.0.0.1:8787/");
        expect(resolveCoordinationBaseUrl()).toBe("http://127.0.0.1:8787");
        expect(getCoordinationUrlSource()).toBe("runtime_override");
    });

    it("falls back to build env when no override", () => {
        expect(resolveCoordinationBaseUrl()).toBe("http://env-coord:8787");
        expect(getCoordinationUrlSource()).toBe("build_env");
    });
});
