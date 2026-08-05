import { describe, expect, it } from "vitest";
import { deriveRelayNodeStatus, deriveRelayRuntimeStatus } from "./relay-runtime-status";

describe("deriveRelayRuntimeStatus", () => {
  it("returns unavailable when no relays are configured", () => {
    const status = deriveRelayRuntimeStatus({ openCount: 0, totalCount: 0 });
    expect(status.status).toBe("unavailable");
    expect(status.label).toContain("No relay");
  });

  it("returns recovering when runtime is actively recovering with no open sockets", () => {
    const status = deriveRelayRuntimeStatus({
      openCount: 0,
      totalCount: 2,
      writableCount: 0,
      subscribableCount: 0,
      phase: "recovering",
      recoveryStage: "replay_subscriptions",
    });
    expect(status.status).toBe("recovering");
    expect(status.actionText).toContain("replay subscriptions");
  });

  it("does not stay on connections-starting when an open socket exists", () => {
    const status = deriveRelayRuntimeStatus({
      openCount: 1,
      totalCount: 1,
      writableCount: 0,
      phase: "connecting",
      lastSuccessfulPublishAtUnixMs: Date.now(),
      nowUnixMs: Date.now(),
    });
    expect(status.status).not.toBe("recovering");
    expect(status.label).not.toMatch(/starting/i);
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
    expect(status.label).toContain("quiet");
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

  it("returns degraded when only part of the configured pool is publish-ready", () => {
    const status = deriveRelayRuntimeStatus({
      openCount: 0,
      totalCount: 3,
      writableCount: 1,
      subscribableCount: 1,
      phase: "healthy",
      lastSuccessfulPublishAtUnixMs: 59_000,
      nowUnixMs: 60_000,
      meshReadiness: "degraded",
    });
    expect(status.status).toBe("degraded");
    expect(status.actionText).toContain("Redundancy reduced");
  });

  it("treats recent publish evidence as fresh when inbound WS events are absent", () => {
    const status = deriveRelayRuntimeStatus({
      openCount: 0,
      totalCount: 1,
      writableCount: 1,
      subscribableCount: 1,
      phase: "healthy",
      lastSuccessfulPublishAtUnixMs: 59_000,
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
    expect(status.badge).toBe("Quiet");
    expect(status.detail.toLowerCase()).toContain("not high latency");
  });

  it("labels probed standbys when there is no active-pool socket", () => {
    const status = deriveRelayNodeStatus({
      url: "wss://relay.damus.io",
      enabled: true,
      isConfigured: true,
      role: "standby",
      metrics: {
        url: "wss://relay.damus.io",
        status: "disconnected",
        connectionAttempts: 1,
        successfulConnections: 0,
        failedConnections: 0,
        latency: 220,
        latencyHistory: [220],
        successRate: 100,
        circuitBreakerState: "closed",
        circuitBreakerFailureCount: 0,
        retryCount: 0,
        backoffDelay: 1000,
      },
      runtimePhase: "offline",
    });
    expect(status.badge).toBe("Probed");
    expect(status.roleLabel).toBe("Standby (probed)");
  });

  it("labels the primary open socket as active transport", () => {
    const status = deriveRelayNodeStatus({
      url: "wss://relay.damus.io",
      enabled: true,
      isConfigured: true,
      role: "primary",
      connection: {
        url: "wss://relay.damus.io",
        status: "open",
        updatedAtUnixMs: 1,
      },
      metrics: {
        url: "wss://relay.damus.io",
        status: "connected",
        connectionAttempts: 1,
        successfulConnections: 1,
        failedConnections: 0,
        latency: 120,
        latencyHistory: [120],
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
    expect(status.badge).toBe("Active transport");
    expect(status.roleLabel).toBe("Active transport");
  });

  it("labels primary without open socket as Primary (offline), not Active transport", () => {
    const status = deriveRelayNodeStatus({
      url: "wss://nos.lol",
      enabled: true,
      isConfigured: true,
      role: "primary",
      connection: undefined,
      metrics: {
        url: "wss://nos.lol",
        status: "disconnected",
        connectionAttempts: 1,
        successfulConnections: 1,
        failedConnections: 0,
        latency: 908,
        latencyHistory: [908],
        latencySampleSource: "connect",
        successRate: 100,
        circuitBreakerState: "closed",
        circuitBreakerFailureCount: 0,
        retryCount: 0,
        backoffDelay: 1000,
      },
      runtimePhase: "degraded",
    });
    expect(status.badge).toBe("Disconnected");
    expect(status.roleLabel).toBe("Primary (offline)");
    expect(status.detail).toContain("Selected primary");
  });

  it("elevates connecting primary to Active transport when mesh publish-ready", () => {
    const status = deriveRelayNodeStatus({
      url: "wss://nos.lol",
      enabled: true,
      isConfigured: true,
      role: "primary",
      isPublishReady: true,
      connection: {
        url: "wss://nos.lol",
        status: "connecting",
        updatedAtUnixMs: 1,
      },
      runtimePhase: "connecting",
    });
    expect(status.badge).toBe("Active transport");
    expect(status.roleLabel).toBe("Active transport");
    expect(status.status).toBe("healthy");
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
