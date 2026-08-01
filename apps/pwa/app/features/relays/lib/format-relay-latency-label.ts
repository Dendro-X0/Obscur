import type {
  RelayHealthMetrics,
  RelayLatencySampleSource,
} from "../hooks/relay-health-monitor";

export type RelayLatencyLabelMetrics = Pick<
  RelayHealthMetrics,
  "latency" | "latencySampleSource" | "latencyHistory"
>;

export const resolveRelayLatencySampleSource = (
  metrics?: Pick<RelayHealthMetrics, "latencySampleSource">,
): RelayLatencySampleSource => (
  metrics?.latencySampleSource === "app" ? "app" : "connect"
);

/**
 * Primary Relays card latency badge — distinguishes connect/handshake vs app RTT.
 */
export const formatRelayLatencyLabel = (
  metrics?: RelayLatencyLabelMetrics | null,
): string => {
  if (!metrics || !Number.isFinite(metrics.latency) || metrics.latency <= 0) {
    return "n/a";
  }
  const ms = Math.round(metrics.latency);
  return resolveRelayLatencySampleSource(metrics) === "app"
    ? `RTT ${ms}ms`
    : `Connect ${ms}ms`;
};

/** Caption under latency history when samples exist. */
export const formatRelayLatencyHistoryCaption = (
  metrics?: RelayLatencyLabelMetrics | null,
): string => {
  if (!metrics || (metrics.latencyHistory?.length ?? 0) === 0) {
    return "No samples";
  }
  return resolveRelayLatencySampleSource(metrics) === "app"
    ? "App RTT"
    : "Connect";
};
