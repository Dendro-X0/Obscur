import { describe, expect, it } from "vitest";
import {
  buildSupervisorTransportEvidence,
  resolveRelayRuntimePhaseRelayCount,
  resolveSupervisorRecoveryRelayEvidence,
} from "./transport-relay-supervisor-evidence";

describe("transport-relay-supervisor-evidence", () => {
  it("resolves engine-only relay candidates from persistence evidence", () => {
    expect(resolveSupervisorRecoveryRelayEvidence({
      activePoolRelayUrls: [],
      supervisorRelayUrlCandidates: ["wss://relay.one", "wss://team.relay"],
      engineConfiguredRelayUrls: ["wss://team.relay"],
      userEnabledRelayUrls: ["wss://relay.one"],
      engineCheckpointRelayUrls: ["wss://team.relay"],
      engineRelayCheckpointCount: 1,
    })).toEqual({
      activePoolRelayUrls: [],
      supervisorRelayUrlCandidates: ["wss://relay.one", "wss://team.relay"],
      engineConfiguredRelayUrls: ["wss://team.relay"],
      userEnabledRelayUrls: ["wss://relay.one"],
      engineOnlyRelayUrls: ["wss://team.relay"],
      engineCheckpointRelayUrls: ["wss://team.relay"],
      engineRelayCheckpointCount: 1,
      supervisorCandidateRelayCount: 2,
      hasEngineOnlyCandidates: true,
      hasCheckpointEvidence: true,
    });
  });

  it("uses supervisor candidates for phase relay count when active pool is empty", () => {
    expect(resolveRelayRuntimePhaseRelayCount({
      activePoolRelayCount: 0,
      supervisorCandidateRelayCount: 2,
    })).toBe(2);
    expect(resolveRelayRuntimePhaseRelayCount({
      activePoolRelayCount: 1,
      supervisorCandidateRelayCount: 2,
    })).toBe(1);
  });

  it("builds transport snapshot evidence from supervisor relay metrics", () => {
    const evidence = resolveSupervisorRecoveryRelayEvidence({
      activePoolRelayUrls: [],
      supervisorRelayUrlCandidates: ["wss://team.relay"],
      engineConfiguredRelayUrls: ["wss://team.relay"],
      userEnabledRelayUrls: [],
      engineCheckpointRelayUrls: ["wss://team.relay"],
      engineRelayCheckpointCount: 1,
    });
    const snapshot = buildSupervisorTransportEvidence({
      scope: { profileId: "default", windowLabel: "main" },
      evidence,
      metrics: {
        enabledRelayCount: 0,
        writableRelayCount: 0,
        fallbackWritableRelayCount: 0,
        subscribableRelayCount: 0,
        writeBlockedRelayCount: 0,
        coolingDownRelayCount: 0,
        fallbackRelayUrls: [],
      },
      activeSubscriptionCount: 0,
      pendingOutboundCount: 0,
    });

    expect(snapshot.scope.profileId).toBe("default");
    expect(snapshot.enabledRelayUrls).toEqual(["wss://team.relay"]);
    expect(snapshot.phase).toBe("connecting");
    expect(snapshot.recovery.readiness).toBe("offline");
  });
});
