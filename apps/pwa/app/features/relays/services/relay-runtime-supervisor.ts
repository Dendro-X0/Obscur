"use client";

import { useSyncExternalStore } from "react";
import type { RelayPoolRuntime } from "@/app/features/relays/services/relay-pool-runtime-port";
import {
  createRelayRecoveryRuntime,
} from "./relay-recovery-port";
import type {
  RecoveryAction,
  RelayRecoveryReasonCode,
  RelayRecoverySnapshot,
} from "./relay-recovery-types";
import {
  createDefaultRelayRuntimeSnapshot,
  relayRuntimeContractsInternals,
  type RelayRecoveryStage,
  type RelayTransportRoutingMode,
  type RelayRuntimeSnapshot,
} from "./relay-runtime-contracts";
import {
  getAutoRecoveryDelayMs,
  shouldAutoRecoverRelays,
} from "./sticky-relay-recovery";
import { shouldAttemptPrimaryFailover } from "./relay-primary-failover-policy";
import { relayTransportJournal } from "./relay-transport-journal";
import { relayResilienceObservability } from "./relay-resilience-observability";
import { logAppEvent } from "@/app/shared/log-app-event";
import { incrementReliabilityMetric } from "@/app/shared/reliability-observability";
import { isBrowserOffline } from "@/app/features/runtime/offline-runtime-policy";
import {
  buildSupervisorTransportEvidence,
  resolveRelayRuntimePhaseRelayCount,
  resolveSupervisorRecoveryRelayEvidence,
} from "./transport-relay-supervisor-evidence";
import { resolveRelayRuntimePhaseForTransportKernel } from "@/app/features/transport-kernel/transport-kernel-snapshot-port";
import {
  executeTransportKernelPoolRecovery,
  resolveLegacyRelayRuntimePhase,
  resolvePublishedRelayRecoverySnapshot,
  shouldRunLegacyRelayRecoveryOrchestration,
  shouldSubscribeLegacyRelayRecoverySnapshot,
} from "@/app/features/transport-kernel/transport-kernel-recovery-port";
import { isTransportKernelAuthority } from "@/app/features/transport-kernel/transport-kernel-policy";
import type { TransportSnapshot } from "@obscur/transport-engine";

const isCalibrationReasonCode = (reasonCode: string): boolean => reasonCode.startsWith("insufficient_");

type Listener = () => void;

type RelayRuntimeScope = Readonly<{
  windowLabel: string;
  profileId: string;
  publicKeyHex?: string | null;
  transportRoutingMode?: RelayTransportRoutingMode;
  transportProxySummary?: string;
}>;

type RelayRuntimeConfig = Readonly<{
  pool: RelayPoolRuntime;
  /** URLs in the active relay pool (typically the current primary only). */
  enabledRelayUrls: ReadonlyArray<string>;
  /** Full enabled relay list from settings — used for primary failover candidates. */
  allEnabledRelayUrls: ReadonlyArray<string>;
  /** User relay settings before engine merge (DM transport list). */
  userEnabledRelayUrls: ReadonlyArray<string>;
  /** Relay URLs loaded from transport-engine persistence on boot. */
  engineConfiguredRelayUrls: ReadonlyArray<string>;
  /** Checkpoint-backed relay URLs ordered by sync recency. */
  engineCheckpointRelayUrls: ReadonlyArray<string>;
  engineRelayCheckpointCount: number;
  attemptPrimaryFailover?: () => boolean;
  scope: RelayRuntimeScope;
}>;

const toRecoveryStage = (action?: RecoveryAction): RelayRecoveryStage | undefined => {
  switch (action) {
    case "reconnect":
      return "connect_relays";
    case "resubscribe":
      return "replay_subscriptions";
    case "subsystem_reset":
      return "subsystem_recycle";
    case "reload_required":
      return "subsystem_recycle";
    default:
      return undefined;
  }
};

class RelayRuntimeSupervisor {
  private readonly instanceId = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `relay-runtime-${Date.now()}`;

