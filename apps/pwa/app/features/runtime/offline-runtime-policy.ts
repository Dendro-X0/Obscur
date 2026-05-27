"use client";

import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";

/** Browser reports no network — transport may still attempt loopback but must not block shell. */
export const isBrowserOffline = (): boolean => {
  if (typeof navigator === "undefined") {
    return false;
  }
  return navigator.onLine === false;
};

/**
 * Local-first bootstrap: do not block account rehydrate on relay profile/backup fetch.
 * Native desktop/mobile uses SQLite + local stores; relay is transport-only.
 */
export const shouldSkipRelayNetworkBootstrap = (): boolean => (
  requiresSqlitePersistence() || isBrowserOffline()
);

/** Relay publish is unavailable — outbound should queue, not block the shell. */
export const isTransportPublishAvailable = (writableRelayCount: number): boolean => {
  if (isBrowserOffline()) {
    return false;
  }
  return writableRelayCount > 0;
};
