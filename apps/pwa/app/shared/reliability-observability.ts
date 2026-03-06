export type ReliabilityMetricKey =
  | "relay_reconnect_suppressed"
  | "relay_publish_partial"
  | "relay_publish_failed"
  | "sync_gap_detected"
  | "sync_backfill_requested"
  | "storage_health_failed"
  | "storage_recovery_runs"
  | "storage_recovery_records";

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
  sync_gap_detected: 0,
  sync_backfill_requested: 0,
  storage_health_failed: 0,
  storage_recovery_runs: 0,
  storage_recovery_records: 0,
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
