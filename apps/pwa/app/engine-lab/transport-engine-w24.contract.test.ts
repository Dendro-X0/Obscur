import { describe, expect, it } from "vitest";
import { isTransportPublishRelayEventResult } from "@obscur/engine-contracts";
import { mapLegacyPublishResultToRelayPublishResult } from "@/app/features/relays/lib/publish-outcome-mapper";
import { publishRelayEventViaTransportEngineHost } from "@/app/features/transport-kernel/transport-engine-host-port";

const normalizeRelayUrls = (urls: ReadonlyArray<string>): ReadonlyArray<string> => (
  Array.from(new Set(urls.map((url) => url.trim()).filter((url) => url.length > 0)))
);

describe("transport-engine w24 — executable publish parity harness slice", () => {
  it("compares fixture parity for normalization + quorum/result fields", () => {
    const rawRelayUrls = [
      " wss://relay.one ",
      "wss://relay.two",
      "wss://relay.one",
      "   ",
      "wss://relay.three",
    ];
    const normalized = normalizeRelayUrls(rawRelayUrls);

    const legacyMapped = mapLegacyPublishResultToRelayPublishResult({
      success: true,
      successCount: 2,
      totalRelays: normalized.length,
      results: [
        { relayUrl: normalized[0], success: true },
        { relayUrl: normalized[1], success: false, error: "timeout" },
        { relayUrl: normalized[2], success: true },
      ],
    });

    const hostShape = {
      success: true,
      successCount: 2,
      totalRelays: normalized.length,
      quorumRequired: Math.max(1, Math.ceil(normalized.length / 2)),
      metQuorum: true,
      results: [
        { relayUrl: normalized[0], success: true },
        { relayUrl: normalized[1], success: false, error: "timeout" },
        { relayUrl: normalized[2], success: true },
      ],
      failures: [{ relayUrl: normalized[1], success: false, error: "timeout" }],
    };

    expect(isTransportPublishRelayEventResult(hostShape)).toBe(true);
    expect(normalized).toEqual(["wss://relay.one", "wss://relay.two", "wss://relay.three"]);
    expect(hostShape.totalRelays).toBe(legacyMapped.totalRelays);
    expect(hostShape.quorumRequired).toBe(legacyMapped.quorumRequired);
    expect(hostShape.metQuorum).toBe(legacyMapped.metQuorum);
    expect(hostShape.success).toBe(legacyMapped.success);
    expect(hostShape.successCount).toBe(legacyMapped.successCount);
    expect(hostShape.failures).toEqual(legacyMapped.failures);
  });

  it("keeps host publish fail-closed in headless mode", async () => {
    const result = await publishRelayEventViaTransportEngineHost({
      profileId: "default",
      payload: {
        relayUrls: ["wss://relay.one"],
        payload: "[\"EVENT\",{\"id\":\"e1\"}]",
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected host-unavailable path in headless mode.");
    }
    expect(result.errorCode).toBe("transport_engine_host_unavailable");
  });
});

