import type { EngineScope } from "@obscur/engine-contracts";
import {
  createTransportEngine,
  type TransportAdapterMetrics,
  type TransportEngine,
  type TransportRecoveryState,
  type TransportSnapshot,
} from "@obscur/transport-engine";
import { isTransportKernelAuthority } from "./transport-kernel-policy";

type KernelSupervisorEvidenceInput = Readonly<{
  activePoolRelayUrls: ReadonlyArray<string>;
  supervisorRelayUrlCandidates: ReadonlyArray<string>;
  supervisorCandidateRelayCount: number;
}>;

const scopeKey = (scope: EngineScope): string => (
  `${scope.profileId.trim() || "default"}|${scope.windowLabel?.trim() || "main"}`
);

const engines = new Map<string, TransportEngine>();

/** Headless transport-engine runtime owner when transport-kernel authority is active. */
export const getTransportKernelEngine = (scope: EngineScope): TransportEngine | null => {
  if (!isTransportKernelAuthority()) {
    return null;
  }
  const key = scopeKey(scope);
  const existing = engines.get(key);
  if (existing) {
    return existing;
  }
  const engine = createTransportEngine({
    profileId: scope.profileId.trim() || "default",
    windowLabel: scope.windowLabel?.trim() || "main",
  });
  engines.set(key, engine);
  return engine;
};

export const buildTransportKernelSupervisorEvidence = (params: Readonly<{
  scope: Readonly<{ profileId: string; windowLabel: string }>;
  evidence: KernelSupervisorEvidenceInput;
  metrics: TransportAdapterMetrics;
  activeSubscriptionCount: number;
  pendingOutboundCount: number;
  recoveryState?: Partial<TransportRecoveryState>;
  browserOffline?: boolean;
}>): TransportSnapshot | null => {
  const engine = getTransportKernelEngine(params.scope);
  if (!engine) {
    return null;
  }
  const enabledRelayUrls = params.evidence.supervisorRelayUrlCandidates.length > 0
    ? params.evidence.supervisorRelayUrlCandidates
    : params.evidence.activePoolRelayUrls;
  const enabledRelayCount = params.evidence.activePoolRelayUrls.length > 0
    ? params.evidence.activePoolRelayUrls.length
    : params.evidence.supervisorCandidateRelayCount;
  return engine.applyAdapterMetrics(
    {
      ...params.metrics,
      enabledRelayCount,
    },
    {
      enabledRelayUrls,
      recoveryState: params.recoveryState,
      activeSubscriptionCount: params.activeSubscriptionCount,
      pendingOutboundCount: params.pendingOutboundCount,
      browserOffline: params.browserOffline,
    },
  );
};

export const resetTransportKernelEnginesForTests = (): void => {
  engines.clear();
};
