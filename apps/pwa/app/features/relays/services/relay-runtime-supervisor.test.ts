import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EnhancedRelayPoolResult } from "@/app/features/relays/hooks/enhanced-relay-pool";
import { createRelayRuntimeSupervisor } from "./relay-runtime-supervisor";
import { relayTransportJournal } from "./relay-transport-journal";
import { relayResilienceObservability } from "./relay-resilience-observability";

const createPool = (params?: Readonly<{
  writableRelayUrls?: ReadonlyArray<string>;
  subscribableRelayCount?: number;
  activeSubscriptionCount?: number;
}>): EnhancedRelayPoolResult => ({
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
  isConnected: vi.fn(() => (params?.writableRelayUrls?.length ?? 0) > 0),
  waitForConnection: vi.fn(async () => (params?.writableRelayUrls?.length ?? 0) > 0),
  waitForScopedConnection: vi.fn(async () => (params?.writableRelayUrls?.length ?? 0) > 0),
  getWritableRelaySnapshot: vi.fn(() => ({
    atUnixMs: 1000,
    configuredRelayUrls: ["wss://relay.one"],
    writableRelayUrls: [...(params?.writableRelayUrls ?? [])],
    totalRelayCount: 1,
    openRelayCount: params?.writableRelayUrls?.length ?? 0,
    relayCircuitStates: { "wss://relay.one": "healthy" as const },
  })),
  getTransportActivitySnapshot: vi.fn(() => ({
    lastInboundMessageAtUnixMs: undefined,
    lastInboundEventAtUnixMs: undefined,
    lastSuccessfulPublishAtUnixMs: undefined,
    writableRelayCount: params?.writableRelayUrls?.length ?? 0,
    subscribableRelayCount: params?.subscribableRelayCount ?? 0,
    writeBlockedRelayCount: 0,
    coolingDownRelayCount: 0,
    fallbackRelayUrls: [],
    fallbackWritableRelayCount: 0,
  })),
  getActiveSubscriptionCount: vi.fn(() => params?.activeSubscriptionCount ?? 0),
  dispose: vi.fn(),
});

