"use client";

import { useEffect, useRef } from "react";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useAccountProjectionRuntime } from "@/app/features/account-sync/hooks/use-account-projection-runtime";
import { useAccountSync } from "@/app/features/account-sync/hooks/use-account-sync";
import { useWindowRuntime } from "@/app/features/runtime/services/window-runtime-supervisor";
import { canPromoteToReadCutover, resolveProjectionReadAuthority } from "@/app/features/account-sync/services/account-projection-read-authority";
import { getAccountSyncMigrationPolicy, setAccountSyncMigrationPolicy } from "@/app/features/account-sync/services/account-sync-migration-policy";
import { logAppEvent } from "@/app/shared/log-app-event";

const ACTIVATION_FAIL_OPEN_TIMEOUT_MS = 12_000;

const getRelayCounts = (connections: ReadonlyArray<Readonly<{ status: string }>>) => ({
  openRelayCount: connections.filter((connection) => connection.status === "open").length,
  relayTotalCount: connections.length,
});

const resolveMigrationScope = (params: Readonly<{
  projectionSnapshot: Readonly<{
    profileId: string | null;
    accountPublicKeyHex: string | null;
  }>;
  publicKeyHex: string | null;
}>) => ({
  profileId: params.projectionSnapshot.profileId ?? undefined,
  accountPublicKeyHex: params.projectionSnapshot.accountPublicKeyHex ?? params.publicKeyHex ?? undefined,
});

