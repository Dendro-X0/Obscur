import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TransportSnapshot } from "@obscur/transport-engine";

vi.mock("./transport-kernel-policy", () => ({
  isTransportKernelAuthority: vi.fn(() => false),
}));

import { isTransportKernelAuthority } from "./transport-kernel-policy";
import {
  resolveLegacyRelayRuntimePhase,
  resolvePublishedRelayRecoverySnapshot,
  shouldRunLegacyRelayRecoveryOrchestration,
  shouldSubscribeLegacyRelayRecoverySnapshot,
  executeTransportKernelPoolRecovery,
} from "./transport-kernel-recovery-port";

const legacyRecovery = {
  readiness: "healthy" as const,
  writableRelayCount: 1,
  fallbackWritableRelayCount: 0,
  subscribableRelayCount: 1,
  writeBlockedRelayCount: 0,
  coolingDownRelayCount: 0,
  recoveryAttemptCount: 0,
  fallbackRelayUrls: [],
};

const transportSnapshot = (readiness: TransportSnapshot["recovery"]["readiness"]): TransportSnapshot => ({
  scope: { profileId: "default", windowLabel: "main" },
  revision: 1,
  phase: readiness === "healthy" ? "healthy" : "connecting",
  enabledRelayUrls: ["wss://relay.one"],
  metrics: {
    enabledRelayCount: 1,
    writableRelayCount: 1,
    fallbackWritableRelayCount: 0,
    subscribableRelayCount: 1,
    writeBlockedRelayCount: 0,
    coolingDownRelayCount: 0,
    fallbackRelayUrls: [],
  },
  recovery: {
    ...legacyRecovery,
    readiness,
  },
  activeSubscriptionCount: 1,
  pendingOutboundCount: 0,
  updatedAtUnixMs: 1,
});

describe("transport-kernel-recovery-port", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTransportKernelAuthority).mockReturnValue(false);
  });

  it("subscribes to legacy recovery snapshots only when authority is inactive", () => {
    expect(shouldSubscribeLegacyRelayRecoverySnapshot()).toBe(true);
    vi.mocked(isTransportKernelAuthority).mockReturnValue(true);
    expect(shouldSubscribeLegacyRelayRecoverySnapshot()).toBe(false);
  });

  it("suppresses legacy recovery orchestration when authority is active", () => {
    expect(shouldRunLegacyRelayRecoveryOrchestration()).toBe(true);
    vi.mocked(isTransportKernelAuthority).mockReturnValue(true);
    expect(shouldRunLegacyRelayRecoveryOrchestration()).toBe(false);
  });

  it("executes direct pool recovery without legacy state machine", async () => {
    const pool = {
      reconnectAll: vi.fn(),
      resubscribeAll: vi.fn(),
      recycle: vi.fn(async () => {}),
    } as never;

    await executeTransportKernelPoolRecovery({ pool, reason: "stale_event_flow" });
    expect(pool.resubscribeAll).toHaveBeenCalledTimes(1);
    expect(pool.reconnectAll).not.toHaveBeenCalled();

    await executeTransportKernelPoolRecovery({ pool, reason: "no_writable_relays" });
    expect(pool.reconnectAll).toHaveBeenCalledWith({ force: true });
  });

  it("publishes transport-engine recovery when authority is active", () => {
    vi.mocked(isTransportKernelAuthority).mockReturnValue(true);
    const snapshot = transportSnapshot("degraded");
    expect(resolvePublishedRelayRecoverySnapshot({
      legacyRecovery: legacyRecovery,
      transportSnapshot: snapshot,
    })).toEqual(snapshot.recovery);
  });

  it("keeps legacy phase classifier for non-authority runtimes", () => {
    expect(resolveLegacyRelayRuntimePhase({
      recovery: legacyRecovery,
      enabledRelayCount: 1,
    })).toBe("healthy");
  });
});
