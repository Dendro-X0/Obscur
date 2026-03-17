import { describe, expect, it } from "vitest";
import { deriveRelayNodeStatus, deriveRelayRuntimeStatus } from "./relay-runtime-status";

describe("deriveRelayRuntimeStatus", () => {
  it("returns unavailable when no relays are configured", () => {
    const status = deriveRelayRuntimeStatus({ openCount: 0, totalCount: 0 });
    expect(status.status).toBe("unavailable");
    expect(status.label).toContain("No relay");
  });

  it("returns recovering when runtime is actively recovering", () => {
    const status = deriveRelayRuntimeStatus({
      openCount: 1,
      totalCount: 2,
      writableCount: 1,
      subscribableCount: 1,
      phase: "recovering",
      recoveryStage: "replay_subscriptions",
    });
    expect(status.status).toBe("recovering");
    expect(status.actionText).toContain("replay subscriptions");
  });

  it("returns degraded when sockets are open but event freshness is stale", () => {
    const status = deriveRelayRuntimeStatus({
      openCount: 2,
      totalCount: 2,
      writableCount: 2,
      subscribableCount: 2,
      phase: "healthy",
      lastInboundEventAtUnixMs: 1,
      nowUnixMs: 60_000,
    });
    expect(status.status).toBe("degraded");
    expect(status.label).toContain("event flow");
  });

  it("returns healthy only when configured relays are writable and events are fresh", () => {
    const status = deriveRelayRuntimeStatus({
      openCount: 2,
      totalCount: 2,
      writableCount: 2,
      subscribableCount: 2,
      phase: "healthy",
      lastInboundEventAtUnixMs: 55_000,
      nowUnixMs: 60_000,
    });
    expect(status.status).toBe("healthy");
  });

  it("clears the overall fallback warning once configured relays are healthy again", () => {
    const status = deriveRelayRuntimeStatus({
      openCount: 2,
      totalCount: 2,
      writableCount: 2,
      subscribableCount: 2,
      phase: "healthy",
      lastInboundEventAtUnixMs: 55_000,
      fallbackRelayCount: 2,
      nowUnixMs: 60_000,
    });
    expect(status.status).toBe("healthy");
    expect(status.label).toContain("Configured relays healthy");
  });
});

describe("deriveRelayNodeStatus", () => {
  it("marks open fallback relays as degraded fallback coverage", () => {
    const status = deriveRelayNodeStatus({
      url: "wss://relay.example",
      enabled: true,
      isConfigured: false,
      isFallback: true,
      connection: {
        url: "wss://relay.example",
        status: "open",
        updatedAtUnixMs: 1,
      },
      runtimePhase: "healthy",
      lastInboundEventAtUnixMs: 10_000,
      nowUnixMs: 12_000,
    });
    expect(status.status).toBe("degraded");
    expect(status.badge).toBe("Fallback active");
    expect(status.roleLabel).toBe("Fallback");
  });

  it("marks connected relays with stale window events as degraded", () => {
    const status = deriveRelayNodeStatus({
      url: "wss://relay.example",
      enabled: true,
      isConfigured: true,
      connection: {
        url: "wss://relay.example",
        status: "open",
        updatedAtUnixMs: 1,
      },
      runtimePhase: "healthy",
      lastInboundEventAtUnixMs: 1,
      nowUnixMs: 60_000,
    });
    expect(status.status).toBe("degraded");
    expect(status.badge).toBe("No recent events");
  });

  it("shows insufficient-data confidence for low-sample relays", () => {
    const status = deriveRelayNodeStatus({
      url: "wss://relay.example",
      enabled: true,
      isConfigured: true,
      connection: {
        url: "wss://relay.example",
        status: "open",
        updatedAtUnixMs: 1,
      },
      metrics: {
        url: "wss://relay.example",
        status: "connected",
        connectionAttempts: 1,
        successfulConnections: 1,
        failedConnections: 0,
        latency: 100,
        latencyHistory: [100],
        successRate: 100,
        circuitBreakerState: "closed",
        circuitBreakerFailureCount: 0,
        retryCount: 0,
        backoffDelay: 1000,
      },
      runtimePhase: "healthy",
      lastInboundEventAtUnixMs: 10_000,
      nowUnixMs: 10_500,
    });
    expect(status.successLabel).toBe("n/a");
    expect(status.confidenceLabel).toContain("Insufficient data");
  });
});
