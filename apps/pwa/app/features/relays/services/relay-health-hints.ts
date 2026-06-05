import type { EnhancedRelayPoolResult } from "@/app/features/relays/hooks/enhanced-relay-pool";
import { relayHealthMonitor, type RelayHealthMetrics } from "@/app/features/relays/hooks/relay-health-monitor";
import type { RelayHealthHint } from "./relay-primary-selector";

const isCircuitAcceptingConnections = (metrics: RelayHealthMetrics | undefined): boolean => {
  if (!metrics) {
    return true;
  }
  if (metrics.circuitBreakerState === "open") {
    return false;
  }
  const nextRetryAtUnixMs = metrics.nextRetryAt?.getTime();
  if (typeof nextRetryAtUnixMs === "number" && nextRetryAtUnixMs > Date.now()) {
    return false;
  }
  return true;
};

const resolveRelayHealthMetrics = (
  url: string,
  pool: Pick<EnhancedRelayPoolResult, "getRelayHealth">,
): RelayHealthMetrics | undefined => (
  pool.getRelayHealth?.(url) ?? relayHealthMonitor.getMetrics(url)
);

/**
 * Builds failover hints from the active pool plus standby probe metrics.
 */
/** Structural health only — excludes latency/successRate so reconcile does not ping-pong on probes. */
export const buildRelayHealthReconcileSignature = (
  hints: ReadonlyArray<RelayHealthHint>,
): string => (
  hints.map((hint) => (
    `${hint.url}:${hint.isOpen ? 1 : 0}:${hint.isWritable ? 1 : 0}:${hint.isCircuitOpen ? 1 : 0}`
  )).join("|")
);

export const buildRelayHealthHints = (
  orderedEnabledUrls: ReadonlyArray<string>,
  pool: Pick<EnhancedRelayPoolResult, "connections" | "getRelayHealth">,
): ReadonlyArray<RelayHealthHint> => (
  orderedEnabledUrls.map((url, listIndex) => {
    const connection = pool.connections.find((entry) => entry.url === url);
    const metrics = resolveRelayHealthMetrics(url, pool);
    const isCircuitOpen = !isCircuitAcceptingConnections(metrics);
    const poolOpen = connection?.status === "open";
    const monitorConnected = metrics?.status === "connected" && !isCircuitOpen;
    const probedRecently = (metrics?.latencyHistory.length ?? 0) > 0 && !isCircuitOpen;
    const isOpen = poolOpen || monitorConnected || probedRecently;
    const isWritable = poolOpen && !isCircuitOpen;

    return {
      url,
      listIndex,
      isOpen,
      isWritable,
      isCircuitOpen,
      latencyMs: metrics?.latency,
      successRate: metrics?.successRate,
    };
  })
);
