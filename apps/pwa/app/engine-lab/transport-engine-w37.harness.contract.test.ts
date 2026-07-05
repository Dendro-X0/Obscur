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

const dryRunHostResult = {
  success: false,
  successCount: 0,
  totalRelays: 2,
  quorumRequired: 1,
  metQuorum: false,
  results: [
    { relayUrl: "wss://relay.one", success: false, error: "transport_publish_dry_run: no network I/O" },
    { relayUrl: "wss://relay.two", success: false, error: "transport_publish_dry_run: no network I/O" },
  ],
  failures: [
    { relayUrl: "wss://relay.one", success: false, error: "transport_publish_dry_run: no network I/O" },
    { relayUrl: "wss://relay.two", success: false, error: "transport_publish_dry_run: no network I/O" },
  ],
  overallError: "Quorum not met (0/2).",
  correlationId: "corr-w37",
} as const;

describe("transport-engine w37 — dry-run assembly parity harness", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    resetTransportEngineHostForTests();
  });

  it("accepts dry-run TransportPublishRelayEventResult through typed host adapter", async () => {
    mockInvoke.mockResolvedValue({ ok: true, data: dryRunHostResult });

    const result = await publishRelayEventViaTransportEngineHost({
      profileId: "default",
      payload: {
        relayUrls: ["wss://relay.one", "wss://relay.two"],
        payload: "[\"EVENT\",{\"id\":\"e1\"}]",
        correlationId: "corr-w37",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected dry-run host publish result.");
    }
    expect(isTransportPublishRelayEventResult(result.data)).toBe(true);
    expect(result.data.correlationId).toBe("corr-w37");
  });

  it("aligns dry-run host result quorum/status with shared mapper semantics", async () => {
    mockInvoke.mockResolvedValue({ ok: true, data: dryRunHostResult });

    const result = await publishRelayEventViaTransportEngineHost({
      profileId: "default",
      payload: {
        relayUrls: ["wss://relay.one", "wss://relay.two"],
        payload: "[\"EVENT\",{\"id\":\"e1\"}]",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected dry-run host publish result.");
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

    expect(mapped.status).toBe("failed");
    expect(mapped.reasonCode).toBe("quorum_not_met");
    expect(mapped.metQuorum).toBe(false);
  });
});
