"use client";

import { useMemo } from "react";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import {
  deriveRelayRuntimeStatus,
  type RelayRuntimeStatus,
} from "@/app/features/relays/lib/relay-runtime-status";
import { workspaceRelayUrlsMatch } from "@/app/features/groups/services/workspace-relay-url";

export const UNAVAILABLE_RELAY_RUNTIME_STATUS: RelayRuntimeStatus = {
  status: "unavailable",
  label: "Relay status unavailable",
  actionText: "Relay runtime is still initializing.",
  openCount: 0,
  totalCount: 0,
};

export function useSettingsRelayRuntimeStatus(): RelayRuntimeStatus {
  const { relayPool: pool, relayList, relayRuntime } = useRelay();

  return useMemo(() => {
    const relays = relayList?.state?.relays ?? [];
    const connections = pool?.connections ?? [];
    if (!relayRuntime) {
      return UNAVAILABLE_RELAY_RUNTIME_STATUS;
    }

    const enabledRelays = relays.filter((relay) => relay.enabled);
    const openCount = connections.filter((connection) => (
      connection.status === "open"
      && enabledRelays.some((relay) => (
        relay.url === connection.url || workspaceRelayUrlsMatch(relay.url, connection.url)
      ))
    )).length;
    const writableCount = Math.max(relayRuntime.writableRelayCount, openCount);
    const subscribableCount = Math.max(relayRuntime.subscribableRelayCount, openCount);

    return deriveRelayRuntimeStatus({
      openCount,
      totalCount: enabledRelays.length,
      writableCount,
      subscribableCount,
      phase: relayRuntime.phase,
      recoveryStage: relayRuntime.recoveryStage,
      lastInboundEventAtUnixMs: relayRuntime.lastInboundEventAtUnixMs,
      lastSuccessfulPublishAtUnixMs: relayRuntime.lastSuccessfulPublishAtUnixMs,
      fallbackRelayCount: relayRuntime.fallbackRelayUrls.length,
      meshReadiness: relayRuntime.recovery?.readiness === "healthy"
        && writableCount > 0
        && writableCount < enabledRelays.length
        ? "degraded"
        : relayRuntime.recovery?.readiness,
    });
  }, [pool?.connections, relayList?.state?.relays, relayRuntime]);
}
