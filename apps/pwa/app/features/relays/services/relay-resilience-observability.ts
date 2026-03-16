import type {
  RelayRuntimePhase,
  RelaySubscriptionReplayResult,
} from "./relay-runtime-contracts";

const GLOBAL_STATE_KEY = "__obscur_relay_resilience_metrics__";
const FLAP_RATE_WINDOW_MS = 5 * 60_000;
const BETA_GATE_MIN_OBSERVATION_WINDOW_MS = 30 * 60_000;

export type RelayFlapMetric = Readonly<{
  flapCountInWindow: number;
  flapRatePerMinute: number;
  lastFlapAtUnixMs?: number;
}>;

export type RelayRecoveryLatencyMetric = Readonly<{
  sampleCount: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  lastLatencyMs?: number;
}>;

export type RelayReplayMetric = Readonly<{
  totalResultCount: number;
  attemptedReplayCount: number;
  successCount: number;
  partialCount: number;
  failedCount: number;
  skippedCount: number;
  successRatio: number;
}>;

export type RelayScopedReadinessMetric = Readonly<{
  scopedPublishAttemptCount: number;
  blockedByReadinessCount: number;
  blockedByReadinessRatio: number;
}>;

export type RelayBetaGateThresholds = Readonly<{
  minObservationWindowMs: number;
  maxP95RecoveryLatencyMs: number;
  minReplaySuccessRatio: number;
  maxScopedBlockedRatio: number;
  minReplaySamples: number;
  minScopedPublishSamples: number;
  maxOperatorInterventionCount: number;
}>;

export type RelayBetaGateResult = Readonly<{
  ready: boolean;
  thresholds: RelayBetaGateThresholds;
  checks: Readonly<{
    observationWindow: boolean;
    operatorIntervention: boolean;
    recoveryLatency: boolean;
    replaySuccessRatio: boolean;
    scopedBlockedRatio: boolean;
  }>;
  reasons: ReadonlyArray<string>;
}>;

export type RelayResilienceSnapshot = Readonly<{
  sessionStartedAtUnixMs: number;
  updatedAtUnixMs: number;
  observedWindowMs: number;
  relayFlapByUrl: Readonly<Record<string, RelayFlapMetric>>;
  recoveryLatency: RelayRecoveryLatencyMetric;
  replay: RelayReplayMetric;
  scopedReadiness: RelayScopedReadinessMetric;
  operatorInterventionCount: number;
}>;

type MutableRelayResilienceState = {
  sessionStartedAtUnixMs: number;
  updatedAtUnixMs: number;
  lastRuntimePhase?: RelayRuntimePhase;
  recoveringSinceUnixMs?: number;
  recoveryLatencySamplesMs: number[];
  replayResultCounts: Record<RelaySubscriptionReplayResult, number>;
  scopedPublishAttemptCount: number;
  blockedByReadinessCount: number;
  operatorInterventionCount: number;
  flapEventsByUrl: Record<string, number[]>;
  lastOpenStateByUrl: Record<string, boolean>;
};

const createDefaultState = (atUnixMs = Date.now()): MutableRelayResilienceState => ({
  sessionStartedAtUnixMs: atUnixMs,
  updatedAtUnixMs: atUnixMs,
  recoveryLatencySamplesMs: [],
  replayResultCounts: {
    ok: 0,
    partial: 0,
    failed: 0,
    skipped: 0,
  },
  scopedPublishAttemptCount: 0,
  blockedByReadinessCount: 0,
  operatorInterventionCount: 0,
  flapEventsByUrl: {},
  lastOpenStateByUrl: {},
});

const getState = (): MutableRelayResilienceState => {
  const root = globalThis as Record<string, unknown>;
  const existing = root[GLOBAL_STATE_KEY];
  if (existing && typeof existing === "object") {
    return existing as MutableRelayResilienceState;
  }
  const next = createDefaultState();
  root[GLOBAL_STATE_KEY] = next;
  return next;
};

const markUpdated = (state: MutableRelayResilienceState, atUnixMs = Date.now()): void => {
  state.updatedAtUnixMs = atUnixMs;
};

const quantile = (values: ReadonlyArray<number>, ratio: number): number => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index] ?? 0;
};

const trimFlapWindow = (state: MutableRelayResilienceState, nowUnixMs = Date.now()): void => {
  Object.keys(state.flapEventsByUrl).forEach((url) => {
    const trimmed = (state.flapEventsByUrl[url] ?? []).filter((atUnixMs) => nowUnixMs - atUnixMs <= FLAP_RATE_WINDOW_MS);
    if (trimmed.length === 0) {
      delete state.flapEventsByUrl[url];
      return;
    }
    state.flapEventsByUrl[url] = trimmed;
  });
};

