import type {
  RelayHealthMetrics,
  RelayLatencySampleSource,
} from "../hooks/relay-health-monitor";
import { workspaceRelayUrlsMatch } from "@/app/features/groups/services/workspace-relay-url";

export type RelayLatencyLabelMetrics = Pick<
  RelayHealthMetrics,
  "latency" | "latencySampleSource" | "latencyHistory"
>;

export const resolveRelayLatencySampleSource = (
  metrics?: Pick<RelayHealthMetrics, "latencySampleSource">,
): RelayLatencySampleSource => (
  metrics?.latencySampleSource === "app" ? "app" : "connect"
);

export type RelayLatencyLabelOptions = Readonly<{
  /** When false, samples are historical (socket not open) — U4 Last Connect/RTT. */
  socketOpen?: boolean;
  /** Mesh/transport can publish on this URL even when WS metrics lag. */
  publishReady?: boolean;
}>;

/**
 * Primary Relays card latency badge — distinguishes connect/handshake vs app RTT.
 * Disconnected cards use Last* so Connect/RTT is not read as live latency (U4).
 * Publish-ready without samples shows Ready (not n/a) so UI matches working DM transport.
 */
export const formatRelayLatencyLabel = (
  metrics?: RelayLatencyLabelMetrics | null,
  options?: RelayLatencyLabelOptions,
): string => {
  if (!metrics || !Number.isFinite(metrics.latency) || metrics.latency <= 0) {
    return options?.publishReady ? "Ready" : "n/a";
  }
  const ms = Math.round(metrics.latency);
  const isApp = resolveRelayLatencySampleSource(metrics) === "app";
  const historical = options?.socketOpen === false;
  if (historical) {
    return isApp ? `Last RTT ${ms}ms` : `Last Connect ${ms}ms`;
  }
  return isApp ? `RTT ${ms}ms` : `Connect ${ms}ms`;
};

/** Caption under latency history when samples exist. */
export const formatRelayLatencyHistoryCaption = (
  metrics?: RelayLatencyLabelMetrics | null,
  options?: RelayLatencyLabelOptions,
): string => {
  if (!metrics || (metrics.latencyHistory?.length ?? 0) === 0) {
    return "No samples";
  }
  const isApp = resolveRelayLatencySampleSource(metrics) === "app";
  const historical = options?.socketOpen === false;
  if (historical) {
    return isApp ? "Last App RTT" : "Last Connect";
  }
  return isApp ? "App RTT" : "Connect";
};

export type RelayQuickAvgLatencyKind = "rtt" | "connect" | "none";

export type RelayQuickAvgLatency = Readonly<{
  averageLatencyMs?: number;
  kind: RelayQuickAvgLatencyKind;
}>;

const findMetricsForUrl = (
  url: string,
  metricsByUrl: ReadonlyMap<string, Pick<RelayHealthMetrics, "latency" | "latencySampleSource">>,
): Pick<RelayHealthMetrics, "latency" | "latencySampleSource"> | undefined => {
  const exact = metricsByUrl.get(url);
  if (exact) {
    return exact;
  }
  for (const [key, value] of metricsByUrl.entries()) {
    if (workspaceRelayUrlsMatch(key, url)) {
      return value;
    }
  }
  return undefined;
};

/**
 * Header Avg Latency — open-pool only; prefer app RTT when any open sample is app-sourced (U3).
 */
export const computeRelayQuickAverageLatency = (params: Readonly<{
  openEnabledUrls: ReadonlyArray<string>;
  metricsByUrl: ReadonlyMap<string, Pick<RelayHealthMetrics, "latency" | "latencySampleSource">>;
}>): RelayQuickAvgLatency => {
  const openSamples = params.openEnabledUrls
    .map((url) => findMetricsForUrl(url, params.metricsByUrl))
    .filter((metrics): metrics is Pick<RelayHealthMetrics, "latency" | "latencySampleSource"> => {
      return Boolean(metrics) && Number.isFinite(metrics!.latency) && (metrics!.latency ?? 0) > 0;
    });

  if (openSamples.length === 0) {
    return { kind: "none" };
  }

  const appSamples = openSamples.filter(
    (metrics) => resolveRelayLatencySampleSource(metrics) === "app",
  );
  const selected = appSamples.length > 0 ? appSamples : openSamples;
  const averageLatencyMs = Math.round(
    selected.reduce((sum, metrics) => sum + metrics.latency, 0) / selected.length,
  );
  return {
    averageLatencyMs,
    kind: appSamples.length > 0 ? "rtt" : "connect",
  };
};
