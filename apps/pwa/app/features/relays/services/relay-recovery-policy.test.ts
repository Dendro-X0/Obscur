import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  classifyRelayRecoveryState,
  createRelayRecoveryController,
  relayRecoveryInternals,
} from "./relay-recovery-policy";
import type { EnhancedRelayPoolResult } from "@/app/features/relays/hooks/enhanced-relay-pool";

const createPool = (): EnhancedRelayPoolResult => ({
  connections: [],
  healthMetrics: [],
  sendToOpen: vi.fn(),
  publishToUrl: vi.fn(),
  publishToUrls: vi.fn(),
  publishToRelay: vi.fn(),
  publishToAll: vi.fn(),
  broadcastEvent: vi.fn(),
  subscribeToMessages: vi.fn(() => () => {}),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  getRelayHealth: vi.fn(),
  getRelayCircuitState: vi.fn((_url: string) => "healthy" as const),
  canConnectToRelay: vi.fn(() => true),
  addTransientRelay: vi.fn(),
  removeTransientRelay: vi.fn(),
  reconnectRelay: vi.fn(),
  reconnectAll: vi.fn(),
  resubscribeAll: vi.fn(),
  recycle: vi.fn(async () => {}),
  isConnected: vi.fn(() => false),
  waitForConnection: vi.fn(async () => false),
  waitForScopedConnection: vi.fn(async () => false),
  getWritableRelaySnapshot: vi.fn(() => ({
    atUnixMs: 1000,
    configuredRelayUrls: ["wss://relay.one"],
    writableRelayUrls: [],
    totalRelayCount: 1,
    openRelayCount: 0,
    relayCircuitStates: { "wss://relay.one": "degraded" as const },
  })),
  getTransportActivitySnapshot: vi.fn(() => ({
    lastInboundMessageAtUnixMs: undefined,
    lastInboundEventAtUnixMs: undefined,
    writableRelayCount: 0,
    subscribableRelayCount: 0,
    writeBlockedRelayCount: 0,
    coolingDownRelayCount: 0,
    fallbackRelayUrls: [],
  })),
  getActiveSubscriptionCount: vi.fn(() => 0),
  dispose: vi.fn(),
});

