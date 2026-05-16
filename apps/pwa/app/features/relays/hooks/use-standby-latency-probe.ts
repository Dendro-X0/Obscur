"use client";
/**
 * use-standby-latency-probe.ts
 *
 * Periodically probes standby relay URLs for latency without connecting them
 * to the relay pool.  Results are fed into relayHealthMonitor so the settings
 * dashboard can show latency even for disconnected standby nodes.
 *
 * Rules:
 *  - Only probes when the document is visible (no background battery drain).
 *  - Probes run sequentially per URL to avoid thundering-herd on startup.
 *  - Interval resets when the standby list changes.
 *  - Probe sockets are closed immediately after measurement.
 */

import { useEffect, useRef } from "react";
import { relayHealthMonitor } from "../hooks/relay-health-monitor";
import { probeStandbyRelayLatency } from "../services/standby-latency-prober";

const PROBE_INTERVAL_MS = 30_000;
const INITIAL_PROBE_DELAY_MS = 4_000;

export const useStandbyLatencyProbe = (
  standbyUrls: ReadonlyArray<string>,
): void => {
  const standbyUrlsRef = useRef<ReadonlyArray<string>>(standbyUrls);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    standbyUrlsRef.current = standbyUrls;
  }, [standbyUrls]);

  useEffect(() => {
    if (standbyUrls.length === 0) {
      return;
    }

    const runProbes = async (): Promise<void> => {
      if (runningRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

      runningRef.current = true;
      try {
        for (const url of standbyUrlsRef.current) {
          const result = await probeStandbyRelayLatency(url);
          if (result.ok && result.latencyMs > 0) {
            relayHealthMonitor.recordLatency(url, result.latencyMs);
          }
        }
      } finally {
        runningRef.current = false;
      }
    };

    initialTimerRef.current = setTimeout(() => {
      void runProbes();
    }, INITIAL_PROBE_DELAY_MS);

    intervalRef.current = setInterval(() => {
      void runProbes();
    }, PROBE_INTERVAL_MS);

    return () => {
      if (initialTimerRef.current !== null) {
        clearTimeout(initialTimerRef.current);
        initialTimerRef.current = null;
      }
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  // Re-run when the standby URL set changes so newly-added standbys are probed promptly
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standbyUrls.join("|")]);
};