const buildSnapshot = (state: MutableRelayResilienceState, nowUnixMs = Date.now()): RelayResilienceSnapshot => {
  trimFlapWindow(state, nowUnixMs);

  const relayFlapByUrl: Record<string, RelayFlapMetric> = {};
  Object.entries(state.flapEventsByUrl).forEach(([url, events]) => {
    const flapCountInWindow = events.length;
    relayFlapByUrl[url] = {
      flapCountInWindow,
      flapRatePerMinute: flapCountInWindow / (FLAP_RATE_WINDOW_MS / 60_000),
      lastFlapAtUnixMs: events.at(-1),
    };
  });

  const recoverySamples = state.recoveryLatencySamplesMs;
  const replayCounts = state.replayResultCounts;
  const attemptedReplayCount = replayCounts.ok + replayCounts.partial + replayCounts.failed;
  const successLikeCount = replayCounts.ok + replayCounts.partial;

  return {
    sessionStartedAtUnixMs: state.sessionStartedAtUnixMs,
    updatedAtUnixMs: state.updatedAtUnixMs,
    observedWindowMs: Math.max(0, nowUnixMs - state.sessionStartedAtUnixMs),
    relayFlapByUrl,
    recoveryLatency: {
      sampleCount: recoverySamples.length,
      averageLatencyMs: recoverySamples.length > 0
        ? Math.round(recoverySamples.reduce((sum, value) => sum + value, 0) / recoverySamples.length)
        : 0,
      p95LatencyMs: Math.round(quantile(recoverySamples, 0.95)),
      lastLatencyMs: recoverySamples.at(-1),
    },
    replay: {
      totalResultCount: replayCounts.ok + replayCounts.partial + replayCounts.failed + replayCounts.skipped,
      attemptedReplayCount,
      successCount: replayCounts.ok,
      partialCount: replayCounts.partial,
      failedCount: replayCounts.failed,
      skippedCount: replayCounts.skipped,
      successRatio: attemptedReplayCount > 0
        ? Number((successLikeCount / attemptedReplayCount).toFixed(4))
        : 1,
    },
    scopedReadiness: {
      scopedPublishAttemptCount: state.scopedPublishAttemptCount,
      blockedByReadinessCount: state.blockedByReadinessCount,
      blockedByReadinessRatio: state.scopedPublishAttemptCount > 0
        ? Number((state.blockedByReadinessCount / state.scopedPublishAttemptCount).toFixed(4))
        : 0,
    },
    operatorInterventionCount: state.operatorInterventionCount,
  };
};

const installWindowTool = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  (window as Window & { obscurRelayResilience?: unknown }).obscurRelayResilience = {
    getSnapshot: relayResilienceObservability.getSnapshot,
    evaluateBetaReadiness: relayResilienceObservability.evaluateBetaReadiness,
  };
};

const DEFAULT_BETA_GATE_THRESHOLDS: RelayBetaGateThresholds = {
  minObservationWindowMs: BETA_GATE_MIN_OBSERVATION_WINDOW_MS,
  maxP95RecoveryLatencyMs: 15_000,
  minReplaySuccessRatio: 0.9,
  maxScopedBlockedRatio: 0.35,
  minReplaySamples: 10,
  minScopedPublishSamples: 10,
  maxOperatorInterventionCount: 0,
};

const evaluateBetaReadiness = (
  snapshot: RelayResilienceSnapshot,
  thresholds: RelayBetaGateThresholds,
): RelayBetaGateResult => {
  const checks = {
    observationWindow: snapshot.observedWindowMs >= thresholds.minObservationWindowMs,
    operatorIntervention: snapshot.operatorInterventionCount <= thresholds.maxOperatorInterventionCount,
    recoveryLatency: snapshot.recoveryLatency.sampleCount > 0
      && snapshot.recoveryLatency.p95LatencyMs <= thresholds.maxP95RecoveryLatencyMs,
    replaySuccessRatio: snapshot.replay.attemptedReplayCount >= thresholds.minReplaySamples
      && snapshot.replay.successRatio >= thresholds.minReplaySuccessRatio,
    scopedBlockedRatio: snapshot.scopedReadiness.scopedPublishAttemptCount >= thresholds.minScopedPublishSamples
      && snapshot.scopedReadiness.blockedByReadinessRatio <= thresholds.maxScopedBlockedRatio,
  };

  const reasons: string[] = [];
  if (!checks.observationWindow) {
    reasons.push("insufficient_observation_window");
  }
  if (!checks.operatorIntervention) {
    reasons.push("operator_intervention_required");
  }
  if (!checks.recoveryLatency) {
    reasons.push("recovery_latency_slo_not_met");
  }
  if (!checks.replaySuccessRatio) {
    reasons.push("subscription_replay_success_ratio_slo_not_met");
  }
  if (!checks.scopedBlockedRatio) {
    reasons.push("scoped_publish_readiness_block_ratio_slo_not_met");
  }

  return {
    ready: reasons.length === 0,
    thresholds,
    checks,
    reasons,
  };
};

