"use client";

import type { AccountProjectionRuntimeSnapshot } from "../account-event-contracts";
import {
  getAccountSyncMigrationPolicy,
  type AccountSyncMigrationPolicy,
} from "./account-sync-migration-policy";

export type ProjectionReadAuthorityReason =
  | "shadow_mode"
  | "drift_gate_not_promoted"
  | "projection_not_ready"
  | "rollback_on_critical_drift"
  | "read_cutover_enabled";

export type ProjectionReadAuthority = Readonly<{
  useProjectionReads: boolean;
  reason: ProjectionReadAuthorityReason;
  policy: AccountSyncMigrationPolicy;
  criticalDriftCount: number;
}>;

const getCriticalDriftCount = (snapshot: AccountProjectionRuntimeSnapshot): number => (
  snapshot.driftReport?.criticalDriftCount ?? 0
);

const resolveMigrationScope = (snapshot: AccountProjectionRuntimeSnapshot) => ({
  profileId: snapshot.profileId ?? undefined,
  accountPublicKeyHex: snapshot.accountPublicKeyHex ?? undefined,
});

export const resolveProjectionReadAuthority = (params: Readonly<{
  projectionSnapshot: AccountProjectionRuntimeSnapshot;
  policy?: AccountSyncMigrationPolicy;
}>): ProjectionReadAuthority => {
  const policy = params.policy ?? getAccountSyncMigrationPolicy(resolveMigrationScope(params.projectionSnapshot));
  const criticalDriftCount = getCriticalDriftCount(params.projectionSnapshot);

  const projectionReady = params.projectionSnapshot.accountProjectionReady
    && params.projectionSnapshot.phase === "ready"
    && params.projectionSnapshot.status === "ready";

  if (!projectionReady) {
    return {
      useProjectionReads: false,
      reason: "projection_not_ready",
      policy,
      criticalDriftCount,
    };
  }

  if (policy.phase === "shadow") {
    return {
      useProjectionReads: false,
      reason: "shadow_mode",
      policy,
      criticalDriftCount,
    };
  }

  if (policy.phase === "drift_gate") {
    return {
      useProjectionReads: false,
      reason: "drift_gate_not_promoted",
      policy,
      criticalDriftCount,
    };
  }

  const canRollbackToLegacyReads = policy.phase === "read_cutover";
  if (criticalDriftCount > 0 && policy.rollbackEnabled && canRollbackToLegacyReads) {
    return {
      useProjectionReads: false,
      reason: "rollback_on_critical_drift",
      policy,
      criticalDriftCount,
    };
  }

  return {
    useProjectionReads: true,
    reason: "read_cutover_enabled",
    policy,
    criticalDriftCount,
  };
};

export const canPromoteToReadCutover = (snapshot: AccountProjectionRuntimeSnapshot): boolean => (
  snapshot.accountProjectionReady
  && snapshot.phase === "ready"
  && snapshot.status === "ready"
  && (snapshot.driftReport?.criticalDriftCount ?? 0) === 0
);
