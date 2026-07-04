import type { EngineScope } from "@obscur/engine-contracts";

import type { ConduitRuntimeState } from "./conduit";

export type MeshReadiness = "healthy" | "degraded" | "recovering" | "offline";

export type MeshPhase =
  | "booting"
  | "connecting"
  | "healthy"
  | "degraded"
  | "recovering"
  | "offline"
  | "fatal";

export type MeshRecoveryReasonCode =
  | "startup_warmup"
  | "no_viable_conduit"
  | "tor_unreachable"
  | "all_circuits_open"
  | "stale_subscriptions"
  | "publish_timeouts"
  | "manual"
  | "recovery_exhausted";

export type MeshScopeReadiness = Readonly<{
  messageScope: "dm" | "workspace" | "control";
  publishReadyCount: number;
  requiredReadyCount: number;
}>;

export type MeshSnapshot = Readonly<{
  scope: EngineScope;
  phase: MeshPhase;
  readiness: MeshReadiness;
  revision: number;
  deploymentTier: "minimal_infra" | "private_trust" | "experimental";
  configuredConduitCount: number;
  activeConduits: ReadonlyArray<ConduitRuntimeState>;
  degradedConduitIds: ReadonlyArray<string>;
  blockedConduitIds: ReadonlyArray<string>;
  scopeReadiness: ReadonlyArray<MeshScopeReadiness>;
  torConfigured: boolean;
  torReady: boolean;
  effectiveNetworkPolicy: "clearnet" | "tor_preferred" | "tor_required";
  pendingOutboundCount: number;
  lastEvidenceAtUnixMs?: number;
  recoveryAttemptCount: number;
  recoveryReasonCode?: MeshRecoveryReasonCode;
  lastFailureReason?: string;
  updatedAtUnixMs: number;
}>;