export const relayResilienceObservability = {
  recordRelayConnectionStatus(params: Readonly<{
    url: string;
    status: "connecting" | "open" | "closed" | "error";
    atUnixMs?: number;
  }>): void {
    const state = getState();
    const atUnixMs = params.atUnixMs ?? Date.now();
    const isOpen = params.status === "open";
    const previousOpen = state.lastOpenStateByUrl[params.url];
    if (typeof previousOpen === "boolean" && previousOpen !== isOpen) {
      const existing = state.flapEventsByUrl[params.url] ?? [];
      state.flapEventsByUrl[params.url] = [...existing, atUnixMs];
    }
    state.lastOpenStateByUrl[params.url] = isOpen;
    markUpdated(state, atUnixMs);
    installWindowTool();
  },

  recordRelayRuntimePhase(params: Readonly<{
    phase: RelayRuntimePhase;
    atUnixMs?: number;
  }>): void {
    const state = getState();
    const atUnixMs = params.atUnixMs ?? Date.now();
    const previousPhase = state.lastRuntimePhase;
    state.lastRuntimePhase = params.phase;

    if (params.phase === "healthy") {
      if (typeof state.recoveringSinceUnixMs === "number") {
        const latencyMs = Math.max(0, atUnixMs - state.recoveringSinceUnixMs);
        state.recoveryLatencySamplesMs = [...state.recoveryLatencySamplesMs, latencyMs].slice(-200);
        state.recoveringSinceUnixMs = undefined;
      }
      markUpdated(state, atUnixMs);
      installWindowTool();
      return;
    }

    const wasHealthy = previousPhase === "healthy";
    if (wasHealthy && typeof state.recoveringSinceUnixMs !== "number") {
      state.recoveringSinceUnixMs = atUnixMs;
    }
    markUpdated(state, atUnixMs);
    installWindowTool();
  },

  recordSubscriptionReplayResult(params: Readonly<{
    result: RelaySubscriptionReplayResult;
    atUnixMs?: number;
  }>): void {
    const state = getState();
    const atUnixMs = params.atUnixMs ?? Date.now();
    state.replayResultCounts[params.result] = (state.replayResultCounts[params.result] ?? 0) + 1;
    markUpdated(state, atUnixMs);
    installWindowTool();
  },

  recordScopedPublishReadiness(params: Readonly<{
    blockedByReadiness: boolean;
    atUnixMs?: number;
  }>): void {
    const state = getState();
    state.scopedPublishAttemptCount += 1;
    if (params.blockedByReadiness) {
      state.blockedByReadinessCount += 1;
    }
    markUpdated(state, params.atUnixMs ?? Date.now());
    installWindowTool();
  },

  recordOperatorIntervention(params: Readonly<{
    atUnixMs?: number;
  }> = {}): void {
    const state = getState();
    state.operatorInterventionCount += 1;
    markUpdated(state, params.atUnixMs ?? Date.now());
    installWindowTool();
  },

  getSnapshot(nowUnixMs = Date.now()): RelayResilienceSnapshot {
    const snapshot = buildSnapshot(getState(), nowUnixMs);
    installWindowTool();
    return snapshot;
  },

  evaluateBetaReadiness(params?: Readonly<{
    snapshot?: RelayResilienceSnapshot;
    thresholds?: Partial<RelayBetaGateThresholds>;
  }>): RelayBetaGateResult {
    const snapshot = params?.snapshot ?? this.getSnapshot();
    const thresholds: RelayBetaGateThresholds = {
      ...DEFAULT_BETA_GATE_THRESHOLDS,
      ...(params?.thresholds ?? {}),
    };
    return evaluateBetaReadiness(snapshot, thresholds);
  },

  resetForTests(atUnixMs = Date.now()): void {
    const root = globalThis as Record<string, unknown>;
    root[GLOBAL_STATE_KEY] = createDefaultState(atUnixMs);
  },
};

export const relayResilienceObservabilityInternals = {
  createDefaultState,
  buildSnapshot,
  evaluateBetaReadiness,
  DEFAULT_BETA_GATE_THRESHOLDS,
  FLAP_RATE_WINDOW_MS,
};
