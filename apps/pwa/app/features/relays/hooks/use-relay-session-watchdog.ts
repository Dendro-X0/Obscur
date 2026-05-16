"use client";
/**
 * use-relay-session-watchdog.ts
 *
 * Maintains relay connectivity during long user sessions by reacting to
 * three signals that the existing reconnect machinery cannot observe:
 *
 *  1. Tab visibility restored  — browser/OS may have silently killed WebSocket
 *     connections while the tab was hidden or the device was sleeping.
 *
 *  2. Network `online` event   — device regained network access; stale sockets
 *     will not auto-recover because no `close` event fires on a frozen socket.
 *
 *  3. Periodic health tick     — catches "silent stale" connections where
 *     readyState is OPEN at the JS layer but the TCP connection was dropped
 *     by an intermediate NAT/firewall without sending a FIN packet.
 *
 * Rules:
 *  - Force-reconnect only fires for relays that are not currently OPEN.
 *  - The periodic tick is suppressed while the document is hidden to avoid
 *    background battery drain.
 *  - All reconnect attempts go through the pool's existing `reconnectAll`
 *    path, which respects circuit breaker and cooldown state.
 *  - No keepalive ping frames are sent — not all relays accept non-spec frames.
 */

import { useEffect, useRef } from "react";

const HEALTH_TICK_INTERVAL_MS = 45_000;

interface WatchdogPool {
  reconnectAll: (options?: { force?: boolean }) => void;
  isConnected: () => boolean;
}

export const useRelaySessionWatchdog = (pool: WatchdogPool): void => {
  const poolRef = useRef<WatchdogPool>(pool);

  useEffect(() => {
    poolRef.current = pool;
  }, [pool]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleVisibilityChange = (): void => {
      if (document.visibilityState !== "visible") return;
      if (!poolRef.current.isConnected()) {
        poolRef.current.reconnectAll();
      }
    };

    const handleOnline = (): void => {
      poolRef.current.reconnectAll();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    const tick = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      if (!poolRef.current.isConnected()) {
        poolRef.current.reconnectAll();
      }
    }, HEALTH_TICK_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      clearInterval(tick);
    };
  }, []);
};