  private readonly recoveryController = createRelayRecoveryRuntime();
  private readonly listeners = new Set<Listener>();
  private snapshot: RelayRuntimeSnapshot = createDefaultRelayRuntimeSnapshot({
    instanceId: this.instanceId,
  });
  private config: RelayRuntimeConfig | null = null;
  private configSignature: string | null = null;
  private unsubscribeRecovery: (() => void) | null = null;
  private unsubscribeTransportJournal: (() => void) | null = null;
  private autoRecoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private transportJournalDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private browserSignalsAttached = false;
  private lastPerformanceGateSignature: string | null = null;
  private lastProactiveFailoverAtUnixMs = 0;
  private lastObservedWritableRelayCount: number | null = null;
  private proactiveFailoverScheduled = false;
  private lastTransportEvidenceSignature: string | null = null;
  private transportEvidenceRevision = 0;
  private lastTransportEvidenceSnapshot: ReturnType<typeof buildSupervisorTransportEvidence> | null = null;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): RelayRuntimeSnapshot => {
    return this.snapshot;
  };

  configure(config: RelayRuntimeConfig): void {
    const nextSignature = [
      config.scope.profileId,
      config.scope.windowLabel,
      config.scope.publicKeyHex ?? "",
      config.scope.transportRoutingMode ?? "direct",
      config.scope.transportProxySummary ?? "",
      config.enabledRelayUrls.join("|"),
      config.allEnabledRelayUrls.join("|"),
      config.engineConfiguredRelayUrls.join("|"),
      config.engineCheckpointRelayUrls.join("|"),
      String(config.engineRelayCheckpointCount),
    ].join("|");
    const configChanged = this.configSignature !== nextSignature;
    this.config = config;
    this.configSignature = nextSignature;
    if (!this.unsubscribeRecovery && shouldSubscribeLegacyRelayRecoverySnapshot()) {
      this.unsubscribeRecovery = this.recoveryController.subscribeRecoveryState((recovery) => {
        this.updateSnapshot(recovery);
      });
    }
    if (!this.unsubscribeTransportJournal) {
      this.unsubscribeTransportJournal = relayTransportJournal.subscribe(() => {
        this.scheduleTransportJournalSnapshotRefresh();
      });
    }
    this.recoveryController.configure({
      pool: config.pool,
      enabledRelayUrls: config.enabledRelayUrls,
      beforeRecovery: (reason) => this.tryPrimaryFailover(reason),
    });
    if (configChanged) {
      if (shouldRunLegacyRelayRecoveryOrchestration()) {
        this.recoveryController.startWarmup();
      } else {
        void this.config.pool.waitForConnection(3_500).finally(() => {
          this.updateSnapshot(this.recoveryController.refreshSnapshot());
        });
      }
      this.attachBrowserSignals();
      this.updateSnapshot(this.recoveryController.getRecoverySnapshot());
    }
  }

  refresh(): RelayRuntimeSnapshot {
    const recovery = this.recoveryController.refreshSnapshot();
    this.updateSnapshot(recovery);
    return this.snapshot;
  }

  resetRecoveryAfterPrimaryFailover(): RelayRuntimeSnapshot {
    const recovery = this.recoveryController.resetAfterPrimaryFailover();
    this.updateSnapshot(recovery);
    return this.snapshot;
  }

  async triggerRecovery(reason: RelayRecoveryReasonCode = "manual"): Promise<RelayRuntimeSnapshot> {
    if (!this.config) {
      return this.snapshot;
    }
    if (!shouldRunLegacyRelayRecoveryOrchestration()) {
      if (this.tryPrimaryFailover(reason)) {
        return this.snapshot;
      }
      await executeTransportKernelPoolRecovery({
        pool: this.config.pool,
        reason,
      });
      const recovery = this.recoveryController.refreshSnapshot();
      this.updateSnapshot(recovery);
      return this.snapshot;
    }
    const recovery = await this.recoveryController.triggerRecovery(reason);
    this.updateSnapshot(recovery);
    if (
      recovery.recoveryReasonCode === "recovery_exhausted"
      && this.tryPrimaryFailover(reason)
    ) {
      return this.refresh();
    }
    return this.snapshot;
  }

  dispose(): void {
    if (this.transportJournalDebounceTimer) {
      clearTimeout(this.transportJournalDebounceTimer);
      this.transportJournalDebounceTimer = null;
    }
    if (this.autoRecoveryTimer) {
      clearTimeout(this.autoRecoveryTimer);
      this.autoRecoveryTimer = null;
    }
    if (this.unsubscribeRecovery) {
      this.unsubscribeRecovery();
      this.unsubscribeRecovery = null;
    }
    if (this.unsubscribeTransportJournal) {
      this.unsubscribeTransportJournal();
      this.unsubscribeTransportJournal = null;
    }
    this.detachBrowserSignals();
    this.recoveryController.dispose();
    this.config = null;
    this.lastPerformanceGateSignature = null;
    this.lastTransportEvidenceSignature = null;
    this.transportEvidenceRevision = 0;
    this.lastTransportEvidenceSnapshot = null;
    this.snapshot = createDefaultRelayRuntimeSnapshot({
      instanceId: this.instanceId,
    });
    this.emit();
  }

  private updateSnapshot(recovery: RelayRecoverySnapshot): void {
    const scope = this.config?.scope;
    const enabledRelayUrls = this.config?.enabledRelayUrls ?? [];
    const supervisorRelayUrlCandidates = this.config?.allEnabledRelayUrls ?? [];
    const engineConfiguredRelayUrls = this.config?.engineConfiguredRelayUrls ?? [];
    const engineCheckpointRelayUrls = this.config?.engineCheckpointRelayUrls ?? [];
    const engineRelayCheckpointCount = this.config?.engineRelayCheckpointCount ?? 0;
    const userEnabledRelayUrls = this.config?.userEnabledRelayUrls ?? [];
    const relayEvidence = resolveSupervisorRecoveryRelayEvidence({
      activePoolRelayUrls: enabledRelayUrls,
      supervisorRelayUrlCandidates,
      engineConfiguredRelayUrls,
      userEnabledRelayUrls,
      engineCheckpointRelayUrls,
      engineRelayCheckpointCount,
    });
    const activeSubscriptionCount = this.config?.pool.getActiveSubscriptionCount?.() ?? 0;
    const transportJournal = relayTransportJournal.getSnapshot();
    const phaseRelayCount = resolveRelayRuntimePhaseRelayCount({
      activePoolRelayCount: relayEvidence.activePoolRelayUrls.length,
      supervisorCandidateRelayCount: relayEvidence.supervisorCandidateRelayCount,
    });
    const legacyPhase = resolveLegacyRelayRuntimePhase({
      recovery,
      enabledRelayCount: phaseRelayCount,
    });
    const transportEvidence = isTransportKernelAuthority()
      ? this.buildSupervisorTransportEvidenceSnapshot({
        scope: {
          profileId: scope?.profileId ?? this.snapshot.profileId,
          windowLabel: scope?.windowLabel ?? this.snapshot.windowLabel,
        },
        relayEvidence,
        recovery,
        activeSubscriptionCount,
        pendingOutboundCount: transportJournal.pendingOutboundCount,
      })
      : null;
    const publishedRecovery = resolvePublishedRelayRecoverySnapshot({
      legacyRecovery: recovery,
      transportSnapshot: transportEvidence,
    });
    const phase = resolveRelayRuntimePhaseForTransportKernel({
      legacyPhase,
      transportSnapshot: transportEvidence,
    });
    const next: RelayRuntimeSnapshot = {
      instanceId: this.instanceId,
      windowLabel: scope?.windowLabel ?? this.snapshot.windowLabel,
      profileId: scope?.profileId ?? this.snapshot.profileId,
      publicKeyHexSummary: relayRuntimeContractsInternals.summarizePublicKeyHex(scope?.publicKeyHex),
      transportRoutingMode: scope?.transportRoutingMode ?? "direct",
      transportProxySummary: scope?.transportProxySummary,
      phase,
      recoveryStage: toRecoveryStage(publishedRecovery.currentAction),
      enabledRelayUrls: [...enabledRelayUrls],
      engineConfiguredRelayUrls: [...relayEvidence.engineConfiguredRelayUrls],
      supervisorRelayUrlCandidates: [...relayEvidence.supervisorRelayUrlCandidates],
      engineOnlyRelayUrls: [...relayEvidence.engineOnlyRelayUrls],
      engineCheckpointRelayUrls: [...relayEvidence.engineCheckpointRelayUrls],
      engineRelayCheckpointCount: relayEvidence.engineRelayCheckpointCount,
      writableRelayCount: publishedRecovery.writableRelayCount,
      subscribableRelayCount: publishedRecovery.subscribableRelayCount,
      activeSubscriptionCount,
      pendingOutboundCount: transportJournal.pendingOutboundCount,
      pendingSubscriptionBatchCount: transportJournal.pendingSubscriptionBatchCount,
      lastSubscriptionReplayAttemptAtUnixMs: transportJournal.lastSubscriptionReplayAttemptAtUnixMs,
      lastSubscriptionReplayResultAtUnixMs: transportJournal.lastSubscriptionReplayResultAtUnixMs,
      lastSubscriptionReplayReasonCode: transportJournal.lastSubscriptionReplayReasonCode,
      lastSubscriptionReplayResult: transportJournal.lastSubscriptionReplayResult,
      lastSubscriptionReplayDetail: transportJournal.lastSubscriptionReplayDetail,
      lastInboundMessageAtUnixMs: publishedRecovery.lastInboundMessageAtUnixMs,
      lastInboundEventAtUnixMs: publishedRecovery.lastInboundEventAtUnixMs,
      lastSuccessfulPublishAtUnixMs: publishedRecovery.lastSuccessfulPublishAtUnixMs,
      recoveryAttemptCount: publishedRecovery.recoveryAttemptCount,
      recoveryReasonCode: publishedRecovery.recoveryReasonCode,
      lastFailureReason: publishedRecovery.lastFailureReason,
      fallbackRelayUrls: [...publishedRecovery.fallbackRelayUrls],
      updatedAtUnixMs: Date.now(),
      recovery: publishedRecovery,
    };

    const changed = (
      next.phase !== this.snapshot.phase
      || next.windowLabel !== this.snapshot.windowLabel
      || next.profileId !== this.snapshot.profileId
      || next.publicKeyHexSummary !== this.snapshot.publicKeyHexSummary
      || next.transportRoutingMode !== this.snapshot.transportRoutingMode
      || next.transportProxySummary !== this.snapshot.transportProxySummary
      || next.writableRelayCount !== this.snapshot.writableRelayCount
      || next.subscribableRelayCount !== this.snapshot.subscribableRelayCount
      || next.activeSubscriptionCount !== this.snapshot.activeSubscriptionCount
      || next.pendingOutboundCount !== this.snapshot.pendingOutboundCount
      || next.pendingSubscriptionBatchCount !== this.snapshot.pendingSubscriptionBatchCount
      || next.recoveryAttemptCount !== this.snapshot.recoveryAttemptCount
      || next.recoveryStage !== this.snapshot.recoveryStage
      || next.lastSubscriptionReplayAttemptAtUnixMs !== this.snapshot.lastSubscriptionReplayAttemptAtUnixMs
      || next.lastSubscriptionReplayResultAtUnixMs !== this.snapshot.lastSubscriptionReplayResultAtUnixMs
      || next.lastSubscriptionReplayReasonCode !== this.snapshot.lastSubscriptionReplayReasonCode
      || next.lastSubscriptionReplayResult !== this.snapshot.lastSubscriptionReplayResult
      || next.lastSubscriptionReplayDetail !== this.snapshot.lastSubscriptionReplayDetail
      || next.lastInboundMessageAtUnixMs !== this.snapshot.lastInboundMessageAtUnixMs
      || next.lastInboundEventAtUnixMs !== this.snapshot.lastInboundEventAtUnixMs
      || next.lastSuccessfulPublishAtUnixMs !== this.snapshot.lastSuccessfulPublishAtUnixMs
      || next.lastFailureReason !== this.snapshot.lastFailureReason
      || next.recoveryReasonCode !== this.snapshot.recoveryReasonCode
      || next.enabledRelayUrls.join("|") !== this.snapshot.enabledRelayUrls.join("|")
      || next.engineConfiguredRelayUrls.join("|") !== this.snapshot.engineConfiguredRelayUrls.join("|")
      || next.supervisorRelayUrlCandidates.join("|") !== this.snapshot.supervisorRelayUrlCandidates.join("|")
      || next.engineOnlyRelayUrls.join("|") !== this.snapshot.engineOnlyRelayUrls.join("|")
      || next.engineCheckpointRelayUrls.join("|") !== this.snapshot.engineCheckpointRelayUrls.join("|")
      || next.engineRelayCheckpointCount !== this.snapshot.engineRelayCheckpointCount
      || next.fallbackRelayUrls.join("|") !== this.snapshot.fallbackRelayUrls.join("|")
    );

    const replayResultChanged = (
      next.lastSubscriptionReplayResultAtUnixMs !== this.snapshot.lastSubscriptionReplayResultAtUnixMs
      || next.lastSubscriptionReplayResult !== this.snapshot.lastSubscriptionReplayResult
    );
    if (next.phase !== this.snapshot.phase) {
      relayResilienceObservability.recordRelayRuntimePhase({
        phase: next.phase,
        atUnixMs: next.updatedAtUnixMs,
      });
    }
    if (replayResultChanged && next.lastSubscriptionReplayResult) {
      relayResilienceObservability.recordSubscriptionReplayResult({
        result: next.lastSubscriptionReplayResult,
        atUnixMs: next.lastSubscriptionReplayResultAtUnixMs ?? next.updatedAtUnixMs,
      });
    }

    this.snapshot = next;
    if (transportEvidence) {
      this.transportEvidenceRevision = transportEvidence.revision;
      this.lastTransportEvidenceSnapshot = transportEvidence;
    }
    this.emitTransportEngineEvidence(
      next,
      publishedRecovery,
      relayEvidence,
      activeSubscriptionCount,
      transportJournal.pendingOutboundCount,
      transportEvidence,
    );
    this.emitPerformanceGate(next);
    this.installTools();
    this.scheduleAutoRecovery();
    this.scheduleProactivePrimaryFailover();
    if (changed) {
      this.emit();
    }
  }

  private scheduleTransportJournalSnapshotRefresh(): void {
    if (this.transportJournalDebounceTimer) {
      return;
    }
    this.transportJournalDebounceTimer = setTimeout(() => {
      this.transportJournalDebounceTimer = null;
      const recovery = isTransportKernelAuthority()
        ? this.recoveryController.refreshSnapshot()
        : this.recoveryController.getRecoverySnapshot();
      this.updateSnapshot(recovery);
    }, 100);
  }

  private scheduleProactivePrimaryFailover(): void {
    if (this.proactiveFailoverScheduled) {
      return;
    }
    this.proactiveFailoverScheduled = true;
    queueMicrotask(() => {
      this.proactiveFailoverScheduled = false;
      if (!this.config) {
        return;
      }
      this.maybeProactivePrimaryFailover(this.recoveryController.getRecoverySnapshot());
    });
  }

  private maybeProactivePrimaryFailover(recovery: RelayRecoverySnapshot): void {
    if (!this.config || this.config.allEnabledRelayUrls.length <= 1) {
      return;
    }
    const previousWritable = this.lastObservedWritableRelayCount;
    this.lastObservedWritableRelayCount = recovery.writableRelayCount;
    if (recovery.writableRelayCount > 0) {
      return;
    }
    const nowMs = Date.now();
    if (nowMs - this.lastProactiveFailoverAtUnixMs < 5_000) {
      return;
    }
    if (this.tryPrimaryFailover(recovery.recoveryReasonCode)) {
      this.lastProactiveFailoverAtUnixMs = nowMs;
    }
  }

  private buildSupervisorTransportEvidenceSnapshot(params: Readonly<{
    scope: Readonly<{ profileId: string; windowLabel: string }>;
    relayEvidence: ReturnType<typeof resolveSupervisorRecoveryRelayEvidence>;
    recovery: RelayRecoverySnapshot;
    activeSubscriptionCount: number;
    pendingOutboundCount: number;
  }>): TransportSnapshot {
    return buildSupervisorTransportEvidence({
      scope: params.scope,
      evidence: params.relayEvidence,
      metrics: {
        enabledRelayCount: resolveRelayRuntimePhaseRelayCount({
          activePoolRelayCount: params.relayEvidence.activePoolRelayUrls.length,
          supervisorCandidateRelayCount: params.relayEvidence.supervisorCandidateRelayCount,
        }),
        writableRelayCount: params.recovery.writableRelayCount,
        fallbackWritableRelayCount: params.recovery.fallbackWritableRelayCount,
        subscribableRelayCount: params.recovery.subscribableRelayCount,
        writeBlockedRelayCount: params.recovery.writeBlockedRelayCount,
        coolingDownRelayCount: params.recovery.coolingDownRelayCount,
        lastInboundMessageAtUnixMs: params.recovery.lastInboundMessageAtUnixMs,
        lastInboundEventAtUnixMs: params.recovery.lastInboundEventAtUnixMs,
        lastSuccessfulPublishAtUnixMs: params.recovery.lastSuccessfulPublishAtUnixMs,
        fallbackRelayUrls: params.recovery.fallbackRelayUrls,
        lastFailureReason: params.recovery.lastFailureReason,
      },
      activeSubscriptionCount: params.activeSubscriptionCount,
      pendingOutboundCount: params.pendingOutboundCount,
      recoveryState: {
        recoveryAttemptCount: params.recovery.recoveryAttemptCount,
        recoveryReasonCode: params.recovery.recoveryReasonCode,
        currentAction: params.recovery.currentAction,
        lastRecoveryAtUnixMs: params.recovery.lastRecoveryAtUnixMs,
      },
      previous: this.lastTransportEvidenceSnapshot ?? undefined,
      browserOffline: isBrowserOffline(),
    });
  }

  private emitTransportEngineEvidence(
    snapshot: RelayRuntimeSnapshot,
    recovery: RelayRecoverySnapshot,
    relayEvidence: ReturnType<typeof resolveSupervisorRecoveryRelayEvidence>,
    activeSubscriptionCount: number,
    pendingOutboundCount: number,
    transportEvidence: TransportSnapshot | null = null,
  ): void {
    const signature = [
      relayEvidence.engineConfiguredRelayUrls.join("|"),
      relayEvidence.supervisorRelayUrlCandidates.join("|"),
      relayEvidence.engineOnlyRelayUrls.join("|"),
      snapshot.phase,
      recovery.readiness,
    ].join("|");
    if (this.lastTransportEvidenceSignature === signature) {
      return;
    }
    this.lastTransportEvidenceSignature = signature;
    const resolvedTransportEvidence = transportEvidence ?? buildSupervisorTransportEvidence({
      scope: {
        profileId: snapshot.profileId,
        windowLabel: snapshot.windowLabel,
      },
      evidence: relayEvidence,
      metrics: {
        enabledRelayCount: resolveRelayRuntimePhaseRelayCount({
          activePoolRelayCount: relayEvidence.activePoolRelayUrls.length,
          supervisorCandidateRelayCount: relayEvidence.supervisorCandidateRelayCount,
        }),
        writableRelayCount: recovery.writableRelayCount,
        fallbackWritableRelayCount: recovery.fallbackWritableRelayCount,
        subscribableRelayCount: recovery.subscribableRelayCount,
        writeBlockedRelayCount: recovery.writeBlockedRelayCount,
        coolingDownRelayCount: recovery.coolingDownRelayCount,
        lastInboundMessageAtUnixMs: recovery.lastInboundMessageAtUnixMs,
        lastInboundEventAtUnixMs: recovery.lastInboundEventAtUnixMs,
        lastSuccessfulPublishAtUnixMs: recovery.lastSuccessfulPublishAtUnixMs,
        fallbackRelayUrls: recovery.fallbackRelayUrls,
        lastFailureReason: recovery.lastFailureReason,
      },
      activeSubscriptionCount,
      pendingOutboundCount,
      recoveryState: {
        recoveryAttemptCount: recovery.recoveryAttemptCount,
        recoveryReasonCode: recovery.recoveryReasonCode,
        currentAction: recovery.currentAction,
        lastRecoveryAtUnixMs: recovery.lastRecoveryAtUnixMs,
      },
      previous: this.lastTransportEvidenceSnapshot ?? undefined,
      browserOffline: isBrowserOffline(),
    });
    this.transportEvidenceRevision = resolvedTransportEvidence.revision;
    this.lastTransportEvidenceSnapshot = resolvedTransportEvidence;
    if (!relayEvidence.hasEngineOnlyCandidates
      && relayEvidence.engineConfiguredRelayUrls.length === 0
      && !relayEvidence.hasCheckpointEvidence) {
      return;
    }
    logAppEvent({
      name: "relay.transport_engine_evidence",
      level: "info",
      scope: { feature: "relays", action: "transport_engine_evidence" },
      context: {
        transportPhase: resolvedTransportEvidence.phase,
        runtimePhase: snapshot.phase,
        engineConfiguredRelayCount: relayEvidence.engineConfiguredRelayUrls.length,
        engineOnlyRelayCount: relayEvidence.engineOnlyRelayUrls.length,
        engineCheckpointRelayCount: relayEvidence.engineRelayCheckpointCount,
        supervisorCandidateRelayCount: relayEvidence.supervisorCandidateRelayCount,
        transportEvidenceRevision: this.transportEvidenceRevision,
      },
    });
  }

  private emitPerformanceGate(snapshot: RelayRuntimeSnapshot): void {
    const resilienceSnapshot = relayResilienceObservability.getSnapshot(snapshot.updatedAtUnixMs);
    const gate = relayResilienceObservability.evaluateRuntimePerformanceGate({
      snapshot: resilienceSnapshot,
    });
    const signature = `${gate.status}:${gate.reasons.join("|")}`;
    if (this.lastPerformanceGateSignature === signature) {
      return;
    }
    this.lastPerformanceGateSignature = signature;
    const isCalibrationOnly = gate.reasons.every((reason) => isCalibrationReasonCode(reason));
    if (gate.status === "warn" && !isCalibrationOnly) {
      incrementReliabilityMetric("relay_runtime_performance_warn");
    } else if (gate.status === "fail") {
      incrementReliabilityMetric("relay_runtime_performance_fail");
    }
    logAppEvent({
      name: "relay.runtime_performance_gate",
      level: gate.status === "fail"
        ? "error"
        : (gate.status === "warn" && !isCalibrationOnly ? "warn" : "info"),
      scope: { feature: "relays", action: "runtime_performance_gate" },
      context: {
        runtimePhase: snapshot.phase,
        recoveryStage: snapshot.recoveryStage ?? "none",
        performanceGateStatus: gate.status,
        performancePrimaryReasonCode: gate.primaryReasonCode,
        performanceReasonCodes: gate.reasons.join(","),
        transportRoutingMode: snapshot.transportRoutingMode,
        observedWindowMs: gate.observedWindowMs,
        recoveryP95LatencyMs: gate.recoveryP95LatencyMs,
        replaySuccessRatio: gate.replaySuccessRatio,
        scopedBlockedRatio: gate.scopedBlockedRatio,
        maxFlapRatePerMinute: gate.maxFlapRatePerMinute,
        sampleRecoveryCount: gate.sampleCounts.recovery,
        sampleReplayCount: gate.sampleCounts.replay,
        sampleScopedCount: gate.sampleCounts.scopedPublish,
      },
    });
  }

  private scheduleAutoRecovery(): void {
    if (!shouldRunLegacyRelayRecoveryOrchestration()) {
      return;
    }
    if (this.autoRecoveryTimer) {
      clearTimeout(this.autoRecoveryTimer);
      this.autoRecoveryTimer = null;
    }
    if (!this.config) {
      return;
    }
    if (!shouldAutoRecoverRelays({
      enabledRelayCount: resolveRelayRuntimePhaseRelayCount({
        activePoolRelayCount: this.config.enabledRelayUrls.length,
        supervisorCandidateRelayCount: this.config.allEnabledRelayUrls.length,
      }),
      writableRelayCount: this.snapshot.writableRelayCount,
      fallbackWritableRelayCount: this.snapshot.recovery.fallbackWritableRelayCount,
      recoveryReasonCode: this.snapshot.recoveryReasonCode,
    })) {
      return;
    }
    this.autoRecoveryTimer = setTimeout(() => {
      void this.runAutoRecoveryCycle();
    }, getAutoRecoveryDelayMs({
      readiness: this.snapshot.recovery.readiness,
      recoveryAttemptCount: this.snapshot.recoveryAttemptCount,
      fallbackWritableRelayCount: this.snapshot.recovery.fallbackWritableRelayCount,
      transportRoutingMode: this.snapshot.transportRoutingMode,
    }));
  }

  private async runAutoRecoveryCycle(): Promise<void> {
    await this.triggerRecovery("no_writable_relays");
  }

  private tryPrimaryFailover(recoveryReason?: RelayRecoveryReasonCode): boolean {
    if (!this.config?.attemptPrimaryFailover) {
      return false;
    }
    if (!shouldAttemptPrimaryFailover({
      allEnabledRelayCount: this.config.allEnabledRelayUrls.length,
      writableRelayCount: this.snapshot.writableRelayCount,
      recovery: this.snapshot.recovery,
      recoveryReason,
    })) {
      return false;
    }
    const failedOver = this.config.attemptPrimaryFailover();
    if (failedOver) {
      this.resetRecoveryAfterPrimaryFailover();
      incrementReliabilityMetric("relay_primary_failover");
      logAppEvent({
        name: "relay.primary_failover",
        level: "info",
        scope: { feature: "relays", action: "primary_failover" },
        context: {
          previousPrimaryUrl: this.snapshot.recovery.lastFailureReason ?? "unknown",
          recoveryReason: recoveryReason ?? this.snapshot.recoveryReasonCode ?? "none",
        },
      });
    }
    return failedOver;
  }

  private attachBrowserSignals(): void {
    if (this.browserSignalsAttached || typeof window === "undefined") {
      return;
    }
    const nudgeRecovery = (): void => {
      if (isBrowserOffline()) {
        return;
      }
      if (this.snapshot.phase === "healthy" && this.snapshot.writableRelayCount > 0) {
        return;
      }
      if (!shouldRunLegacyRelayRecoveryOrchestration()) {
        if (!this.config) {
          return;
        }
        void executeTransportKernelPoolRecovery({
          pool: this.config.pool,
          reason: "manual",
        }).finally(() => {
          this.refresh();
        });
        return;
      }
      void this.triggerRecovery("manual");
    };
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "visible") {
        nudgeRecovery();
      }
    };
    const handleOffline = (): void => {
      this.refresh();
    };
    window.addEventListener("online", nudgeRecovery);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", nudgeRecovery);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    this.browserSignalsAttached = true;
    this.detachBrowserSignals = () => {
      window.removeEventListener("online", nudgeRecovery);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", nudgeRecovery);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      this.browserSignalsAttached = false;
    };
  }

  private detachBrowserSignals = (): void => {
    this.browserSignalsAttached = false;
  };

  private installTools(): void {
    if (typeof window === "undefined") {
      return;
    }
    (window as Window & { obscurRelayRuntime?: unknown }).obscurRelayRuntime = {
      getSnapshot: this.getSnapshot,
    };
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const createRelayRuntimeSupervisor = (): RelayRuntimeSupervisor => new RelayRuntimeSupervisor();

export const useRelayRuntimeSnapshot = (supervisor: RelayRuntimeSupervisor): RelayRuntimeSnapshot => (
  useSyncExternalStore(supervisor.subscribe, supervisor.getSnapshot, supervisor.getSnapshot)
);
