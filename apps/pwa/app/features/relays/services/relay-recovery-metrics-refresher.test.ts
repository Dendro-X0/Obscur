import { describe, expect, it, vi } from "vitest";
import { createRelayRecoveryMetricsRefresher } from "./relay-recovery-metrics-refresher";

const createPool = () => ({
  healthMetrics: [],
  getWritableRelaySnapshot: vi.fn(() => ({
    writableRelayUrls: ["wss://relay.one"],
  })),
  getTransportActivitySnapshot: vi.fn(() => ({
    writableRelayCount: 1,
    subscribableRelayCount: 1,
    writeBlockedRelayCount: 0,
    coolingDownRelayCount: 0,
    fallbackRelayUrls: [],
    fallbackWritableRelayCount: 0,
  })),
});

describe("relay-recovery-metrics-refresher", () => {
  it("refreshes transport-engine recovery snapshot without orchestration side effects", () => {
    const pool = createPool();
    const refresher = createRelayRecoveryMetricsRefresher();
    refresher.configure({
      pool: pool as never,
      enabledRelayUrls: ["wss://relay.one"],
    });

    const snapshot = refresher.refreshSnapshot();
    expect(snapshot.readiness).toBe("healthy");
    expect(snapshot.writableRelayCount).toBe(1);
    expect(snapshot.recoveryAttemptCount).toBe(0);
    expect(snapshot.currentAction).toBeUndefined();
  });

  it("no-ops legacy orchestration hooks", async () => {
    const refresher = createRelayRecoveryMetricsRefresher();
    refresher.startWarmup();
    const unsubscribe = refresher.subscribeRecoveryState(() => {});
    unsubscribe();
    await expect(refresher.triggerRecovery("manual")).resolves.toBeDefined();
  });
});
