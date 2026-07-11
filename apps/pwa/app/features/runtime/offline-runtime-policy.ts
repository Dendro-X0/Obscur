"use client";

/** Browser reports no network — transport may still attempt loopback but must not block shell. */
export const isBrowserOffline = (): boolean => {
  if (typeof navigator === "undefined") {
    return false;
  }
  return navigator.onLine === false;
};

/**
 * Skip relay profile/list fetch only when offline.
 * Native desktop still hydrates published kind-0 profile from relays on unlock (Nostr-standard).
 * Fetch is async with a short timeout and does not block the shell.
 */
export const shouldSkipRelayNetworkBootstrap = (): boolean => isBrowserOffline();

/** Relay publish is unavailable — outbound should queue, not block the shell. */
export const isTransportPublishAvailable = (writableRelayCount: number): boolean => {
  if (isBrowserOffline()) {
    return false;
  }
  return writableRelayCount > 0;
};
