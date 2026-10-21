"use client";

import { useMemo } from "react";
import { relayHealthMonitor } from "@/app/features/relays/hooks/relay-health-monitor";
import { workspaceRelayUrlsMatch } from "@/app/features/groups/services/workspace-relay-url";
import {
  buildRelayPoolDiagnosisSummary,
  type RelayPoolDiagnosisSummary,
} from "@/app/features/relays/services/relay-path-diagnosis";
import { useRelay } from "@/app/features/relays/providers/relay-provider";

/**
 * Slice A — derive honesty summary from configured relays + live pool sockets.
 */
export const useRelayPoolDiagnosis = (): RelayPoolDiagnosisSummary => {
  const { relayList, relayPool } = useRelay();

  return useMemo(() => {
    const connections = relayPool.connections ?? [];
    const rows = relayList.state.relays.map((relay) => {
      const connection = connections.find((entry) => (
        entry.url === relay.url || workspaceRelayUrlsMatch(entry.url, relay.url)
      ));
      const metrics = relayHealthMonitor.getMetrics(relay.url);
      return {
        url: relay.url,
        enabled: relay.enabled,
        connectionStatus: connection?.status ?? null,
        circuitOpen: metrics?.circuitBreakerState === "open",
        lastErrorClass: metrics?.lastError ?? null,
      };
    });
    return buildRelayPoolDiagnosisSummary(rows);
  }, [relayList.state.relays, relayPool.connections]);
};
