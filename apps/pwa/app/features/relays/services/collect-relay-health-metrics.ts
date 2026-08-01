import type { RelayHealthMetrics } from "../hooks/relay-health-monitor";
import { relayHealthMonitor } from "../hooks/relay-health-monitor";

/**
 * Collect health metrics for Settings / pool UI from the canonical global monitor.
 * Exact URL keys only (dashboard Map lookup is exact-match today).
 */
export const collectRelayHealthMetricsForUrls = (
  urls: ReadonlyArray<string>,
  getMetrics: (url: string) => RelayHealthMetrics | undefined = (url) => (
    relayHealthMonitor.getMetrics(url)
  ),
): ReadonlyArray<RelayHealthMetrics> => {
  const out: RelayHealthMetrics[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    const trimmed = url.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    const metrics = getMetrics(trimmed);
    if (metrics) {
      out.push(metrics);
    }
  }
  return out;
};
