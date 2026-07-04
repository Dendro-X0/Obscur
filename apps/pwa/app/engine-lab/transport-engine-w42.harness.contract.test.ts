import { beforeEach, describe, expect, it, vi } from "vitest";
import { isTransportPublishRelayEventResult } from "@obscur/engine-contracts";
import {
  publishRelayEventViaTransportEngineHost,
  resetTransportEngineHostForTests,
} from "@/app/features/transport-kernel/transport-engine-host-port";

const mockInvoke = vi.hoisted(() => vi.fn());

vi.mock("@obscur/engine-host", () => ({
  isTauriEngineHostAvailable: () => true,
  createTauriEngineHost: () => ({
    invoke: mockInvoke,
    getSnapshot: async () => ({
      engine: "transport",
      scope: { profileId: "default" },
      phase: "offline" as const,
      revision: 0,
    }),
    subscribe: () => () => {},
  }),
}));

describe("transport-engine w42 — network lab gate harness (historical)", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    resetTransportEngineHostForTests();
  });

  it("accepts structured network publish results from host invoke", async () => {
    mockInvoke.mockResolvedValue({
      ok: true,
      data: {
        success: false,
        successCount: 0,
        totalRelays: 1,
        quorumRequired: 1,
        metQuorum: false,
        results: [{ relayUrl: "wss://relay.one", success: false, error: "No writable relay connection" }],
        failures: [{ relayUrl: "wss://relay.one", success: false, error: "No writable relay connection" }],
        overallError: "Quorum not met (0/1).",
      },
    });

    const result = await publishRelayEventViaTransportEngineHost({
      profileId: "default",
      payload: {
        relayUrls: ["wss://relay.one"],
        payload: "[\"EVENT\",{\"id\":\"e1\"}]",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected structured network publish result.");
    }
    expect(isTransportPublishRelayEventResult(result.data)).toBe(true);
  });
});
