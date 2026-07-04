import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TransportSnapshot } from "@obscur/transport-engine";

vi.mock("./transport-kernel-policy", () => ({
  isTransportKernelAuthority: vi.fn(() => false),
}));

import { isTransportKernelAuthority } from "./transport-kernel-policy";
import { resolveRelayRuntimePhaseForTransportKernel } from "./transport-kernel-snapshot-port";

const transportSnapshot = (phase: TransportSnapshot["phase"]): TransportSnapshot => ({
  scope: { profileId: "default", windowLabel: "main" },
  revision: 1,
  phase,
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
    readiness: "healthy",
    recoveryAttemptCount: 0,
  },
  activeSubscriptionCount: 1,
  pendingOutboundCount: 0,
  updatedAtUnixMs: 1,
});

describe("transport-kernel-snapshot-port", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTransportKernelAuthority).mockReturnValue(false);
  });

  it("keeps legacy phase when transport-kernel authority is inactive", () => {
    expect(resolveRelayRuntimePhaseForTransportKernel({
      legacyPhase: "connecting",
      transportSnapshot: transportSnapshot("healthy"),
    })).toBe("connecting");
  });

  it("uses transport-engine phase when transport-kernel authority is active", () => {
    vi.mocked(isTransportKernelAuthority).mockReturnValue(true);
    expect(resolveRelayRuntimePhaseForTransportKernel({
      legacyPhase: "connecting",
      transportSnapshot: transportSnapshot("healthy"),
    })).toBe("healthy");
  });
});
