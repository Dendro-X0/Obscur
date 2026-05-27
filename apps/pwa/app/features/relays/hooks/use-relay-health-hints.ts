"use client";

import { useEffect, useMemo, useState } from "react";
import type { EnhancedRelayPoolResult } from "./enhanced-relay-pool";
import { relayHealthMonitor } from "./relay-health-monitor";
import { buildRelayHealthHints } from "../services/relay-health-hints";
import type { RelayHealthHint } from "../services/relay-primary-selector";

const buildHintsSignature = (hints: ReadonlyArray<RelayHealthHint>): string => (
  hints.map((hint) => (
    `${hint.url}:${hint.isOpen ? 1 : 0}:${hint.isWritable ? 1 : 0}:${hint.isCircuitOpen ? 1 : 0}:${hint.latencyMs ?? ""}`
  )).join("|")
);

export const useRelayHealthHints = (params: Readonly<{
  orderedEnabledUrls: ReadonlyArray<string>;
  pool: Pick<EnhancedRelayPoolResult, "connections" | "getRelayHealth">;
  enabled: boolean;
}>): Readonly<{
  hints: ReadonlyArray<RelayHealthHint>;
  hintsSignature: string;
}> => {
  const [monitorRevision, setMonitorRevision] = useState(0);

  useEffect(() => {
    if (!params.enabled) {
      return;
    }
    return relayHealthMonitor.subscribe(() => {
      setMonitorRevision((value) => value + 1);
    });
  }, [params.enabled]);

  const connectionSignature = useMemo(
    () => params.pool.connections.map((entry) => `${entry.url}:${entry.status}`).join("|"),
    [params.pool.connections],
  );

  const hints = useMemo(() => {
    if (!params.enabled || params.orderedEnabledUrls.length === 0) {
      return [];
    }
    void monitorRevision;
    void connectionSignature;
    return buildRelayHealthHints(params.orderedEnabledUrls, params.pool);
  }, [
    params.enabled,
    params.orderedEnabledUrls,
    params.pool,
    monitorRevision,
    connectionSignature,
  ]);

  const hintsSignature = useMemo(() => buildHintsSignature(hints), [hints]);

  return { hints, hintsSignature };
};
