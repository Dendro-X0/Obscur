import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => false),
}));

vi.mock("@/app/engine-lab/engine-lab-policy", () => ({
  isEngineLabStrictMode: vi.fn(() => false),
}));

import { isEngineLabStrictMode } from "@/app/engine-lab/engine-lab-policy";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import {
  buildTransportKernelSupervisorEvidence,
  getTransportKernelEngine,
  resetTransportKernelEnginesForTests,
} from "./transport-kernel-engine-port";

describe("transport-kernel-engine-port", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTransportKernelEnginesForTests();
    vi.mocked(isEngineLabStrictMode).mockReturnValue(false);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
  });

  it("returns null when transport-kernel authority is inactive", () => {
    expect(getTransportKernelEngine({ profileId: "default", windowLabel: "main" })).toBeNull();
  });

  it("owns headless transport-engine runtime on native authority", () => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    const engine = getTransportKernelEngine({ profileId: "default", windowLabel: "main" });
    expect(engine).not.toBeNull();
    expect(engine?.getSnapshot().scope.profileId).toBe("default");
    expect(getTransportKernelEngine({ profileId: "default", windowLabel: "main" })).toBe(engine);
  });

  it("builds supervisor evidence through headless engine applyAdapterMetrics", () => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    const snapshot = buildTransportKernelSupervisorEvidence({
      scope: { profileId: "default", windowLabel: "main" },
      evidence: {
        activePoolRelayUrls: ["wss://relay.one"],
        supervisorRelayUrlCandidates: ["wss://relay.one"],
        engineConfiguredRelayUrls: [],
        userEnabledRelayUrls: ["wss://relay.one"],
        engineOnlyRelayUrls: [],
        engineCheckpointRelayUrls: [],
        engineRelayCheckpointCount: 0,
        supervisorCandidateRelayCount: 1,
        hasEngineOnlyCandidates: false,
        hasCheckpointEvidence: false,
      },
      metrics: {
        enabledRelayCount: 1,
        writableRelayCount: 1,
        fallbackWritableRelayCount: 0,
        subscribableRelayCount: 1,
        writeBlockedRelayCount: 0,
        coolingDownRelayCount: 0,
        fallbackRelayUrls: [],
      },
      activeSubscriptionCount: 1,
      pendingOutboundCount: 0,
    });
    expect(snapshot?.phase).toBe("healthy");
    expect(snapshot?.revision).toBeGreaterThan(0);
  });
});
