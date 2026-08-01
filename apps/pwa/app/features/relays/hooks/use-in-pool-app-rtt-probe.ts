"use client";
/**
 * Periodic in-pool REQ→EOSE RTT on open sockets. Feeds relayHealthMonitor.
 * @see specs/backend/relay-in-pool-app-rtt-design-2026-07.md
 */

import { useEffect, useRef } from "react";
import type { EnhancedRelayPoolResult } from "./enhanced-relay-pool-types";
import { relayHealthMonitor } from "./relay-health-monitor";
import {
  IN_POOL_RTT_INITIAL_DELAY_MS,
  IN_POOL_RTT_INTERVAL_MS,
  runInPoolAppRttCycle,
} from "../services/in-pool-app-rtt-probe";

const isDocumentVisible = (): boolean => (
  typeof document === "undefined" || document.visibilityState !== "hidden"
);

export const useInPoolAppRttProbe = (
  openUrls: ReadonlyArray<string>,
  pool: Pick<EnhancedRelayPoolResult, "sendToOpen" | "subscribeToMessages"> | null,
): void => {
  const openUrlsRef = useRef(openUrls);
  const poolRef = useRef(pool);
  const intervalRef = useRef<number | null>(null);
  const initialTimerRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    openUrlsRef.current = openUrls;
  }, [openUrls]);

  useEffect(() => {
    poolRef.current = pool;
  }, [pool]);

  useEffect(() => {
    if (!pool || openUrls.length === 0) {
      return;
    }

    const runCycle = async (): Promise<void> => {
      const activePool = poolRef.current;
      if (runningRef.current || !activePool || !isDocumentVisible()) {
        return;
      }
      if (openUrlsRef.current.length === 0) {
        return;
      }

      runningRef.current = true;
      try {
        const results = await runInPoolAppRttCycle({
          openUrls: openUrlsRef.current,
          sendToOpen: activePool.sendToOpen,
          subscribeToMessages: activePool.subscribeToMessages,
        });
        for (const result of results) {
          if (result.ok && result.latencyMs > 0) {
            relayHealthMonitor.recordLatency(result.url, result.latencyMs, "app");
          }
        }
      } finally {
        runningRef.current = false;
      }
    };

    const scheduleInitial = (): void => {
      initialTimerRef.current = window.setTimeout(() => {
        initialTimerRef.current = null;
        void runCycle();
      }, IN_POOL_RTT_INITIAL_DELAY_MS);
    };

    if (typeof document !== "undefined" && document.readyState === "complete") {
      scheduleInitial();
    } else if (typeof window !== "undefined") {
      window.addEventListener("load", scheduleInitial, { once: true });
    } else {
      scheduleInitial();
    }

    intervalRef.current = window.setInterval(() => {
      void runCycle();
    }, IN_POOL_RTT_INTERVAL_MS);

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("load", scheduleInitial);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openUrls.join("|"), Boolean(pool)]);
};
