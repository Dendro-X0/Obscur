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

  it("preserves percentage-based success-rate differences in relay scoring", () => {
    const perfectRelay = "wss://perfect.example";
    const flakyRelay = "wss://flaky.example";

    relayHealthMonitor.initializeRelay(perfectRelay);
    relayHealthMonitor.initializeRelay(flakyRelay);

    relayHealthMonitor.recordConnectionSuccess(perfectRelay);
    relayHealthMonitor.recordLatency(perfectRelay, 250);

    relayHealthMonitor.recordConnectionSuccess(flakyRelay);
    relayHealthMonitor.recordConnectionFailure(flakyRelay, "timeout");
    relayHealthMonitor.recordLatency(flakyRelay, 250);

    const decision = relayReliabilityInternals.buildRelaySelectionDecision([flakyRelay, perfectRelay]);

    expect(decision.orderedUrls[0]).toBe(perfectRelay);
    expect(decision.scores.find((entry) => entry.url === perfectRelay)?.score)
      .toBeGreaterThan(decision.scores.find((entry) => entry.url === flakyRelay)?.score ?? -1);
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

  it("classifies relay circuit state for healthy/degraded/cooling down", () => {
    const relay = "wss://state.example";
    relayHealthMonitor.initializeRelay(relay);
    relayHealthMonitor.recordConnectionSuccess(relay);
    const healthy = relayHealthMonitor.getMetrics(relay);
    expect(relayReliabilityInternals.classifyRelayCircuitState(healthy)).toBe("healthy");

    relayHealthMonitor.recordConnectionFailure(relay, "timeout");
    const degraded = relayHealthMonitor.getMetrics(relay);
    expect(relayReliabilityInternals.classifyRelayCircuitState(degraded)).toBe("degraded");

    for (let i = 0; i < 6; i += 1) {
      relayHealthMonitor.recordConnectionFailure(relay, "timeout");
    }
    const openCircuit = relayHealthMonitor.getMetrics(relay);
    expect(relayReliabilityInternals.classifyRelayCircuitState(openCircuit)).toBe("cooling_down");
  });

  it("extracts structured relay error message detail when provided", () => {
    const event = new CustomEvent("error", {
      detail: { message: "Tor proxy connect failed: HTTP error: 403 Forbidden" },
    });

    expect(relayReliabilityInternals.readRelayErrorMessage(event)).toBe(
      "Tor proxy connect failed: HTTP error: 403 Forbidden",
    );
  });

  it("classifies hard relay failures used for cooldown gating", () => {
    expect(relayReliabilityInternals.isHardRelayFailure("Tor proxy connect failed: HTTP error: 403 Forbidden")).toBe(true);
    expect(relayReliabilityInternals.isHardRelayFailure("HTTP error: 503 Service Unavailable")).toBe(false);
    expect(relayReliabilityInternals.isHardRelayFailure("Relay status error")).toBe(false);
    expect(relayReliabilityInternals.isHardRelayFailure("cf-mitigated challenge")).toBe(true);
    expect(relayReliabilityInternals.isHardRelayFailure("WebSocket error")).toBe(false);
  });

  it("classifies transient relay failures used for short cooldown gating", () => {
    expect(relayReliabilityInternals.isTransientRelayFailure("HTTP error: 503 Service Unavailable")).toBe(true);
    expect(relayReliabilityInternals.isTransientRelayFailure("HTTP error: 521")).toBe(true);
    expect(relayReliabilityInternals.isTransientRelayFailure("Relay status error")).toBe(true);
    expect(relayReliabilityInternals.isTransientRelayFailure("Tor proxy connect failed: HTTP error: 403 Forbidden")).toBe(false);
  });

  it("uses shorter hard-failure cooldown when no writable relays exist", () => {
    expect(relayReliabilityInternals.resolveHardFailureCooldownMs({ writableRelayCount: 0 })).toBe(15_000);
    expect(relayReliabilityInternals.resolveHardFailureCooldownMs({ writableRelayCount: 2 })).toBe(120_000);
  });

  it("uses short transient cooldown to reduce prolonged degraded windows", () => {
    expect(relayReliabilityInternals.resolveTransientFailureCooldownMs({ writableRelayCount: 0 })).toBe(7_500);
    expect(relayReliabilityInternals.resolveTransientFailureCooldownMs({ writableRelayCount: 2 })).toBe(20_000);
  });
});
