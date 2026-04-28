"use client";

import { useSyncExternalStore } from "react";
import type { EnhancedRelayPoolResult } from "@/app/features/relays/hooks/enhanced-relay-pool";
import {
  createRelayRecoveryController,
  type RecoveryAction,
  type RelayRecoveryReasonCode,
  type RelayRecoverySnapshot,
} from "./relay-recovery-policy";
import {
  createDefaultRelayRuntimeSnapshot,
  relayRuntimeContractsInternals,
  type RelayRecoveryStage,
  type RelayRuntimePhase,
  type RelayTransportRoutingMode,
  type RelayRuntimeSnapshot,
} from "./relay-runtime-contracts";
import {
  getAutoRecoveryDelayMs,
  shouldAutoRecoverRelays,
} from "./sticky-relay-recovery";
import { relayTransportJournal } from "./relay-transport-journal";
import { relayResilienceObservability } from "./relay-resilience-observability";
import { logAppEvent } from "@/app/shared/log-app-event";
import { incrementReliabilityMetric } from "@/app/shared/reliability-observability";

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
  pool: EnhancedRelayPoolResult;
  enabledRelayUrls: ReadonlyArray<string>;
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

const toPhase = (params: Readonly<{
  recovery: RelayRecoverySnapshot;
  enabledRelayCount: number;
}>): RelayRuntimePhase => {
  if (params.recovery.recoveryReasonCode === "recovery_exhausted" && params.recovery.currentAction === "reload_required") {
    return "fatal";
  }
  if (params.recovery.readiness === "healthy") {
    return "healthy";
  }
  if (params.recovery.readiness === "recovering") {
    return "recovering";
  }
  if (params.recovery.readiness === "degraded") {
    return "degraded";
  }
  if (params.enabledRelayCount > 0) {
    return "connecting";
  }
  return "offline";
};

class RelayRuntimeSupervisor {
  private readonly instanceId = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `relay-runtime-${Date.now()}`;

