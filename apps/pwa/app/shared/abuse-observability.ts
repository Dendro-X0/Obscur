export type AbuseMetricKey =
  | "request_send_suppressed"
  | "join_request_suppressed"
  | "quarantined_malformed_event"
  | "deduped_state_entry";

type AbuseMetricsState = Record<AbuseMetricKey, number>;

const GLOBAL_STATE_KEY = "__obscur_abuse_metrics__";

const createDefaultState = (): AbuseMetricsState => ({
  request_send_suppressed: 0,
  join_request_suppressed: 0,
  quarantined_malformed_event: 0,
  deduped_state_entry: 0,
});

const getState = (): AbuseMetricsState => {
  const root = globalThis as Record<string, unknown>;
  const existing = root[GLOBAL_STATE_KEY];
  if (existing && typeof existing === "object") {
    return existing as AbuseMetricsState;
  }
  const next = createDefaultState();
  root[GLOBAL_STATE_KEY] = next;
  return next;
};

export const incrementAbuseMetric = (key: AbuseMetricKey, by = 1): void => {
  const state = getState();
  state[key] = (state[key] ?? 0) + by;
};

export const getAbuseMetricsSnapshot = (): Readonly<AbuseMetricsState> => {
  const state = getState();
  return { ...state };
};

export const resetAbuseMetrics = (): void => {
  const root = globalThis as Record<string, unknown>;
  root[GLOBAL_STATE_KEY] = createDefaultState();
};
