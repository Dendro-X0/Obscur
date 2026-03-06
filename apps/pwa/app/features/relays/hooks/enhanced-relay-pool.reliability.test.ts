import { beforeEach, describe, expect, it } from "vitest";
import { relayHealthMonitor } from "./relay-health-monitor";
import { relayReliabilityInternals, type PublishResult } from "./enhanced-relay-pool";

describe("enhanced-relay-pool reliability internals", () => {
  beforeEach(() => {
    relayHealthMonitor.clearAllMetrics();
  });

  it("orders relays deterministically by health score", () => {
    const fastRelay = "wss://fast.example";
    const slowRelay = "wss://slow.example";

    relayHealthMonitor.initializeRelay(fastRelay);
    relayHealthMonitor.initializeRelay(slowRelay);

    relayHealthMonitor.recordConnectionSuccess(fastRelay);
    relayHealthMonitor.recordLatency(fastRelay, 120);

    relayHealthMonitor.recordConnectionSuccess(slowRelay);
    relayHealthMonitor.recordConnectionFailure(slowRelay, "timeout");
    relayHealthMonitor.recordLatency(slowRelay, 1800);

    const decision = relayReliabilityInternals.buildRelaySelectionDecision([slowRelay, fastRelay]);

    expect(decision.orderedUrls[0]).toBe(fastRelay);
    expect(decision.orderedUrls[1]).toBe(slowRelay);
  });

  it("evaluates quorum for partial and full failure cases", () => {
    const mixedResults: PublishResult[] = [
      { success: true, relayUrl: "wss://1" },
      { success: false, relayUrl: "wss://2", error: "timeout" },
      { success: true, relayUrl: "wss://3" },
      { success: false, relayUrl: "wss://4", error: "rejected" },
    ];
    const mixedQuorum = relayReliabilityInternals.evaluatePublishQuorum({
      results: mixedResults,
      totalRelays: 4,
      reliabilityEnabled: true,
    });
    expect(mixedQuorum.quorumRequired).toBe(2);
    expect(mixedQuorum.metQuorum).toBe(true);
    expect(mixedQuorum.failures).toHaveLength(2);

    const failedQuorum = relayReliabilityInternals.evaluatePublishQuorum({
      results: [{ success: false, relayUrl: "wss://1", error: "offline" }],
      totalRelays: 1,
      reliabilityEnabled: true,
    });
    expect(failedQuorum.quorumRequired).toBe(1);
    expect(failedQuorum.metQuorum).toBe(false);
    expect(failedQuorum.successCount).toBe(0);
  });
});