describe("relay-runtime-supervisor", () => {
  beforeEach(() => {
    relayTransportJournal.resetForTests();
    relayResilienceObservability.resetForTests(0);
  });

  it("publishes a profile-scoped healthy snapshot", () => {
    relayTransportJournal.setSubscriptionState({
      desiredSubscriptionCount: 2,
      pendingSubscriptionBatchCount: 1,
    });
    relayTransportJournal.setPendingOutbound("profile_transport_queue:profile-b", 3);
    relayTransportJournal.markSubscriptionReplayAttempt({
      reasonCode: "manual",
      detail: "active=2",
    });
    relayTransportJournal.markSubscriptionReplayResult({
      reasonCode: "manual",
      result: "ok",
      detail: "sent=2;skipped_empty=0",
    });

    const supervisor = createRelayRuntimeSupervisor();
    const pool = createPool({
      writableRelayUrls: ["wss://relay.one"],
      subscribableRelayCount: 1,
      activeSubscriptionCount: 2,
    });

    supervisor.configure({
      pool,
      enabledRelayUrls: ["wss://relay.one"],
      scope: {
        windowLabel: "profile-b",
        profileId: "profile-b",
        publicKeyHex: "b".repeat(64),
      },
    });

    const snapshot = supervisor.refresh();
    expect(snapshot.phase).toBe("healthy");
    expect(snapshot.windowLabel).toBe("profile-b");
    expect(snapshot.profileId).toBe("profile-b");
    expect(snapshot.publicKeyHexSummary).toBe("bbbbbbbbbbbb");
    expect(snapshot.activeSubscriptionCount).toBe(2);
    expect(snapshot.pendingOutboundCount).toBe(3);
    expect(snapshot.pendingSubscriptionBatchCount).toBe(1);
    expect(snapshot.lastSubscriptionReplayReasonCode).toBe("manual");
    expect(snapshot.lastSubscriptionReplayResult).toBe("ok");
  });

  it("captures privacy-routed transport mode in the runtime snapshot", () => {
    const supervisor = createRelayRuntimeSupervisor();
    const pool = createPool({
      writableRelayUrls: ["wss://relay.one"],
      subscribableRelayCount: 1,
      activeSubscriptionCount: 1,
    });

    supervisor.configure({
      pool,
      enabledRelayUrls: ["wss://relay.one"],
      scope: {
        windowLabel: "desktop-main",
        profileId: "default",
        transportRoutingMode: "privacy_routed",
        transportProxySummary: "socks5h://127.0.0.1:9050",
      },
    });

    const snapshot = supervisor.refresh();
    expect(snapshot.transportRoutingMode).toBe("privacy_routed");
    expect(snapshot.transportProxySummary).toBe("socks5h://127.0.0.1:9050");
  });

  it("tracks reconnect recovery and resets on dispose", async () => {
    const supervisor = createRelayRuntimeSupervisor();
    const pool = createPool({
      writableRelayUrls: [],
      subscribableRelayCount: 0,
      activeSubscriptionCount: 1,
    });

    supervisor.configure({
      pool,
      enabledRelayUrls: ["wss://relay.one"],
      scope: {
        windowLabel: "main",
        profileId: "default",
      },
    });

    const recoverySnapshot = await supervisor.triggerRecovery("manual");
    expect(pool.reconnectAll).toHaveBeenCalledTimes(1);
    expect(recoverySnapshot.phase).toBe("recovering");
    expect(recoverySnapshot.recoveryStage).toBe("connect_relays");

    supervisor.dispose();
    const disposedSnapshot = supervisor.getSnapshot();
    expect(disposedSnapshot.phase).toBe("booting");
    expect(disposedSnapshot.activeSubscriptionCount).toBe(0);
  });

  it("transitions to fatal when non-cyclic recovery attempts are exhausted", async () => {
    vi.useFakeTimers();
    try {
      const supervisor = createRelayRuntimeSupervisor();
      const pool = createPool({
        writableRelayUrls: [],
        subscribableRelayCount: 0,
        activeSubscriptionCount: 1,
      });
      vi.mocked(pool.waitForConnection).mockImplementation(() => new Promise<boolean>(() => {}));

      supervisor.configure({
        pool,
        enabledRelayUrls: [],
        scope: {
          windowLabel: "main",
          profileId: "default",
        },
      });

      vi.setSystemTime(new Date("2026-01-01T00:00:09.000Z"));
      await supervisor.triggerRecovery("manual");
      vi.setSystemTime(new Date("2026-01-01T00:00:18.000Z"));
      await supervisor.triggerRecovery("manual");
      vi.setSystemTime(new Date("2026-01-01T00:00:27.000Z"));
      await supervisor.triggerRecovery("manual");
      vi.setSystemTime(new Date("2026-01-01T00:00:36.000Z"));
      await supervisor.triggerRecovery("manual");
      vi.setSystemTime(new Date("2026-01-01T00:00:45.000Z"));
      const snapshot = await supervisor.triggerRecovery("manual");

      expect(snapshot.phase).toBe("fatal");
      expect(snapshot.recoveryStage).toBe("subsystem_recycle");
      expect(snapshot.recoveryReasonCode).toBe("recovery_exhausted");
    } finally {
      vi.useRealTimers();
    }
  });

  it("refreshes pending outbound from transport journal updates", () => {
    const supervisor = createRelayRuntimeSupervisor();
    const pool = createPool({
      writableRelayUrls: ["wss://relay.one"],
      subscribableRelayCount: 1,
      activeSubscriptionCount: 1,
    });
    supervisor.configure({
      pool,
      enabledRelayUrls: ["wss://relay.one"],
      scope: {
        windowLabel: "main",
        profileId: "default",
      },
    });

    relayTransportJournal.setPendingOutbound("profile_transport_queue:default", 2);
    relayTransportJournal.setPendingOutbound("contact_request_outbox", 1);

    const snapshot = supervisor.getSnapshot();
    expect(snapshot.pendingOutboundCount).toBe(3);
  });

  it("records replay outcomes into relay resilience observability", () => {
    relayTransportJournal.markSubscriptionReplayResult({
      reasonCode: "manual",
      result: "partial",
      detail: "sent=1;failed=1",
    });

    const supervisor = createRelayRuntimeSupervisor();
    const pool = createPool({
      writableRelayUrls: ["wss://relay.one"],
      subscribableRelayCount: 1,
      activeSubscriptionCount: 1,
    });
    supervisor.configure({
      pool,
      enabledRelayUrls: ["wss://relay.one"],
      scope: {
        windowLabel: "main",
        profileId: "default",
      },
    });

    const metrics = relayResilienceObservability.getSnapshot();
    expect(metrics.replay.partialCount).toBeGreaterThanOrEqual(1);
  });
});
