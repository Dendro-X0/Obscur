import { beforeEach, describe, expect, it, vi } from "vitest";
import { isTransportPublishRelayEventResult } from "@obscur/engine-contracts";
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

const mapHostShapeToLegacySemantics = (hostShape: {
  success: boolean;
  successCount: number;
  totalRelays: number;
  quorumRequired: number;
  metQuorum: boolean;
  results: ReadonlyArray<{ relayUrl: string; success: boolean; error?: string }>;
  failures: ReadonlyArray<{ relayUrl: string; success: boolean; error?: string }>;
  overallError?: string;
}) => mapLegacyPublishResultToRelayPublishResult({
  success: hostShape.success,
  successCount: hostShape.successCount,
  totalRelays: hostShape.totalRelays,
  metQuorum: hostShape.metQuorum,
  quorumRequired: hostShape.quorumRequired,
  results: hostShape.results,
  failures: hostShape.failures,
  overallError: hostShape.overallError,
});

describe("transport-engine w25 — publish parity reason/status + shape rejection", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    resetTransportEngineHostForTests();
  });

  it("aligns quorum_not_met reason/status parity fixture with shared mapper semantics", () => {
    const hostShape = {
      success: false,
      successCount: 0,
      totalRelays: 2,
      quorumRequired: 1,
      metQuorum: false,
      results: [
        { relayUrl: "wss://relay.one", success: false, error: "timeout" },
        { relayUrl: "wss://relay.two", success: false, error: "timeout" },
      ],
      failures: [
        { relayUrl: "wss://relay.one", success: false, error: "timeout" },
        { relayUrl: "wss://relay.two", success: false, error: "timeout" },
      ],
      overallError: "Quorum not met (0/2).",
    };

    expect(isTransportPublishRelayEventResult(hostShape)).toBe(true);
    const mapped = mapHostShapeToLegacySemantics(hostShape);
    expect(mapped.status).toBe("failed");
    expect(mapped.reasonCode).toBe("quorum_not_met");
    expect(mapped.metQuorum).toBe(false);
  });

  it("aligns relay_degraded reason/status parity fixture with shared mapper semantics", () => {
    const hostShape = {
      success: true,
      successCount: 2,
      totalRelays: 3,
      quorumRequired: 2,
      metQuorum: true,
      results: [
        { relayUrl: "wss://relay.one", success: true },
        { relayUrl: "wss://relay.two", success: true },
        { relayUrl: "wss://relay.three", success: false, error: "relay rejected" },
      ],
      failures: [
        { relayUrl: "wss://relay.three", success: false, error: "relay rejected" },
      ],
    };

    expect(isTransportPublishRelayEventResult(hostShape)).toBe(true);
    const mapped = mapHostShapeToLegacySemantics(hostShape);
    expect(mapped.status).toBe("partial");
    expect(mapped.reasonCode).toBe("relay_degraded");
    expect(mapped.metQuorum).toBe(true);
  });

  it("rejects mismatched host publish result shapes as transport_publish_invalid_result", async () => {
    mockInvoke.mockResolvedValue({
      ok: true,
      data: { success: true },
    });

    const result = await publishRelayEventViaTransportEngineHost({
      profileId: "default",
      payload: {
        relayUrls: ["wss://relay.one"],
        payload: "[\"EVENT\",{\"id\":\"e1\"}]",
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected invalid host publish result shape.");
    }
    expect(result.errorCode).toBe("transport_publish_invalid_result");
    expect(isTransportPublishRelayEventResult({ success: true })).toBe(false);
  });
});
