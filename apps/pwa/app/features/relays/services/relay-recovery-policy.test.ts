import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { classifyRelayRecoveryState } from "@/app/features/relays/services/relay-recovery-types";
import {
  createLegacyRelayRecoveryController,
  relayRecoveryInternals,
} from "@/app/features/relays/services/relay-recovery-port";
import type { EnhancedRelayPoolResult } from "@/app/features/relays/hooks/enhanced-relay-pool-types";

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
    fallbackWritableRelayCount: 0,
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

  it("classifies startup warmup as recovering instead of offline", () => {
    expect(classifyRelayRecoveryState({
      writableRelayCount: 0,
      fallbackWritableRelayCount: 0,
      subscribableRelayCount: 0,
      recoveryAttemptCount: 0,
      recoveryReasonCode: "startup_warmup",
    })).toBe("recovering");
  });

  it("classifies healthy when writable and subscribable relays exist", () => {
    expect(classifyRelayRecoveryState({
      writableRelayCount: 2,
      fallbackWritableRelayCount: 0,
      subscribableRelayCount: 2,
      recoveryAttemptCount: 0,
    })).toBe("healthy");
  });

  it("classifies fallback-only writable coverage as degraded", () => {
    expect(classifyRelayRecoveryState({
      writableRelayCount: 0,
      fallbackWritableRelayCount: 1,
      subscribableRelayCount: 1,
      recoveryAttemptCount: 3,
    })).toBe("degraded");
  });

  it("classifies recovery_exhausted as offline", () => {
    expect(classifyRelayRecoveryState({
      writableRelayCount: 0,
      fallbackWritableRelayCount: 0,
      subscribableRelayCount: 0,
      recoveryAttemptCount: 2,
      recoveryReasonCode: "recovery_exhausted",
    })).toBe("offline");
  });

  it("defers recovery when beforeRecovery handles primary failover", async () => {
    const controller = createLegacyRelayRecoveryController();
    const pool = createPool();
    const beforeRecovery = vi.fn(() => true);
    controller.configure({
      pool,
      enabledRelayUrls: ["ws://localhost:7000", "wss://relay.damus.io"],
      beforeRecovery,
    });

    vi.setSystemTime(new Date("2026-01-01T00:00:09.000Z"));
    await controller.triggerRecovery("no_writable_relays");

    expect(beforeRecovery).toHaveBeenCalled();
    expect(pool.reconnectAll).not.toHaveBeenCalled();
  });

  it("triggers reconnect on the first recovery attempt", async () => {
    const controller = createLegacyRelayRecoveryController();
    const pool = createPool();
    controller.configure({ pool, enabledRelayUrls: ["wss://relay.one"] });

    await controller.triggerRecovery("no_writable_relays");
    expect(pool.reconnectAll).toHaveBeenCalledTimes(1);
    expect(pool.reconnectAll).toHaveBeenLastCalledWith({ force: true });
  });

  it("exhausts cyclic no_writable_relays recovery after two full cycles", async () => {
    const controller = createLegacyRelayRecoveryController();
    const pool = createPool();
    controller.configure({ pool, enabledRelayUrls: ["wss://relay.one"] });

    const baseMs = new Date("2026-01-01T00:00:09.000Z").getTime();
    let last: Awaited<ReturnType<typeof controller.triggerRecovery>> | undefined;
    for (let i = 1; i <= relayRecoveryInternals.MAX_CYCLIC_RECOVERY_TRIGGERS; i += 1) {
      vi.setSystemTime(new Date(baseMs + i * 9_000));
      last = await controller.triggerRecovery("no_writable_relays");
    }

    expect(last).toBeDefined();
    expect(last!.currentAction).toBe("subsystem_reset");
    expect(last!.recoveryReasonCode).toBe("no_writable_relays");

    vi.setSystemTime(new Date(baseMs + 7 * 9_000));
    const exhausted = await controller.triggerRecovery("no_writable_relays");
    expect(exhausted.recoveryReasonCode).toBe("recovery_exhausted");
    expect(exhausted.readiness).toBe("offline");
    expect(exhausted.currentAction).toBeUndefined();
    expect(pool.reconnectAll).toHaveBeenCalledTimes(2);
    expect(pool.resubscribeAll).toHaveBeenCalledTimes(2);
    expect(pool.recycle).toHaveBeenCalledTimes(2);

    vi.mocked(pool.reconnectAll).mockClear();
    vi.setSystemTime(new Date(baseMs + 8 * 9_000));
    await controller.triggerRecovery("no_writable_relays");
    expect(pool.reconnectAll).not.toHaveBeenCalled();
  });

  it("escalates non-no_writable relays recoveries to reload_required when exhausted", async () => {
    const controller = createLegacyRelayRecoveryController();
    const pool = createPool();
    controller.configure({ pool, enabledRelayUrls: [] });

    const baseMs = new Date("2026-01-01T00:00:00.000Z").getTime();
    let last: Awaited<ReturnType<typeof controller.triggerRecovery>> | undefined;
    for (let i = 1; i <= 9; i += 1) {
      vi.setSystemTime(new Date(baseMs + i * 9_000));
      last = await controller.triggerRecovery("manual");
    }

    expect(last).toBeDefined();
    expect(last!.currentAction).toBe("reload_required");
    expect(last!.recoveryReasonCode).toBe("recovery_exhausted");
  });

  it("maps manual recovery to cyclic no_writable_relays until exhaustion", async () => {
    const controller = createLegacyRelayRecoveryController();
    const pool = createPool();
    controller.configure({ pool, enabledRelayUrls: ["wss://relay.one"] });

    const baseMs = new Date("2026-01-01T00:00:09.000Z").getTime();
    let last: Awaited<ReturnType<typeof controller.triggerRecovery>> | undefined;
    for (let i = 1; i <= relayRecoveryInternals.MAX_CYCLIC_RECOVERY_TRIGGERS; i += 1) {
      vi.setSystemTime(new Date(baseMs + i * 9_000));
      last = await controller.triggerRecovery("manual");
      expect(last!.recoveryReasonCode).toBe("no_writable_relays");
    }

    vi.setSystemTime(new Date(baseMs + 7 * 9_000));
    const exhausted = await controller.triggerRecovery("manual");
    expect(exhausted.recoveryReasonCode).toBe("recovery_exhausted");
    expect(exhausted.readiness).toBe("offline");

    vi.setSystemTime(new Date(baseMs + 8 * 9_000));
    const manualRetry = await controller.triggerRecovery("manual");
    expect(manualRetry.recoveryReasonCode).toBe("no_writable_relays");
    expect(manualRetry.currentAction).toBe("reconnect");
    expect(pool.reconnectAll).toHaveBeenCalledTimes(3);
  });

  it("clears recovery_exhausted when a writable relay returns", () => {
    const controller = createLegacyRelayRecoveryController();
    const pool = createPool();
    controller.configure({ pool, enabledRelayUrls: ["wss://relay.one"] });

    const baseMs = new Date("2026-01-01T00:00:09.000Z").getTime();
    for (let i = 1; i <= relayRecoveryInternals.MAX_CYCLIC_RECOVERY_TRIGGERS + 1; i += 1) {
      vi.setSystemTime(new Date(baseMs + i * 9_000));
      void controller.triggerRecovery("no_writable_relays");
    }
    expect(controller.getRecoverySnapshot().recoveryReasonCode).toBe("recovery_exhausted");
    expect(controller.getRecoverySnapshot().readiness).toBe("offline");

    vi.mocked(pool.getWritableRelaySnapshot).mockReturnValue({
      atUnixMs: Date.now(),
      configuredRelayUrls: ["ws://localhost:7000"],
      writableRelayUrls: ["ws://localhost:7000"],
      totalRelayCount: 1,
      openRelayCount: 1,
      relayCircuitStates: { "ws://localhost:7000": "healthy" },
    });
    vi.mocked(pool.getTransportActivitySnapshot).mockReturnValue({
      lastInboundMessageAtUnixMs: Date.now(),
      lastInboundEventAtUnixMs: Date.now(),
      lastSuccessfulPublishAtUnixMs: undefined,
      writableRelayCount: 1,
      subscribableRelayCount: 1,
      writeBlockedRelayCount: 0,
      coolingDownRelayCount: 0,
      fallbackRelayUrls: [],
      fallbackWritableRelayCount: 0,
    });

    const recovered = controller.refreshSnapshot();
    expect(recovered.recoveryReasonCode).toBeUndefined();
    expect(recovered.readiness).toBe("healthy");
    expect(recovered.recoveryAttemptCount).toBe(0);
  });

  it("treats control chatter without event freshness as stale subscription risk", async () => {
    const controller = createLegacyRelayRecoveryController();
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
      fallbackWritableRelayCount: 0,
    });

    controller.configure({ pool, enabledRelayUrls: ["wss://relay.one"] });
    controller.startWarmup();
    await controller.triggerRecovery("manual");
    expect(pool.reconnectAll).toHaveBeenCalledTimes(1);
    expect(pool.reconnectAll).toHaveBeenLastCalledWith({ force: true });

    vi.setSystemTime(Date.now() + 46_000);
    await vi.advanceTimersByTimeAsync(12_000);

    expect(pool.reconnectAll).toHaveBeenCalledTimes(2);
    expect(pool.reconnectAll).toHaveBeenNthCalledWith(2, { force: true });
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
      fallbackWritableRelayCount: 0,
      subscribableRelayCount: 1,
      writeBlockedRelayCount: 1,
      coolingDownRelayCount: 0,
      eventFreshnessReferenceUnixMs: undefined,
      nowUnixMs: 100_000,
    })).toBe("write_queue_blocked");
    expect(relayRecoveryInternals.resolveWatchdogRecoveryReason({
      enabledRelayCount: 1,
      writableRelayCount: 0,
      fallbackWritableRelayCount: 0,
      subscribableRelayCount: 0,
      writeBlockedRelayCount: 0,
      coolingDownRelayCount: 1,
      eventFreshnessReferenceUnixMs: undefined,
      nowUnixMs: 100_000,
    })).toBe("cooldown_active");
    expect(relayRecoveryInternals.resolveWatchdogRecoveryReason({
      enabledRelayCount: 1,
      writableRelayCount: 1,
      fallbackWritableRelayCount: 0,
      subscribableRelayCount: 1,
      writeBlockedRelayCount: 0,
      coolingDownRelayCount: 0,
      eventFreshnessReferenceUnixMs: 100_000 - 60_000,
      nowUnixMs: 100_000,
    })).toBe("stale_event_flow");
    expect(relayRecoveryInternals.resolveManualRecoveryReason({
      requestedReason: "manual",
      enabledRelayCount: 1,
      snapshot: {
        ...relayRecoveryInternals.createDefaultSnapshot(),
        readiness: "offline",
        writableRelayCount: 0,
        fallbackWritableRelayCount: 0,
        subscribableRelayCount: 0,
        writeBlockedRelayCount: 0,
        coolingDownRelayCount: 0,
      },
    })).toBe("no_writable_relays");
    expect(relayRecoveryInternals.resolveWatchdogRecoveryReason({
      enabledRelayCount: 1,
      writableRelayCount: 0,
      fallbackWritableRelayCount: 1,
      subscribableRelayCount: 1,
      writeBlockedRelayCount: 0,
      coolingDownRelayCount: 1,
      eventFreshnessReferenceUnixMs: undefined,
      nowUnixMs: 100_000,
    })).toBeUndefined();
    expect(relayRecoveryInternals.resolveManualRecoveryReason({
      requestedReason: "manual",
      enabledRelayCount: 1,
      snapshot: {
        ...relayRecoveryInternals.createDefaultSnapshot(),
        readiness: "degraded",
        writableRelayCount: 0,
        fallbackWritableRelayCount: 1,
        subscribableRelayCount: 1,
      },
    })).toBe("manual");
    expect(relayRecoveryInternals.resolveAttemptBaseline({
      reason: "no_writable_relays",
      previousReason: "manual",
      previousAttemptCount: 2,
    })).toBe(0);
    expect(relayRecoveryInternals.resolveAttemptBaseline({
      reason: "write_queue_blocked",
      previousReason: "cooldown_active",
      previousAttemptCount: 2,
    })).toBe(2);
  });
});
