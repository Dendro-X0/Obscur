"use client";

import { useMemo } from "react";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import {
  deriveRelayRuntimeStatus,
  type RelayRuntimeStatus,
} from "@/app/features/relays/lib/relay-runtime-status";

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
    const enabledRelaySet = new Set(enabledRelays.map((relay) => relay.url));
    const openCount = connections.filter(
      (connection) => connection.status === "open" && enabledRelaySet.has(connection.url),
    ).length;

    return deriveRelayRuntimeStatus({
      openCount,
      totalCount: enabledRelays.length,
      writableCount: relayRuntime.writableRelayCount,
      subscribableCount: relayRuntime.subscribableRelayCount,
      phase: relayRuntime.phase,
      recoveryStage: relayRuntime.recoveryStage,
      lastInboundEventAtUnixMs: relayRuntime.lastInboundEventAtUnixMs,
      fallbackRelayCount: relayRuntime.fallbackRelayUrls.length,
    });
  }, [pool?.connections, relayList?.state?.relays, relayRuntime]);
}