export function RuntimeActivationManager(): null {
  const runtime = useWindowRuntime();
  const runtimePhase = runtime.snapshot.phase;
  const markRuntimeReady = runtime.markRuntimeReady;
  const markRuntimeDegraded = runtime.markRuntimeDegraded;
  const identity = useIdentity();
  const { relayPool, enabledRelayUrls, relayList } = useRelay();
  const publicKeyHex = identity.state.publicKeyHex ?? null;
  const privateKeyHex = identity.state.privateKeyHex ?? null;
  const accountSync = useAccountSync({
    publicKeyHex,
    privateKeyHex,
    pool: relayPool,
    enabledRelayUrls,
    onRelayListRestored: (restoredRelays) => {
      relayList.replaceRelays({ relays: restoredRelays });
    },
  });
  const accountProjection = useAccountProjectionRuntime({
    publicKeyHex,
    privateKeyHex,
    pool: relayPool,
  });
  const activationStartedAtUnixMsRef = useRef<number | null>(null);
  const firstRelayOpenAtUnixMsRef = useRef<number | null>(null);
  const lastAccountSyncPhaseRef = useRef<string | null>(null);
  const lastProjectionPhaseRef = useRef<string | null>(null);
  const latestAccountSyncSnapshotRef = useRef(accountSync.snapshot);
  const latestProjectionSnapshotRef = useRef(accountProjection.snapshot);
  const latestMigrationPolicyRef = useRef(
    getAccountSyncMigrationPolicy(resolveMigrationScope({
      projectionSnapshot: accountProjection.snapshot,
      publicKeyHex,
    }))
  );
  const latestRelayCountsRef = useRef(getRelayCounts(relayPool.connections));
  const lastTransportInvariantSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    latestAccountSyncSnapshotRef.current = accountSync.snapshot;
  }, [accountSync.snapshot]);

  useEffect(() => {
    latestRelayCountsRef.current = getRelayCounts(relayPool.connections);
  }, [relayPool.connections]);

  useEffect(() => {
    latestProjectionSnapshotRef.current = accountProjection.snapshot;
    latestMigrationPolicyRef.current = getAccountSyncMigrationPolicy(resolveMigrationScope({
      projectionSnapshot: accountProjection.snapshot,
      publicKeyHex,
    }));
  }, [accountProjection.snapshot, publicKeyHex]);

  useEffect(() => {
    const projectionReady = (
      accountProjection.snapshot.accountProjectionReady
      && accountProjection.snapshot.phase === "ready"
      && accountProjection.snapshot.status === "ready"
    );
    if (!projectionReady || (runtimePhase !== "ready" && runtimePhase !== "degraded")) {
      lastTransportInvariantSignatureRef.current = null;
      return;
    }
    const counts = runtime.snapshot.messagingTransportRuntime;
    const invariantSatisfied = counts.activeIncomingOwnerCount === 1 && counts.activeQueueProcessorCount === 1;
    const signature = [
      runtimePhase,
      counts.activeIncomingOwnerCount,
      counts.activeQueueProcessorCount,
      invariantSatisfied ? "ok" : "warn",
    ].join(":");
    if (lastTransportInvariantSignatureRef.current === signature) {
      return;
    }
    lastTransportInvariantSignatureRef.current = signature;
    logAppEvent({
      name: "runtime.activation.transport_owner_invariant",
      level: invariantSatisfied ? "info" : "warn",
      scope: { feature: "runtime", action: "activation" },
      context: {
        runtimePhase,
        projectionPhase: accountProjection.snapshot.phase,
        projectionStatus: accountProjection.snapshot.status,
        accountProjectionReady: accountProjection.snapshot.accountProjectionReady,
        activeIncomingOwnerCount: counts.activeIncomingOwnerCount,
        activeQueueProcessorCount: counts.activeQueueProcessorCount,
      },
    });
  }, [
    accountProjection.snapshot.accountProjectionReady,
    accountProjection.snapshot.phase,
    accountProjection.snapshot.status,
    runtime.snapshot.messagingTransportRuntime.activeIncomingOwnerCount,
    runtime.snapshot.messagingTransportRuntime.activeQueueProcessorCount,
    runtimePhase,
  ]);

  useEffect(() => {
    const projectionReady = (
      accountProjection.snapshot.accountProjectionReady
      && accountProjection.snapshot.phase === "ready"
      && accountProjection.snapshot.status === "ready"
    );
    if (!publicKeyHex || !projectionReady) {
      return;
    }
    const scope = resolveMigrationScope({
      projectionSnapshot: accountProjection.snapshot,
      publicKeyHex,
    });
    const policy = getAccountSyncMigrationPolicy(scope);
    if (policy.phase === "shadow") {
      const nextPolicy = setAccountSyncMigrationPolicy({ phase: "drift_gate" }, scope);
      latestMigrationPolicyRef.current = nextPolicy;
      logAppEvent({
        name: "account_projection.migration_phase_promoted",
        level: "info",
        scope: { feature: "account_sync", action: "migration_policy" },
        context: {
          previousPhase: policy.phase,
          nextPhase: nextPolicy.phase,
          rollbackEnabled: nextPolicy.rollbackEnabled,
        },
      });
      return;
    }

    if (policy.phase !== "drift_gate" || !canPromoteToReadCutover(accountProjection.snapshot)) {
      return;
    }
    const nextPolicy = setAccountSyncMigrationPolicy({ phase: "read_cutover" }, scope);
    latestMigrationPolicyRef.current = nextPolicy;
    logAppEvent({
      name: "account_projection.migration_phase_promoted",
      level: "info",
      scope: { feature: "account_sync", action: "migration_policy" },
      context: {
        previousPhase: policy.phase,
        nextPhase: nextPolicy.phase,
        rollbackEnabled: nextPolicy.rollbackEnabled,
      },
    });
  }, [
    accountProjection.snapshot.accountProjectionReady,
    accountProjection.snapshot.driftReport?.criticalDriftCount,
    accountProjection.snapshot.phase,
    accountProjection.snapshot.status,
    publicKeyHex,
  ]);

  useEffect(() => {
    if (!publicKeyHex) {
      activationStartedAtUnixMsRef.current = null;
      firstRelayOpenAtUnixMsRef.current = null;
      lastAccountSyncPhaseRef.current = null;
      return;
    }
    if (runtimePhase === "activating_runtime") {
      if (activationStartedAtUnixMsRef.current === null) {
        const nowUnixMs = Date.now();
        activationStartedAtUnixMsRef.current = nowUnixMs;
        if (latestRelayCountsRef.current.openRelayCount > 0) {
          firstRelayOpenAtUnixMsRef.current = nowUnixMs;
        }
        lastAccountSyncPhaseRef.current = latestAccountSyncSnapshotRef.current.phase;
        lastProjectionPhaseRef.current = latestProjectionSnapshotRef.current.phase;
        logAppEvent({
          name: "runtime.activation.start",
          level: "info",
          scope: { feature: "runtime", action: "activation" },
          context: {
            accountSyncPhase: latestAccountSyncSnapshotRef.current.phase,
            accountSyncStatus: latestAccountSyncSnapshotRef.current.status,
            accountProjectionPhase: latestProjectionSnapshotRef.current.phase,
            accountProjectionStatus: latestProjectionSnapshotRef.current.status,
            accountProjectionReady: latestProjectionSnapshotRef.current.accountProjectionReady,
            projectionPhase: latestProjectionSnapshotRef.current.phase,
            projectionStatus: latestProjectionSnapshotRef.current.status,
            migrationPhase: latestMigrationPolicyRef.current.phase,
            driftStatus: latestProjectionSnapshotRef.current.driftStatus,
            openRelayCount: latestRelayCountsRef.current.openRelayCount,
            relayTotalCount: latestRelayCountsRef.current.relayTotalCount,
          },
        });
      }
      return;
    }
    const startedAtUnixMs = activationStartedAtUnixMsRef.current;
    if (startedAtUnixMs === null) {
      return;
    }
    const completedAtUnixMs = Date.now();
    const relayOpenWaitMs = firstRelayOpenAtUnixMsRef.current === null
      ? null
      : Math.max(0, firstRelayOpenAtUnixMsRef.current - startedAtUnixMs);
    logAppEvent({
      name: "runtime.activation.complete",
      level: runtimePhase === "ready" ? "info" : "warn",
      scope: { feature: "runtime", action: "activation" },
      context: {
        resultPhase: runtimePhase,
        activationDurationMs: Math.max(0, completedAtUnixMs - startedAtUnixMs),
        relayOpenWaitMs,
        accountSyncPhase: latestAccountSyncSnapshotRef.current.phase,
        accountSyncStatus: latestAccountSyncSnapshotRef.current.status,
        accountProjectionPhase: latestProjectionSnapshotRef.current.phase,
        accountProjectionStatus: latestProjectionSnapshotRef.current.status,
        accountProjectionReady: latestProjectionSnapshotRef.current.accountProjectionReady,
        projectionPhase: latestProjectionSnapshotRef.current.phase,
        projectionStatus: latestProjectionSnapshotRef.current.status,
        migrationPhase: latestMigrationPolicyRef.current.phase,
        driftStatus: latestProjectionSnapshotRef.current.driftStatus,
        openRelayCount: latestRelayCountsRef.current.openRelayCount,
        relayTotalCount: latestRelayCountsRef.current.relayTotalCount,
      },
    });
    activationStartedAtUnixMsRef.current = null;
    firstRelayOpenAtUnixMsRef.current = null;
    lastAccountSyncPhaseRef.current = null;
    lastProjectionPhaseRef.current = null;
  }, [publicKeyHex, runtimePhase]);

  useEffect(() => {
    const startedAtUnixMs = activationStartedAtUnixMsRef.current;
    if (runtimePhase !== "activating_runtime" || startedAtUnixMs === null) {
      return;
    }
    const nextPhase = accountSync.snapshot.phase;
    if (lastAccountSyncPhaseRef.current === nextPhase) {
      return;
    }
    lastAccountSyncPhaseRef.current = nextPhase;
    logAppEvent({
      name: "runtime.activation.account_sync_phase",
      level: "info",
      scope: { feature: "runtime", action: "activation" },
      context: {
        accountSyncPhase: nextPhase,
        accountSyncStatus: accountSync.snapshot.status,
        elapsedSinceActivationMs: Math.max(0, Date.now() - startedAtUnixMs),
      },
    });
  }, [accountSync.snapshot.phase, accountSync.snapshot.status, runtimePhase]);

  useEffect(() => {
    const startedAtUnixMs = activationStartedAtUnixMsRef.current;
    if (runtimePhase !== "activating_runtime" || startedAtUnixMs === null) {
      return;
    }
    const nextPhase = accountProjection.snapshot.phase;
    if (lastProjectionPhaseRef.current === nextPhase) {
      return;
    }
    lastProjectionPhaseRef.current = nextPhase;
    logAppEvent({
      name: "runtime.activation.account_projection_phase",
      level: "info",
      scope: { feature: "runtime", action: "activation" },
      context: {
        accountProjectionPhase: nextPhase,
        accountProjectionStatus: accountProjection.snapshot.status,
        accountProjectionReady: accountProjection.snapshot.accountProjectionReady,
        projectionPhase: accountProjection.snapshot.phase,
        projectionStatus: accountProjection.snapshot.status,
        migrationPhase: getAccountSyncMigrationPolicy(resolveMigrationScope({
          projectionSnapshot: accountProjection.snapshot,
          publicKeyHex,
        })).phase,
        driftStatus: accountProjection.snapshot.driftStatus,
        elapsedSinceActivationMs: Math.max(0, Date.now() - startedAtUnixMs),
      },
    });
  }, [
    accountProjection.snapshot.accountProjectionReady,
    accountProjection.snapshot.driftStatus,
    accountProjection.snapshot.phase,
    accountProjection.snapshot.status,
    publicKeyHex,
    runtimePhase,
  ]);

  useEffect(() => {
    const startedAtUnixMs = activationStartedAtUnixMsRef.current;
    if (runtimePhase !== "activating_runtime" || startedAtUnixMs === null) {
      return;
    }
    const relayCounts = getRelayCounts(relayPool.connections);
    if (relayCounts.openRelayCount <= 0 || firstRelayOpenAtUnixMsRef.current !== null) {
      return;
    }
    const nowUnixMs = Date.now();
    firstRelayOpenAtUnixMsRef.current = nowUnixMs;
    logAppEvent({
      name: "runtime.activation.first_open_relay",
      level: "info",
      scope: { feature: "runtime", action: "activation" },
      context: {
        relayOpenWaitMs: Math.max(0, nowUnixMs - startedAtUnixMs),
        openRelayCount: relayCounts.openRelayCount,
        relayTotalCount: relayCounts.relayTotalCount,
      },
    });
  }, [relayPool.connections, runtimePhase]);

  useEffect(() => {
    if (!publicKeyHex || runtimePhase !== "activating_runtime") {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      const relayCounts = latestRelayCountsRef.current;
      const accountSyncSnapshot = latestAccountSyncSnapshotRef.current;
      const projectionSnapshot = latestProjectionSnapshotRef.current;
      const migrationPolicy = latestMigrationPolicyRef.current;
      const message = "Runtime activation timed out; continuing in degraded mode while recovery continues.";
      logAppEvent({
        name: "runtime.activation.timeout",
        level: "warn",
        scope: { feature: "runtime", action: "activation" },
        context: {
          timeoutMs: ACTIVATION_FAIL_OPEN_TIMEOUT_MS,
          accountSyncPhase: accountSyncSnapshot.phase,
          accountSyncStatus: accountSyncSnapshot.status,
          projectionPhase: projectionSnapshot.phase,
          projectionStatus: projectionSnapshot.status,
          accountProjectionReady: projectionSnapshot.accountProjectionReady,
          migrationPhase: migrationPolicy.phase,
          driftStatus: projectionSnapshot.driftStatus,
          openRelayCount: relayCounts.openRelayCount,
          relayTotalCount: relayCounts.relayTotalCount,
        },
      });
      markRuntimeDegraded("activation_timeout", {
        completedAtUnixMs: Date.now(),
        relayOpenCount: relayCounts.openRelayCount,
        relayTotalCount: relayCounts.relayTotalCount,
        accountSyncPhase: accountSyncSnapshot.phase,
        accountSyncStatus: accountSyncSnapshot.status,
        accountProjectionReady: projectionSnapshot.accountProjectionReady,
        accountProjectionPhase: projectionSnapshot.phase,
        accountProjectionStatus: projectionSnapshot.status,
        projectionPhase: projectionSnapshot.phase,
        projectionStatus: projectionSnapshot.status,
        migrationPhase: migrationPolicy.phase,
        driftStatus: projectionSnapshot.driftStatus,
        message,
        degradedReason: "activation_timeout",
      });
    }, ACTIVATION_FAIL_OPEN_TIMEOUT_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [markRuntimeDegraded, publicKeyHex, runtimePhase]);

  useEffect(() => {
    if (!publicKeyHex || runtimePhase !== "activating_runtime") {
      return;
    }
    const readAuthority = resolveProjectionReadAuthority({
      projectionSnapshot: accountProjection.snapshot,
    });
    const relayCounts = getRelayCounts(relayPool.connections);
    if (
      accountSync.snapshot.phase === "ready"
      && accountSync.snapshot.status !== "degraded"
      && accountProjection.snapshot.phase === "ready"
      && accountProjection.snapshot.status === "ready"
      && accountProjection.snapshot.accountProjectionReady
    ) {
      const migrationPolicy = readAuthority.policy;
      const driftGateFailed = (
        (migrationPolicy.phase === "read_cutover" || migrationPolicy.phase === "legacy_writes_disabled")
        && readAuthority.reason === "rollback_on_critical_drift"
      );
      if (driftGateFailed) {
        markRuntimeDegraded("account_sync_degraded", {
          completedAtUnixMs: Date.now(),
          relayOpenCount: relayCounts.openRelayCount,
          relayTotalCount: relayCounts.relayTotalCount,
          accountSyncPhase: accountSync.snapshot.phase,
          accountSyncStatus: accountSync.snapshot.status,
          accountProjectionReady: accountProjection.snapshot.accountProjectionReady,
          accountProjectionPhase: accountProjection.snapshot.phase,
          accountProjectionStatus: accountProjection.snapshot.status,
          projectionPhase: accountProjection.snapshot.phase,
          projectionStatus: accountProjection.snapshot.status,
          migrationPhase: migrationPolicy.phase,
          driftStatus: accountProjection.snapshot.driftStatus,
          message: `Critical projection drift detected (${readAuthority.criticalDriftCount}). Reads rolled back to legacy.`,
          degradedReason: "account_sync_degraded",
        });
        return;
      }
      markRuntimeReady({
        completedAtUnixMs: Date.now(),
        relayOpenCount: relayCounts.openRelayCount,
        relayTotalCount: relayCounts.relayTotalCount,
        accountSyncPhase: accountSync.snapshot.phase,
        accountSyncStatus: accountSync.snapshot.status,
        accountProjectionReady: accountProjection.snapshot.accountProjectionReady,
        accountProjectionPhase: accountProjection.snapshot.phase,
        accountProjectionStatus: accountProjection.snapshot.status,
        projectionPhase: accountProjection.snapshot.phase,
        projectionStatus: accountProjection.snapshot.status,
        migrationPhase: migrationPolicy.phase,
        driftStatus: accountProjection.snapshot.driftStatus,
        message: "Runtime activated",
      });
      return;
    }
    if (accountProjection.snapshot.phase === "degraded" || accountProjection.snapshot.status === "degraded") {
      markRuntimeDegraded("account_sync_degraded", {
        completedAtUnixMs: Date.now(),
        relayOpenCount: relayCounts.openRelayCount,
        relayTotalCount: relayCounts.relayTotalCount,
        accountSyncPhase: accountSync.snapshot.phase,
        accountSyncStatus: accountSync.snapshot.status,
        accountProjectionReady: accountProjection.snapshot.accountProjectionReady,
        accountProjectionPhase: accountProjection.snapshot.phase,
        accountProjectionStatus: accountProjection.snapshot.status,
        projectionPhase: accountProjection.snapshot.phase,
        projectionStatus: accountProjection.snapshot.status,
        migrationPhase: readAuthority.policy.phase,
        driftStatus: accountProjection.snapshot.driftStatus,
        message: accountProjection.snapshot.lastError || "Account projection bootstrap degraded",
        degradedReason: "account_sync_degraded",
      });
      return;
    }
    if (accountSync.snapshot.phase === "error" || accountSync.snapshot.status === "degraded") {
      markRuntimeDegraded("account_sync_degraded", {
        completedAtUnixMs: Date.now(),
        relayOpenCount: relayCounts.openRelayCount,
        relayTotalCount: relayCounts.relayTotalCount,
        accountSyncPhase: accountSync.snapshot.phase,
        accountSyncStatus: accountSync.snapshot.status,
        accountProjectionReady: accountProjection.snapshot.accountProjectionReady,
        accountProjectionPhase: accountProjection.snapshot.phase,
        accountProjectionStatus: accountProjection.snapshot.status,
        projectionPhase: accountProjection.snapshot.phase,
        projectionStatus: accountProjection.snapshot.status,
        migrationPhase: readAuthority.policy.phase,
        driftStatus: accountProjection.snapshot.driftStatus,
        message: accountSync.snapshot.lastRelayFailureReason || accountSync.snapshot.message || "Account sync degraded",
        degradedReason: "account_sync_degraded",
      });
    }
  }, [
    accountSync.snapshot.lastRelayFailureReason,
    accountSync.snapshot.message,
    accountSync.snapshot.phase,
    accountSync.snapshot.status,
    accountProjection.snapshot.accountProjectionReady,
    accountProjection.snapshot.driftStatus,
    accountProjection.snapshot.lastError,
    accountProjection.snapshot.phase,
    accountProjection.snapshot.status,
    markRuntimeDegraded,
    markRuntimeReady,
    publicKeyHex,
    relayPool.connections,
    runtimePhase,
  ]);

  return null;
}
