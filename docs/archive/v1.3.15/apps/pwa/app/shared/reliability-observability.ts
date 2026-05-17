export type ReliabilityMetricKey =
  | "relay_reconnect_suppressed"
  | "relay_publish_partial"
  | "relay_publish_failed"
  | "relay_cooling_down"
  | "relay_hard_failure_cooldown"
  | "sync_gap_detected"
  | "sync_backfill_requested"
  | "sync_checkpoint_repaired"
  | "storage_health_failed"
  | "storage_recovery_runs"
  | "storage_recovery_records"
  | "storage_write_retry"
  | "warmup_terminal_ready"
  | "warmup_terminal_degraded"
  | "warmup_terminal_fatal"
  | "warmup_rollout_gate_warn"
  | "warmup_rollout_gate_fail"
  | "relay_runtime_performance_warn"
  | "relay_runtime_performance_fail";

type ReliabilityMetricsState = Record<ReliabilityMetricKey, number>;
type ReliabilityRuntimeState = Readonly<{
  lastSyncCompletedAtUnixMs: number;
}>;

const GLOBAL_STATE_KEY = "__obscur_reliability_metrics__";
const GLOBAL_RUNTIME_KEY = "__obscur_reliability_runtime__";

const createDefaultState = (): ReliabilityMetricsState => ({
  relay_reconnect_suppressed: 0,
  relay_publish_partial: 0,
  relay_publish_failed: 0,
  relay_cooling_down: 0,
  relay_hard_failure_cooldown: 0,
  sync_gap_detected: 0,
  sync_backfill_requested: 0,
  sync_checkpoint_repaired: 0,
  storage_health_failed: 0,
  storage_recovery_runs: 0,
  storage_recovery_records: 0,
  storage_write_retry: 0,
  warmup_terminal_ready: 0,
  warmup_terminal_degraded: 0,
  warmup_terminal_fatal: 0,
  warmup_rollout_gate_warn: 0,
  warmup_rollout_gate_fail: 0,
  relay_runtime_performance_warn: 0,
  relay_runtime_performance_fail: 0,
});

const getState = (): ReliabilityMetricsState => {
  const root = globalThis as Record<string, unknown>;
  const existing = root[GLOBAL_STATE_KEY];
  if (existing && typeof existing === "object") {
    return existing as ReliabilityMetricsState;
  }
  const next = createDefaultState();
  root[GLOBAL_STATE_KEY] = next;
  return next;
};

const getRuntimeState = (): ReliabilityRuntimeState => {
  const root = globalThis as Record<string, unknown>;
  const existing = root[GLOBAL_RUNTIME_KEY];
  if (existing && typeof existing === "object" && existing !== null) {
    return existing as ReliabilityRuntimeState;
  }
  const next: ReliabilityRuntimeState = {
    lastSyncCompletedAtUnixMs: 0,
  };
  root[GLOBAL_RUNTIME_KEY] = next;
  return next;
};

export const incrementReliabilityMetric = (key: ReliabilityMetricKey, by = 1): void => {
  const state = getState();
  state[key] = (state[key] ?? 0) + by;
};

export const getReliabilityMetricsSnapshot = (): Readonly<ReliabilityMetricsState> => {
  const state = getState();
  return { ...state };
};

export const markReliabilitySyncCompleted = (atUnixMs = Date.now()): void => {
  const root = globalThis as Record<string, unknown>;
  root[GLOBAL_RUNTIME_KEY] = {
    ...getRuntimeState(),
    lastSyncCompletedAtUnixMs: atUnixMs,
  } as ReliabilityRuntimeState;
};

export const getReliabilityRuntimeSnapshot = (): ReliabilityRuntimeState => {
  return { ...getRuntimeState() };
};

export const resetReliabilityMetrics = (): void => {
  const root = globalThis as Record<string, unknown>;
  root[GLOBAL_STATE_KEY] = createDefaultState();
  root[GLOBAL_RUNTIME_KEY] = {
    lastSyncCompletedAtUnixMs: 0,
  } as ReliabilityRuntimeState;
};