  private readonly recoveryController = createRelayRecoveryController();
  private readonly listeners = new Set<Listener>();
  private snapshot: RelayRuntimeSnapshot = createDefaultRelayRuntimeSnapshot({
    instanceId: this.instanceId,
  });
  private config: RelayRuntimeConfig | null = null;
  private unsubscribeRecovery: (() => void) | null = null;
  private unsubscribeTransportJournal: (() => void) | null = null;
  private autoRecoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private browserSignalsAttached = false;
  private lastPerformanceGateSignature: string | null = null;

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
    this.config = config;
    if (!this.unsubscribeRecovery) {
      this.unsubscribeRecovery = this.recoveryController.subscribeRecoveryState((recovery) => {
        this.updateSnapshot(recovery);
      });
    }
    if (!this.unsubscribeTransportJournal) {
      this.unsubscribeTransportJournal = relayTransportJournal.subscribe(() => {
        this.updateSnapshot(this.recoveryController.getRecoverySnapshot());
      });
    }
    this.recoveryController.configure({
      pool: config.pool,
      enabledRelayUrls: config.enabledRelayUrls,
    });
    this.recoveryController.startWarmup();
    this.attachBrowserSignals();
    this.updateSnapshot(this.recoveryController.getRecoverySnapshot());
    this.refresh();
  }

  refresh(): RelayRuntimeSnapshot {
    const recovery = this.recoveryController.refreshSnapshot();
    this.updateSnapshot(recovery);
    return this.snapshot;
  }

  async triggerRecovery(reason: RelayRecoveryReasonCode = "manual"): Promise<RelayRuntimeSnapshot> {
    const recovery = await this.recoveryController.triggerRecovery(reason);
    this.updateSnapshot(recovery);
    return this.snapshot;
  }

  dispose(): void {
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
    this.snapshot = createDefaultRelayRuntimeSnapshot({
      instanceId: this.instanceId,
    });
    this.emit();
  }

  private updateSnapshot(recovery: RelayRecoverySnapshot): void {
    const scope = this.config?.scope;
    const enabledRelayUrls = this.config?.enabledRelayUrls ?? [];
    const activeSubscriptionCount = this.config?.pool.getActiveSubscriptionCount?.() ?? 0;
    const transportJournal = relayTransportJournal.getSnapshot();
    const next: RelayRuntimeSnapshot = {
      instanceId: this.instanceId,
      windowLabel: scope?.windowLabel ?? this.snapshot.windowLabel,
      profileId: scope?.profileId ?? this.snapshot.profileId,
      publicKeyHexSummary: relayRuntimeContractsInternals.summarizePublicKeyHex(scope?.publicKeyHex),
      transportRoutingMode: scope?.transportRoutingMode ?? "direct",
      transportProxySummary: scope?.transportProxySummary,
      phase: toPhase({
        recovery,
        enabledRelayCount: enabledRelayUrls.length,
      }),
      recoveryStage: toRecoveryStage(recovery.currentAction),
      enabledRelayUrls: [...enabledRelayUrls],
      writableRelayCount: recovery.writableRelayCount,
      subscribableRelayCount: recovery.subscribableRelayCount,
      activeSubscriptionCount,
      pendingOutboundCount: transportJournal.pendingOutboundCount,
      pendingSubscriptionBatchCount: transportJournal.pendingSubscriptionBatchCount,
      lastSubscriptionReplayAttemptAtUnixMs: transportJournal.lastSubscriptionReplayAttemptAtUnixMs,
      lastSubscriptionReplayResultAtUnixMs: transportJournal.lastSubscriptionReplayResultAtUnixMs,
      lastSubscriptionReplayReasonCode: transportJournal.lastSubscriptionReplayReasonCode,
      lastSubscriptionReplayResult: transportJournal.lastSubscriptionReplayResult,
      lastSubscriptionReplayDetail: transportJournal.lastSubscriptionReplayDetail,
      lastInboundMessageAtUnixMs: recovery.lastInboundMessageAtUnixMs,
      lastInboundEventAtUnixMs: recovery.lastInboundEventAtUnixMs,
      lastSuccessfulPublishAtUnixMs: recovery.lastSuccessfulPublishAtUnixMs,
      recoveryAttemptCount: recovery.recoveryAttemptCount,
      recoveryReasonCode: recovery.recoveryReasonCode,
      lastFailureReason: recovery.lastFailureReason,
      fallbackRelayUrls: [...recovery.fallbackRelayUrls],
      updatedAtUnixMs: Date.now(),
      recovery,
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
    this.emitPerformanceGate(next);
    this.installTools();
    this.scheduleAutoRecovery();
    if (changed) {
      this.emit();
    }
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
    if (this.autoRecoveryTimer) {
      clearTimeout(this.autoRecoveryTimer);
      this.autoRecoveryTimer = null;
    }
    if (!this.config) {
      return;
    }
    if (!shouldAutoRecoverRelays({
      enabledRelayCount: this.config.enabledRelayUrls.length,
      writableRelayCount: this.snapshot.writableRelayCount,
      fallbackWritableRelayCount: this.snapshot.recovery.fallbackWritableRelayCount,
    })) {
      return;
    }
    this.autoRecoveryTimer = setTimeout(() => {
      void this.triggerRecovery("no_writable_relays");
    }, getAutoRecoveryDelayMs({
      readiness: this.snapshot.recovery.readiness,
      recoveryAttemptCount: this.snapshot.recoveryAttemptCount,
      fallbackWritableRelayCount: this.snapshot.recovery.fallbackWritableRelayCount,
      transportRoutingMode: this.snapshot.transportRoutingMode,
    }));
  }

  private attachBrowserSignals(): void {
    if (this.browserSignalsAttached || typeof window === "undefined") {
      return;
    }
    const nudgeRecovery = (): void => {
      if (this.snapshot.phase === "healthy" && this.snapshot.writableRelayCount > 0) {
        return;
      }
      void this.triggerRecovery("manual");
    };
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "visible") {
        nudgeRecovery();
      }
    };
    window.addEventListener("online", nudgeRecovery);
    window.addEventListener("focus", nudgeRecovery);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    this.browserSignalsAttached = true;
    this.detachBrowserSignals = () => {
      window.removeEventListener("online", nudgeRecovery);
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
