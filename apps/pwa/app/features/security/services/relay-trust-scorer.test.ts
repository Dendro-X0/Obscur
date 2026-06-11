import { describe, expect, it } from "vitest";
import {
  buildRelayScoreFromMetrics,
  calculateRelayHealthScore,
  determineRelayTrustLevel,
  getRelayTrustRecommendation,
  type RelayMetrics,
} from "./relay-trust-scorer";

const baseMetrics = (overrides: Partial<RelayMetrics> = {}): RelayMetrics => ({
  url: "wss://nos.lol",
  totalAttempts: 100,
  successfulDeliveries: 95,
  failedDeliveries: 5,
  avgLatencyMs: 200,
  lastSuccessAt: Date.now(),
  lastFailureAt: null,
  consecutiveFailures: 0,
  firstSeenAt: Date.now() - 86_400_000,
  userReports: "none",
  ...overrides,
});

describe("relay-trust-scorer SEC-R2 pure scoring", () => {
  it("returns neutral health for relays with no delivery attempts", () => {
    const metrics = baseMetrics({ totalAttempts: 0, successfulDeliveries: 0 });
    expect(calculateRelayHealthScore(metrics)).toBe(50);
    expect(determineRelayTrustLevel(metrics, 50)).toBe("low");
  });

  it("scores high-trust relays with strong delivery and low latency", () => {
    const metrics = baseMetrics({
      totalAttempts: 200,
      successfulDeliveries: 198,
      avgLatencyMs: 80,
      consecutiveFailures: 0,
    });
    const health = calculateRelayHealthScore(metrics);
    const trustLevel = determineRelayTrustLevel(metrics, health);
    const score = buildRelayScoreFromMetrics(metrics);

    expect(health).toBeGreaterThanOrEqual(85);
    expect(trustLevel).toBe("high");
    expect(score.recommendation).toBe("keep");
    expect(getRelayTrustRecommendation(metrics, trustLevel)).toBe("keep");
  });

  it("downgrades relays with suspicious user reports", () => {
    const metrics = baseMetrics({ userReports: "suspicious" });
    const health = calculateRelayHealthScore(metrics);
    expect(health).toBeLessThan(calculateRelayHealthScore(baseMetrics()));
    expect(determineRelayTrustLevel(metrics, health)).not.toBe("high");
  });

  it("marks blocked relays untrusted regardless of delivery stats", () => {
    const metrics = baseMetrics({ userReports: "blocked" });
    const score = buildRelayScoreFromMetrics(metrics);

    expect(score.trustLevel).toBe("untrusted");
    expect(score.recommendation).toBe("replace");
    expect(score.healthScore).toBe(0);
  });

  it("recommends replace for unstable low-health relays", () => {
    const metrics = baseMetrics({
      totalAttempts: 20,
      successfulDeliveries: 8,
      failedDeliveries: 12,
      consecutiveFailures: 4,
      avgLatencyMs: 1800,
    });
    const score = buildRelayScoreFromMetrics(metrics);

    expect(score.trustLevel).toBe("untrusted");
    expect(score.recommendation).toBe("replace");
  });
});
