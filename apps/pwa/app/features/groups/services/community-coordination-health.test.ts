import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCoordinationHealthCache, probeCoordinationHealth } from "./community-coordination-health";

describe("probeCoordinationHealth", () => {
    beforeEach(() => {
        clearCoordinationHealthCache();
        vi.stubEnv("NEXT_PUBLIC_COORDINATION_URL", "http://127.0.0.1:8787");
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        clearCoordinationHealthCache();
    });

    it("returns unhealthy when fetch fails", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => {
            throw new Error("connection refused");
        }));
        const snapshot = await probeCoordinationHealth({ force: true });
        expect(snapshot.configured).toBe(true);
        expect(snapshot.healthy).toBe(false);
        expect(snapshot.errorMessage).toMatch(/connection refused|coordination_unreachable/);
    });

    it("returns healthy when health endpoint reports ok", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => ({
            ok: true,
            json: async () => ({ ok: true, environment: "dev" }),
        })));
        const snapshot = await probeCoordinationHealth({ force: true });
        expect(snapshot.healthy).toBe(true);
    });
});
