"use client";

/**
 * Narrow window-runtime subscription for relay transport bootstrap.
 * Avoids RelayProvider re-rendering on every relayRuntime tick.
 * Relay metrics live on RelayContext / window.obscurRelayRuntime — not windowRuntimeSupervisor.
 */

import { useSyncExternalStore } from "react";
import { windowRuntimeSupervisor } from "./services/window-runtime-supervisor";

const isShellTransportReady = (): boolean => {
  const phase = windowRuntimeSupervisor.getSnapshot().phase;
  return phase === "ready" || phase === "degraded";
};

export const useShellTransportReady = (): boolean => (
  useSyncExternalStore(
    windowRuntimeSupervisor.subscribe,
    isShellTransportReady,
    () => false,
  )
);
