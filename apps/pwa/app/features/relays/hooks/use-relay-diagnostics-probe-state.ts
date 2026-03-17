"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  runRelayNipProbe,
  summarizeRelayNipProbeResults,
  type RelayNipProbeResult,
} from "@/app/features/relays/lib/relay-nip-probe.mjs";
import { useTanstackQueryRuntime } from "@/app/features/query/providers/tanstack-query-runtime-provider";
import { queryKeyFactory } from "@/app/features/query/services/query-key-factory";
import { createQueryScope } from "@/app/features/query/services/query-scope";
import { markTanstackQueryPath } from "@/app/features/query/services/tanstack-query-diagnostics";
import { getActiveProfileIdSafe } from "@/app/features/profiles/services/profile-scope";

type RelayDiagnosticsProbeSnapshot = Readonly<{
  results: ReadonlyArray<RelayNipProbeResult>;
  lastProbeAtUnixMs: number;
}>;

type UseRelayDiagnosticsProbeStateParams = Readonly<{
  publicKeyHex: string | null;
}>;

export const useRelayDiagnosticsProbeState = (params: UseRelayDiagnosticsProbeStateParams) => {
  const tanstackQueryRuntime = useTanstackQueryRuntime();
  const [probeResults, setProbeResults] = useState<ReadonlyArray<RelayNipProbeResult>>([]);
  const [isRunningProbe, setIsRunningProbe] = useState(false);
  const [lastProbeAtUnixMs, setLastProbeAtUnixMs] = useState<number | null>(null);

  useEffect(() => {
    markTanstackQueryPath("relay_diagnostics_probe_snapshot", tanstackQueryRuntime?.enabled === true ? "tanstack" : "legacy");
  }, [tanstackQueryRuntime?.enabled]);

  const scope = useMemo(() => (
    tanstackQueryRuntime?.scope ?? createQueryScope({
      profileId: getActiveProfileIdSafe(),
      publicKeyHex: params.publicKeyHex ?? null,
    })
  ), [params.publicKeyHex, tanstackQueryRuntime?.scope]);

  const queryKey = useMemo(() => (
    queryKeyFactory.relayDiagnosticsProbeSnapshot({ scope })
  ), [scope]);

  useEffect(() => {
    if (!tanstackQueryRuntime?.enabled) {
      return;
    }
    const cached = tanstackQueryRuntime.queryClient.getQueryData<RelayDiagnosticsProbeSnapshot>(queryKey);
    if (!cached) {
      return;
    }
    setProbeResults(cached.results);
    setLastProbeAtUnixMs(cached.lastProbeAtUnixMs);
  }, [queryKey, tanstackQueryRuntime]);

  const runProbe = useCallback(async (params: Readonly<{
    relayUrls: ReadonlyArray<string>;
    nip96Urls: ReadonlyArray<string>;
    timeoutMs?: number;
  }>): Promise<RelayDiagnosticsProbeSnapshot> => {
    setIsRunningProbe(true);
    try {
      const executeProbe = async (): Promise<RelayDiagnosticsProbeSnapshot> => {
        const results = await runRelayNipProbe({
          relayUrls: params.relayUrls,
          nip96Urls: params.nip96Urls,
          timeoutMs: params.timeoutMs ?? 4500,
        });
        return {
          results,
          lastProbeAtUnixMs: Date.now(),
        };
      };
      const snapshot = tanstackQueryRuntime?.enabled
        ? await tanstackQueryRuntime.queryClient.fetchQuery({
          queryKey,
          staleTime: 0,
          queryFn: executeProbe,
        })
        : await executeProbe();
      setProbeResults(snapshot.results);
      setLastProbeAtUnixMs(snapshot.lastProbeAtUnixMs);
      return snapshot;
    } finally {
      setIsRunningProbe(false);
    }
  }, [queryKey, tanstackQueryRuntime]);

  const probeSummary = useMemo(() => summarizeRelayNipProbeResults(probeResults), [probeResults]);

  return useMemo(() => ({
    isRunningProbe,
    probeResults,
    lastProbeAtUnixMs,
    probeSummary,
    runProbe,
  }), [isRunningProbe, lastProbeAtUnixMs, probeResults, probeSummary, runProbe]);
};

