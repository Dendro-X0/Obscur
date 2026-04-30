"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  runRelayNipProbe,
  type RelayNipProbeResult,
} from "@/app/features/relays/lib/relay-nip-probe.mjs";
import type {
  RelayCapabilityInfo,
  CapabilityStatus,
} from "@/app/features/relays/components/relay-capability-badge";

export interface UseRelayCapabilitiesReturn {
  capabilities: RelayCapabilityInfo[];
  isLoading: boolean;
  lastProbeAt: number | null;
  error: string | null;
  probe: () => Promise<void>;
  summary: {
    okCount: number;
    failedCount: number;
    totalCount: number;
    overallStatus: CapabilityStatus;
  };
}

/**
 * Hook to probe and track relay capabilities.
 * Uses the existing relay NIP probe infrastructure.
 */
export function useRelayCapabilities(
  relayUrl: string | null | undefined
): UseRelayCapabilitiesReturn {
  const [results, setResults] = useState<RelayNipProbeResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastProbeAt, setLastProbeAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const probe = useCallback(async () => {
    if (!relayUrl) {
      setResults([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const probeResults = await runRelayNipProbe({
        relayUrls: [relayUrl],
        timeoutMs: 5000,
      });

      setResults([...probeResults]);
      setLastProbeAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to probe relay");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [relayUrl]);

  // Auto-probe when relayUrl changes
  useEffect(() => {
    if (relayUrl) {
      probe();
    }
  }, [relayUrl, probe]);

  // Convert probe results to capability info
  const capabilities: RelayCapabilityInfo[] = useMemo(() => {
    return results.map((result) => ({
      capability: result.check as RelayCapabilityInfo["capability"],
      status: result.status as CapabilityStatus,
      latencyMs: result.latencyMs,
      message: result.message,
    }));
  }, [results]);

  // Calculate summary
  const summary = useMemo(() => {
    const okCount = capabilities.filter((c) => c.status === "ok").length;
    const failedCount = capabilities.filter(
      (c) => c.status === "failed" || c.status === "degraded"
    ).length;

    let overallStatus: CapabilityStatus = "unknown";
    if (capabilities.length === 0) {
      overallStatus = "unknown";
    } else if (failedCount === 0 && okCount > 0) {
      overallStatus = "ok";
    } else if (failedCount > 0 && okCount === 0) {
      overallStatus = "failed";
    } else if (failedCount > 0) {
      overallStatus = "degraded";
    }

    return {
      okCount,
      failedCount,
      totalCount: capabilities.length || 4, // 4 basic capabilities if none probed
      overallStatus,
    };
  }, [capabilities]);

  return {
    capabilities,
    isLoading,
    lastProbeAt,
    error,
    probe,
    summary,
  };
}

export default useRelayCapabilities;
