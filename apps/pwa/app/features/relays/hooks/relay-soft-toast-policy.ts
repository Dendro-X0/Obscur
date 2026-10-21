import { relayHealthMonitor } from "./relay-health-monitor";

/** Count relays the health monitor currently treats as connected. */
export const countHealthyRelayConnections = (): number => {
  let count = 0;
  const metricsMap = typeof relayHealthMonitor.getAllMetrics === "function"
    ? relayHealthMonitor.getAllMetrics()
    : null;
  if (!metricsMap) {
    return 0;
  }
  metricsMap.forEach((metrics) => {
    if (metrics.status === "connected") {
      count += 1;
    }
  });
  return count;
};

/**
 * Soft relay connect/init toasts are pool-level signals. When at least one relay
 * is connected, a single host flap is degraded mode — not a user-facing outage.
 */
export const shouldSurfaceSoftRelayConnectToast = (params?: Readonly<{
  connectedRelayCount?: number;
}>): boolean => {
  const connected = params?.connectedRelayCount ?? countHealthyRelayConnections();
  return connected < 1;
};
