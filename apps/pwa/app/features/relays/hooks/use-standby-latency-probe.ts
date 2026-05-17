"use client";
/**
 * Periodically probes standby relay URLs for latency without connecting them
 * to the relay pool. Results feed relayHealthMonitor for settings UI.
 *
 * v1.5.2: defer first cycle until after shell paint; stagger sockets; respect visibility.
 */

import { useEffect, useRef } from "react";
import { relayHealthMonitor } from "../hooks/relay-health-monitor";
import {
  runStandbyRelayProbeCycle,
  STANDBY_PROBE_INITIAL_DELAY_MS,
  STANDBY_PROBE_INTERVAL_MS,
} from "../services/relay-standby-probe-schedule";

const isDocumentVisible = (): boolean => (
  typeof document === "undefined" || document.visibilityState !== "hidden"
);

export const useStandbyLatencyProbe = (
  standbyUrls: ReadonlyArray<string>,
): void => {
  const standbyUrlsRef = useRef<ReadonlyArray<string>>(standbyUrls);
  const intervalRef = useRef<number | null>(null);
  const initialTimerRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    standbyUrlsRef.current = standbyUrls;
  }, [standbyUrls]);

  useEffect(() => {
    if (standbyUrls.length === 0) {
      return;
    }

    const runProbes = async (): Promise<void> => {
      if (runningRef.current || !isDocumentVisible()) {
        return;
      }

      runningRef.current = true;
      try {
        const results = await runStandbyRelayProbeCycle({
          urls: standbyUrlsRef.current,
          isVisible: isDocumentVisible,
        });
        for (const result of results) {
          if (result.ok && result.latencyMs > 0) {
            relayHealthMonitor.recordLatency(result.url, result.latencyMs);
          }
        }
      } finally {
        runningRef.current = false;
      }
    };

    const scheduleInitial = (): void => {
      initialTimerRef.current = window.setTimeout(() => {
        initialTimerRef.current = null;
        void runProbes();
      }, STANDBY_PROBE_INITIAL_DELAY_MS);
    };

    if (typeof document !== "undefined" && document.readyState === "complete") {
      scheduleInitial();
    } else if (typeof window !== "undefined") {
      window.addEventListener("load", scheduleInitial, { once: true });
    } else {
      scheduleInitial();
    }

    intervalRef.current = window.setInterval(() => {
      void runProbes();
    }, STANDBY_PROBE_INTERVAL_MS);

    const onVisibilityChange = (): void => {
      if (isDocumentVisible()) {
        return;
      }
      if (initialTimerRef.current !== null) {
        window.clearTimeout(initialTimerRef.current);
        initialTimerRef.current = null;
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("load", scheduleInitial);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      if (initialTimerRef.current !== null) {
        window.clearTimeout(initialTimerRef.current);
        initialTimerRef.current = null;
      }
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  // Re-run when the standby URL set changes so newly-added standbys are probed promptly
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standbyUrls.join("|")]);
};
