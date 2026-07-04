import type {
  ConduitDescriptor,
  ConduitRuntimeState,
  MeshPhase,
  MeshScopeReadiness,
  MeshSnapshot,
  MeshTorRuntimeState,
} from "@obscur/conduit-mesh-contracts";
import { deriveEffectiveNetworkPolicy, isTorPolicyConduit } from "@obscur/conduit-mesh-contracts";
import type { EngineScope } from "@obscur/engine-contracts";

import { classifyMeshReadiness } from "./classify-mesh-readiness";

const deriveDeploymentTier = (
  conduits: ReadonlyArray<ConduitDescriptor>,
): MeshSnapshot["deploymentTier"] => {
  if (conduits.some((c) => c.networkPolicy === "tor_required")) {
    return "experimental";
  }
  if (conduits.some((c) => c.trustTier === "operator_attested")) {
    return "private_trust";
  }
  return "minimal_infra";
};

const derivePhase = (readiness: MeshSnapshot["readiness"]): MeshPhase => {
  switch (readiness) {
    case "healthy":
      return "healthy";
    case "degraded":
      return "degraded";
    case "recovering":
      return "recovering";
    case "offline":
    default:
      return "offline";
  }
};

const buildScopeReadiness = (
  conduits: ReadonlyArray<ConduitRuntimeState>,
): ReadonlyArray<MeshScopeReadiness> => {
  const publishReady = conduits.filter((c) => (
    c.descriptor.enabled
    && c.descriptor.capabilities.includes("publish")
    && (c.health === "healthy" || c.health === "degraded")
  )).length;

  const scopes: Array<"dm" | "workspace" | "control"> = ["dm", "workspace", "control"];
  return scopes.map((messageScope) => ({
    messageScope,
    publishReadyCount: publishReady,
    requiredReadyCount: 1,
  }));
};

export type BuildMeshSnapshotParams = Readonly<{
  scope: EngineScope;
  revision: number;
  conduits: ReadonlyArray<ConduitRuntimeState>;
  torState: MeshTorRuntimeState;
  pendingOutboundCount: number;
  lastEvidenceAtUnixMs?: number;
  recoveryAttemptCount: number;
  recoveryReasonCode?: MeshSnapshot["recoveryReasonCode"];
  lastFailureReason?: string;
  updatedAtUnixMs: number;
}>;

export const buildMeshSnapshot = (params: BuildMeshSnapshotParams): MeshSnapshot => {
  const readiness = classifyMeshReadiness(params.conduits);
  const activeConduits = params.conduits.filter((c) => (
    c.health === "healthy" || c.health === "degraded"
  ));
  const degradedConduitIds = params.conduits
    .filter((c) => c.health === "degraded")
    .map((c) => c.descriptor.conduitId);
  const blockedConduitIds = params.conduits
    .filter((c) => c.health === "blocked" || c.health === "offline")
    .map((c) => c.descriptor.conduitId);

  const torConfigured = params.torState.configured
    || params.conduits.some((c) => isTorPolicyConduit(c.descriptor.networkPolicy));

  const descriptors = params.conduits.map((c) => c.descriptor);

  return {
    scope: params.scope,
    phase: derivePhase(readiness),
    readiness,
    revision: params.revision,
    deploymentTier: deriveDeploymentTier(descriptors),
    configuredConduitCount: params.conduits.length,
    activeConduits,
    degradedConduitIds,
    blockedConduitIds,
    scopeReadiness: buildScopeReadiness(params.conduits),
    torConfigured,
    torReady: params.torState.ready,
    effectiveNetworkPolicy: deriveEffectiveNetworkPolicy(descriptors, params.torState),
    pendingOutboundCount: params.pendingOutboundCount,
    lastEvidenceAtUnixMs: params.lastEvidenceAtUnixMs,
    recoveryAttemptCount: params.recoveryAttemptCount,
    recoveryReasonCode: params.recoveryReasonCode,
    lastFailureReason: params.lastFailureReason,
    updatedAtUnixMs: params.updatedAtUnixMs,
  };
};