describe("relay recovery policy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("classifies healthy when writable and subscribable relays exist", () => {
    expect(classifyRelayRecoveryState({
      writableRelayCount: 2,
      subscribableRelayCount: 2,
      recoveryAttemptCount: 0,
    })).toBe("healthy");
  });

  it("triggers reconnect on the first recovery attempt", async () => {
    const controller = createRelayRecoveryController();
    const pool = createPool();
    controller.configure({ pool, enabledRelayUrls: ["wss://relay.one"] });

    await controller.triggerRecovery("no_writable_relays");
    expect(pool.reconnectAll).toHaveBeenCalledTimes(1);
  });

  it("cycles no_writable_relays recovery without escalating to reload_required", async () => {
    const controller = createRelayRecoveryController();
    const pool = createPool();
    controller.configure({ pool, enabledRelayUrls: ["wss://relay.one"] });

    vi.setSystemTime(new Date("2026-01-01T00:00:09.000Z"));
    const first = await controller.triggerRecovery("no_writable_relays");
    expect(first.currentAction).toBe("reconnect");
    expect(first.recoveryReasonCode).toBe("no_writable_relays");

    vi.setSystemTime(new Date("2026-01-01T00:00:18.000Z"));
    const second = await controller.triggerRecovery("no_writable_relays");
    expect(second.currentAction).toBe("resubscribe");
    expect(second.recoveryReasonCode).toBe("no_writable_relays");

    vi.setSystemTime(new Date("2026-01-01T00:00:27.000Z"));
    const third = await controller.triggerRecovery("no_writable_relays");
    expect(third.currentAction).toBe("subsystem_reset");
    expect(third.recoveryReasonCode).toBe("no_writable_relays");

    vi.setSystemTime(new Date("2026-01-01T00:00:36.000Z"));
    const fourth = await controller.triggerRecovery("no_writable_relays");
    expect(fourth.currentAction).toBe("reconnect");
    expect(fourth.recoveryReasonCode).toBe("no_writable_relays");

    expect(pool.reconnectAll).toHaveBeenCalledTimes(2);
    expect(pool.resubscribeAll).toHaveBeenCalledTimes(1);
    expect(pool.recycle).toHaveBeenCalledTimes(1);
  });

  it("escalates non-no_writable relays recoveries to reload_required when exhausted", async () => {
    const controller = createRelayRecoveryController();
    const pool = createPool();
    controller.configure({ pool, enabledRelayUrls: ["wss://relay.one"] });

    vi.setSystemTime(new Date("2026-01-01T00:00:09.000Z"));
    await controller.triggerRecovery("manual");
    vi.setSystemTime(new Date("2026-01-01T00:00:18.000Z"));
    await controller.triggerRecovery("manual");
    vi.setSystemTime(new Date("2026-01-01T00:00:27.000Z"));
    await controller.triggerRecovery("manual");
    vi.setSystemTime(new Date("2026-01-01T00:00:36.000Z"));
    await controller.triggerRecovery("manual");
    vi.setSystemTime(new Date("2026-01-01T00:00:45.000Z"));
    const exhausted = await controller.triggerRecovery("manual");

    expect(exhausted.currentAction).toBe("reload_required");
    expect(exhausted.recoveryReasonCode).toBe("recovery_exhausted");
  });

  it("treats control chatter without event freshness as stale subscription risk", async () => {
    const controller = createRelayRecoveryController();
    const pool = createPool();
    vi.mocked(pool.getWritableRelaySnapshot).mockReturnValue({
      atUnixMs: 1000,
      configuredRelayUrls: ["wss://relay.one"],
      writableRelayUrls: ["wss://relay.one"],
      totalRelayCount: 1,
      openRelayCount: 1,
      relayCircuitStates: { "wss://relay.one": "healthy" },
    });
    vi.mocked(pool.getTransportActivitySnapshot).mockReturnValue({
      lastInboundMessageAtUnixMs: Date.now(),
      lastInboundEventAtUnixMs: undefined,
      lastSuccessfulPublishAtUnixMs: undefined,
      writableRelayCount: 1,
      subscribableRelayCount: 1,
      writeBlockedRelayCount: 0,
      coolingDownRelayCount: 0,
      fallbackRelayUrls: [],
    });

    controller.configure({ pool, enabledRelayUrls: ["wss://relay.one"] });
    controller.startWarmup();
    await controller.triggerRecovery("manual");
    expect(pool.reconnectAll).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 46_000);
    await vi.advanceTimersByTimeAsync(12_000);

    expect(pool.reconnectAll).toHaveBeenCalledTimes(2);
  });

  it("exposes deterministic recovery-step selectors", () => {
    expect(relayRecoveryInternals.getNextRecoveryAttemptCount({
      reason: "no_writable_relays",
      previousAttemptCount: 3,
    })).toBe(1);
    expect(relayRecoveryInternals.selectRecoveryAction({
      reason: "no_writable_relays",
      nextAttempt: 4,
    })).toBe("reconnect");
    expect(relayRecoveryInternals.selectRecoveryAction({
      reason: "manual",
      nextAttempt: 5,
    })).toBe("reload_required");
    expect(relayRecoveryInternals.resolveWatchdogRecoveryReason({
      enabledRelayCount: 1,
      writableRelayCount: 0,
      subscribableRelayCount: 1,
      writeBlockedRelayCount: 1,
      coolingDownRelayCount: 0,
      eventFreshnessReferenceUnixMs: undefined,
      nowUnixMs: 100_000,
    })).toBe("write_queue_blocked");
    expect(relayRecoveryInternals.resolveWatchdogRecoveryReason({
      enabledRelayCount: 1,
      writableRelayCount: 0,
      subscribableRelayCount: 0,
      writeBlockedRelayCount: 0,
      coolingDownRelayCount: 1,
      eventFreshnessReferenceUnixMs: undefined,
      nowUnixMs: 100_000,
    })).toBe("cooldown_active");
    expect(relayRecoveryInternals.resolveWatchdogRecoveryReason({
      enabledRelayCount: 1,
      writableRelayCount: 1,
      subscribableRelayCount: 1,
      writeBlockedRelayCount: 0,
      coolingDownRelayCount: 0,
      eventFreshnessReferenceUnixMs: 100_000 - 60_000,
      nowUnixMs: 100_000,
    })).toBe("stale_event_flow");
  });
});
