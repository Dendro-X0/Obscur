import { beforeEach, describe, expect, it } from "vitest";

import {
  relayResilienceObservability,
  relayResilienceObservabilityInternals,
} from "./relay-resilience-observability";

describe("relay-resilience-observability", () => {
  beforeEach(() => {
    relayResilienceObservability.resetForTests(0);
  });

  it("tracks per-relay flap rate in a rolling window", () => {
    const relayUrl = "wss://relay.one";

    relayResilienceObservability.recordRelayConnectionStatus({
      url: relayUrl,
      status: "open",
      atUnixMs: 1_000,
    });
    relayResilienceObservability.recordRelayConnectionStatus({
      url: relayUrl,
      status: "closed",
      atUnixMs: 2_000,
    });
    relayResilienceObservability.recordRelayConnectionStatus({
      url: relayUrl,
      status: "open",
      atUnixMs: 3_000,
    });

    const snapshot = relayResilienceObservability.getSnapshot(4_000);
    expect(snapshot.relayFlapByUrl[relayUrl]?.flapCountInWindow).toBe(2);
    expect(snapshot.relayFlapByUrl[relayUrl]?.lastFlapAtUnixMs).toBe(3_000);
    expect(snapshot.relayFlapByUrl[relayUrl]?.flapRatePerMinute).toBeCloseTo(0.4, 5);

    const expired = relayResilienceObservability.getSnapshot(
      relayResilienceObservabilityInternals.FLAP_RATE_WINDOW_MS + 3_001,
    );
    expect(expired.relayFlapByUrl[relayUrl]).toBeUndefined();
  });

  it("measures recovery latency from healthy to non-healthy and back", () => {
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "healthy", atUnixMs: 1_000 });
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "degraded", atUnixMs: 2_500 });
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "healthy", atUnixMs: 8_250 });

    relayResilienceObservability.recordRelayRuntimePhase({ phase: "recovering", atUnixMs: 9_000 });
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "healthy", atUnixMs: 19_000 });

    const snapshot = relayResilienceObservability.getSnapshot(20_000);
    expect(snapshot.recoveryLatency.sampleCount).toBe(2);
    expect(snapshot.recoveryLatency.lastLatencyMs).toBe(10_000);
    expect(snapshot.recoveryLatency.p95LatencyMs).toBe(10_000);
    expect(snapshot.recoveryLatency.averageLatencyMs).toBe(7_875);
  });

  it("aggregates replay and scoped-readiness ratios", () => {
    relayResilienceObservability.recordSubscriptionReplayResult({ result: "ok", atUnixMs: 1_000 });
    relayResilienceObservability.recordSubscriptionReplayResult({ result: "partial", atUnixMs: 1_100 });
    relayResilienceObservability.recordSubscriptionReplayResult({ result: "failed", atUnixMs: 1_200 });
    relayResilienceObservability.recordSubscriptionReplayResult({ result: "skipped", atUnixMs: 1_300 });

    relayResilienceObservability.recordScopedPublishReadiness({ blockedByReadiness: true, atUnixMs: 2_000 });
    relayResilienceObservability.recordScopedPublishReadiness({ blockedByReadiness: false, atUnixMs: 2_100 });
    relayResilienceObservability.recordScopedPublishReadiness({ blockedByReadiness: true, atUnixMs: 2_200 });
    relayResilienceObservability.recordScopedPublishReadiness({ blockedByReadiness: false, atUnixMs: 2_300 });

    const snapshot = relayResilienceObservability.getSnapshot(3_000);
    expect(snapshot.replay.totalResultCount).toBe(4);
    expect(snapshot.replay.attemptedReplayCount).toBe(3);
    expect(snapshot.replay.successRatio).toBe(0.6667);
    expect(snapshot.scopedReadiness.scopedPublishAttemptCount).toBe(4);
    expect(snapshot.scopedReadiness.blockedByReadinessCount).toBe(2);
    expect(snapshot.scopedReadiness.blockedByReadinessRatio).toBe(0.5);
  });

  it("evaluates beta readiness gates against thresholds", () => {
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "healthy", atUnixMs: 1_000 });
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "degraded", atUnixMs: 2_000 });
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "healthy", atUnixMs: 5_000 });

    for (let i = 0; i < 10; i += 1) {
      relayResilienceObservability.recordSubscriptionReplayResult({
        result: i === 0 ? "partial" : "ok",
        atUnixMs: 6_000 + i,
      });
      relayResilienceObservability.recordScopedPublishReadiness({
        blockedByReadiness: i < 2,
        atUnixMs: 7_000 + i,
      });
    }

    const stableNow = relayResilienceObservabilityInternals.DEFAULT_BETA_GATE_THRESHOLDS.minObservationWindowMs + 1;
    const readySnapshot = relayResilienceObservability.getSnapshot(stableNow);
    const readyResult = relayResilienceObservability.evaluateBetaReadiness({ snapshot: readySnapshot });
    expect(readyResult.ready).toBe(true);

    relayResilienceObservability.recordOperatorIntervention({ atUnixMs: stableNow + 1 });
    const blockedSnapshot = relayResilienceObservability.getSnapshot(stableNow + 2);
    const blockedResult = relayResilienceObservability.evaluateBetaReadiness({ snapshot: blockedSnapshot });
    expect(blockedResult.ready).toBe(false);
    expect(blockedResult.reasons).toContain("operator_intervention_required");
  });

  it("passes runtime performance gate when reconnect and sync metrics stay within target", () => {
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "healthy", atUnixMs: 1_000 });
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "recovering", atUnixMs: 2_000 });
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "healthy", atUnixMs: 6_000 });
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "recovering", atUnixMs: 8_000 });
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "healthy", atUnixMs: 13_000 });
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "degraded", atUnixMs: 15_000 });
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "healthy", atUnixMs: 20_000 });

    for (let i = 0; i < 8; i += 1) {
      relayResilienceObservability.recordSubscriptionReplayResult({ result: "ok", atUnixMs: 30_000 + i });
      relayResilienceObservability.recordScopedPublishReadiness({ blockedByReadiness: i < 2, atUnixMs: 31_000 + i });
    }

    const snapshot = relayResilienceObservability.getSnapshot(200_000);
    const gate = relayResilienceObservability.evaluateRuntimePerformanceGate({ snapshot });
    expect(gate.status).toBe("pass");
    expect(gate.primaryReasonCode).toBe("ok");
  });

  it("warns runtime performance gate when metrics exceed target but stay under hard budget", () => {
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "healthy", atUnixMs: 1_000 });
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "recovering", atUnixMs: 2_000 });
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "healthy", atUnixMs: 14_000 });
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "degraded", atUnixMs: 16_000 });
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "healthy", atUnixMs: 28_000 });
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "recovering", atUnixMs: 30_000 });
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "healthy", atUnixMs: 41_000 });

    for (let i = 0; i < 8; i += 1) {
      relayResilienceObservability.recordSubscriptionReplayResult({
        result: i < 7 ? "ok" : "partial",
        atUnixMs: 50_000 + i,
      });
      relayResilienceObservability.recordScopedPublishReadiness({
        blockedByReadiness: i < 3,
        atUnixMs: 51_000 + i,
      });
    }

    const snapshot = relayResilienceObservability.getSnapshot(220_000);
    const gate = relayResilienceObservability.evaluateRuntimePerformanceGate({ snapshot });
    expect(gate.status).toBe("warn");
    expect(gate.reasons).toContain("recovery_p95_over_target");
    expect(gate.reasons).toContain("scoped_block_ratio_over_target");
  });

  it("fails runtime performance gate under relay-churn and sync degradation", () => {
    const relayUrl = "wss://relay.one";
    for (let i = 0; i < 12; i += 1) {
      relayResilienceObservability.recordRelayConnectionStatus({
        url: relayUrl,
        status: i % 2 === 0 ? "open" : "closed",
        atUnixMs: 1_000 + (i * 400),
      });
    }

    relayResilienceObservability.recordRelayRuntimePhase({ phase: "healthy", atUnixMs: 1_000 });
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "recovering", atUnixMs: 2_000 });
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "healthy", atUnixMs: 22_500 });
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "recovering", atUnixMs: 23_000 });
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "healthy", atUnixMs: 43_000 });
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "degraded", atUnixMs: 44_000 });
    relayResilienceObservability.recordRelayRuntimePhase({ phase: "healthy", atUnixMs: 64_500 });

    for (let i = 0; i < 8; i += 1) {
      relayResilienceObservability.recordSubscriptionReplayResult({
        result: i < 2 ? "ok" : "failed",
        atUnixMs: 70_000 + i,
      });
      relayResilienceObservability.recordScopedPublishReadiness({
        blockedByReadiness: i < 5,
        atUnixMs: 71_000 + i,
      });
    }

    const snapshot = relayResilienceObservability.getSnapshot(250_000);
    const gate = relayResilienceObservability.evaluateRuntimePerformanceGate({ snapshot });
    expect(gate.status).toBe("fail");
    expect(gate.reasons).toContain("recovery_p95_over_budget");
    expect(gate.reasons).toContain("replay_success_ratio_below_budget");
    expect(gate.reasons).toContain("scoped_block_ratio_over_budget");
    expect(gate.reasons).toContain("relay_flap_rate_over_budget");
  });
});
