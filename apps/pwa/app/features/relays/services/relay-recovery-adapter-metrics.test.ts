import { describe, expect, it, vi } from "vitest";
import {
  extractRelayRecoveryAdapterMetrics,
  resolveRecoveryWritableRelayCount,
} from "./relay-recovery-adapter-metrics";
import type { RelayPoolRuntime } from "./relay-pool-runtime-port";

describe("resolveRecoveryWritableRelayCount", () => {
  it("prefers open sockets and writable urls over lagging activity count", () => {
    expect(resolveRecoveryWritableRelayCount({
      writableRelayUrls: ["ws://localhost:7000"],
      openPoolRelayUrls: ["ws://localhost:7000"],
      activityWritableRelayCount: 0,
    })).toBe(1);
  });
});

describe("extractRelayRecoveryAdapterMetrics", () => {
  it("counts open in-pool sockets as writable and subscribable", () => {
    const pool = {
      connections: [{ url: "ws://localhost:7000", status: "open" }],
      healthMetrics: [],
      getWritableRelaySnapshot: () => ({
        atUnixMs: Date.now(),
        configuredRelayUrls: ["ws://localhost:7000"],
        writableRelayUrls: ["ws://localhost:7000"],
        totalRelayCount: 1,
        openRelayCount: 1,
      }),
      getTransportActivitySnapshot: () => ({
        writableRelayCount: 0,
        subscribableRelayCount: 0,
        writeBlockedRelayCount: 0,
        coolingDownRelayCount: 0,
        fallbackRelayUrls: [],
        fallbackWritableRelayCount: 0,
        publishReadyRelayUrls: [],
      }),
    } as unknown as RelayPoolRuntime;

    const metrics = extractRelayRecoveryAdapterMetrics({
      pool,
      enabledRelayUrls: ["ws://localhost:7000"],
    });

    expect(metrics.writableRelayCount).toBe(1);
    expect(metrics.subscribableRelayCount).toBe(1);
  });

  it("does not invent writable from closed sockets", () => {
    const pool = {
      connections: [{ url: "ws://localhost:7000", status: "connecting" }],
      healthMetrics: [],
      getWritableRelaySnapshot: vi.fn(() => ({
        atUnixMs: Date.now(),
        configuredRelayUrls: ["ws://localhost:7000"],
        writableRelayUrls: [],
        totalRelayCount: 1,
        openRelayCount: 0,
      })),
      getTransportActivitySnapshot: () => ({
        writableRelayCount: 0,
        subscribableRelayCount: 0,
        writeBlockedRelayCount: 0,
        coolingDownRelayCount: 0,
        fallbackRelayUrls: [],
        fallbackWritableRelayCount: 0,
      }),
    } as unknown as RelayPoolRuntime;

    const metrics = extractRelayRecoveryAdapterMetrics({
      pool,
      enabledRelayUrls: ["ws://localhost:7000"],
    });

    expect(metrics.writableRelayCount).toBe(0);
    expect(metrics.subscribableRelayCount).toBe(0);
  });
});
