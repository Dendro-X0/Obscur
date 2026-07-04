import {
  buildTransportSnapshot,
  type TransportAdapterMetrics,
  type TransportPhase,
  type TransportRecoveryState,
  type TransportSnapshot,
} from "@obscur/transport-engine";
import { buildTransportKernelSupervisorEvidence } from "@/app/features/transport-kernel/transport-kernel-engine-port";
import { isTransportKernelAuthority } from "@/app/features/transport-kernel/transport-kernel-policy";

export type SupervisorRecoveryRelayEvidence = Readonly<{
  activePoolRelayUrls: ReadonlyArray<string>;
  supervisorRelayUrlCandidates: ReadonlyArray<string>;
  engineConfiguredRelayUrls: ReadonlyArray<string>;
  userEnabledRelayUrls: ReadonlyArray<string>;
  engineOnlyRelayUrls: ReadonlyArray<string>;
  engineCheckpointRelayUrls: ReadonlyArray<string>;
  engineRelayCheckpointCount: number;
  supervisorCandidateRelayCount: number;
  hasEngineOnlyCandidates: boolean;
  hasCheckpointEvidence: boolean;
}>;

const trimRelayUrl = (url: string): string => url.trim();

export const resolveSupervisorRecoveryRelayEvidence = (params: Readonly<{
  activePoolRelayUrls: ReadonlyArray<string>;
  supervisorRelayUrlCandidates: ReadonlyArray<string>;
  engineConfiguredRelayUrls: ReadonlyArray<string>;
  userEnabledRelayUrls: ReadonlyArray<string>;
  engineCheckpointRelayUrls: ReadonlyArray<string>;
  engineRelayCheckpointCount: number;
}>): SupervisorRecoveryRelayEvidence => {
  const userRelaySet = new Set(
    params.userEnabledRelayUrls.map(trimRelayUrl).filter((url) => url.length > 0),
  );
  const engineOnlyRelayUrls = params.engineConfiguredRelayUrls
    .map(trimRelayUrl)
    .filter((url) => url.length > 0 && !userRelaySet.has(url));
  const supervisorRelayUrlCandidates = params.supervisorRelayUrlCandidates
    .map(trimRelayUrl)
    .filter((url) => url.length > 0);

  const engineCheckpointRelayUrls = params.engineCheckpointRelayUrls
    .map(trimRelayUrl)
    .filter((url) => url.length > 0);

  return {
    activePoolRelayUrls: params.activePoolRelayUrls.map(trimRelayUrl).filter((url) => url.length > 0),
    supervisorRelayUrlCandidates,
    engineConfiguredRelayUrls: params.engineConfiguredRelayUrls
      .map(trimRelayUrl)
      .filter((url) => url.length > 0),
    userEnabledRelayUrls: params.userEnabledRelayUrls
      .map(trimRelayUrl)
      .filter((url) => url.length > 0),
    engineOnlyRelayUrls,
    engineCheckpointRelayUrls,
    engineRelayCheckpointCount: params.engineRelayCheckpointCount,
    supervisorCandidateRelayCount: supervisorRelayUrlCandidates.length,
    hasEngineOnlyCandidates: engineOnlyRelayUrls.length > 0,
    hasCheckpointEvidence: engineCheckpointRelayUrls.length > 0,
  };
};

/** Relay count for runtime phase when active pool is empty but supervisor has failover candidates. */
export const resolveRelayRuntimePhaseRelayCount = (params: Readonly<{
  activePoolRelayCount: number;
  supervisorCandidateRelayCount: number;
}>): number => (
  params.activePoolRelayCount > 0
    ? params.activePoolRelayCount
    : params.supervisorCandidateRelayCount
);

export const buildSupervisorTransportEvidence = (params: Readonly<{
  scope: Readonly<{ profileId: string; windowLabel: string }>;
  evidence: SupervisorRecoveryRelayEvidence;
  metrics: TransportAdapterMetrics;
  activeSubscriptionCount: number;
  pendingOutboundCount: number;
  recoveryState?: Partial<TransportRecoveryState>;
  previous?: TransportSnapshot;
  browserOffline?: boolean;
}>): TransportSnapshot => {
  if (isTransportKernelAuthority()) {
    const kernelSnapshot = buildTransportKernelSupervisorEvidence({
      scope: params.scope,
      evidence: params.evidence,
      metrics: params.metrics,
      activeSubscriptionCount: params.activeSubscriptionCount,
      pendingOutboundCount: params.pendingOutboundCount,
      recoveryState: params.recoveryState,
      browserOffline: params.browserOffline,
    });
    if (kernelSnapshot) {
      return kernelSnapshot;
    }
  }
  return buildTransportSnapshot({
    scope: {
      profileId: params.scope.profileId,
      windowLabel: params.scope.windowLabel,
    },
    revision: (params.previous?.revision ?? 0) + 1,
    enabledRelayUrls: params.evidence.supervisorRelayUrlCandidates.length > 0
      ? params.evidence.supervisorRelayUrlCandidates
      : params.evidence.activePoolRelayUrls,
    metrics: {
      ...params.metrics,
      enabledRelayCount: resolveRelayRuntimePhaseRelayCount({
        activePoolRelayCount: params.evidence.activePoolRelayUrls.length,
        supervisorCandidateRelayCount: params.evidence.supervisorCandidateRelayCount,
      }),
    },
    activeSubscriptionCount: params.activeSubscriptionCount,
    pendingOutboundCount: params.pendingOutboundCount,
    recoveryState: params.recoveryState,
    previous: params.previous,
    browserOffline: params.browserOffline,
  });
};

export const readTransportEvidencePhase = (snapshot: TransportSnapshot): TransportPhase => snapshot.phase;
