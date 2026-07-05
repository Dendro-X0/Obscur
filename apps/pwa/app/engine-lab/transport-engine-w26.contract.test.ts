import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildTransportPublishRelayEventRequest,
  isTransportPublishRelayEventResult,
} from "@obscur/engine-contracts";
import { mapLegacyPublishResultToRelayPublishResult } from "@/app/features/relays/lib/publish-outcome-mapper";
import {
  publishRelayEventViaTransportEngineHost,
  resetTransportEngineHostForTests,
} from "@/app/features/transport-kernel/transport-engine-host-port";

const mockInvoke = vi.hoisted(() => vi.fn());

vi.mock("@obscur/engine-host/tauri", () => ({
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

const validHostResult = {
  success: true,
  successCount: 2,
  totalRelays: 2,
  quorumRequired: 1,
  metQuorum: true,
  results: [
    { relayUrl: "wss://relay.one", success: true, latency: 42 },
    { relayUrl: "wss://relay.two", success: true, latency: 55 },
  ],
  failures: [],
  correlationId: "corr-w26",
} as const;

describe("transport-engine w26 — mocked valid host-result acceptance path", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    resetTransportEngineHostForTests();
  });

  it("accepts a well-formed TransportPublishRelayEventResult through the typed host adapter", async () => {
    mockInvoke.mockResolvedValue({
      ok: true,
      data: validHostResult,
    });

    const params = {
      profileId: "default",
      windowLabel: "main",
      payload: {
        relayUrls: ["wss://relay.one", "wss://relay.two"],
        payload: "[\"EVENT\",{\"id\":\"e1\"}]",
        correlationId: "corr-w26",
      },
    };

    const result = await publishRelayEventViaTransportEngineHost(params);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected accepted host publish result.");
    }
    expect(result.data).toEqual(validHostResult);
    expect(isTransportPublishRelayEventResult(result.data)).toBe(true);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith(buildTransportPublishRelayEventRequest(params));
  });

  it("round-trips accepted host result through shared mapper parity semantics", async () => {
    mockInvoke.mockResolvedValue({
      ok: true,
      data: validHostResult,
    });

    const result = await publishRelayEventViaTransportEngineHost({
      profileId: "default",
      payload: {
        relayUrls: ["wss://relay.one", "wss://relay.two"],
        payload: "[\"EVENT\",{\"id\":\"e1\"}]",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected accepted host publish result.");
    }

    const mapped = mapLegacyPublishResultToRelayPublishResult({
      success: result.data.success,
      successCount: result.data.successCount,
      totalRelays: result.data.totalRelays,
      metQuorum: result.data.metQuorum,
      quorumRequired: result.data.quorumRequired,
      results: result.data.results,
      failures: result.data.failures,
      overallError: result.data.overallError,
    });

    expect(mapped.status).toBe("ok");
    expect(mapped.metQuorum).toBe(true);
    expect(mapped.successCount).toBe(validHostResult.successCount);
    expect(mapped.totalRelays).toBe(validHostResult.totalRelays);
    expect(mapped.failures).toEqual([]);
  });
});
