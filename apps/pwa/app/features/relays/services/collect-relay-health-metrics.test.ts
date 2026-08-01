import { describe, expect, it } from "vitest";
import type { RelayHealthMetrics } from "../hooks/relay-health-monitor";
import { collectRelayHealthMetricsForUrls } from "./collect-relay-health-metrics";

const stubMetrics = (url: string, latency: number): RelayHealthMetrics => ({
  url,
  status: "connected",
  connectionAttempts: 1,
  successfulConnections: 1,
  failedConnections: 0,
  latency,
  latencyHistory: [latency],
  successRate: 100,
  circuitBreakerState: "closed",
  circuitBreakerFailureCount: 0,
  retryCount: 0,
  backoffDelay: 1000,
});

describe("collectRelayHealthMetricsForUrls", () => {
  it("returns monitor metrics for requested urls in order, skipping missing", () => {
    const store = new Map<string, RelayHealthMetrics>([
      ["wss://nos.lol", stubMetrics("wss://nos.lol", 120)],
      ["wss://relay.damus.io", stubMetrics("wss://relay.damus.io", 90)],
    ]);
    const collected = collectRelayHealthMetricsForUrls(
      ["wss://nos.lol", "wss://missing.example", "wss://relay.damus.io", "wss://nos.lol"],
      (url) => store.get(url),
    );
    expect(collected.map((entry) => entry.url)).toEqual([
      "wss://nos.lol",
      "wss://relay.damus.io",
    ]);
    expect(collected[0]?.latencyHistory).toEqual([120]);
  });
});
