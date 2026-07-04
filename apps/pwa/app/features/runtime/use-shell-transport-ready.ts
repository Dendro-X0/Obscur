"use client";

/**
 * Narrow window-runtime subscription for relay transport bootstrap.
 * Avoids RelayProvider re-rendering on every relayRuntime tick.
 * Relay metrics live on RelayContext / window.obscurRelayRuntime — not windowRuntimeSupervisor.
 */

import { useSyncExternalStore } from "react";
import { subscribeIdentityStore } from "@/app/features/auth/hooks/use-identity";
import { isRuntimeTransportOwnerEnabled } from "./runtime-transport-owner-policy";
import { windowRuntimeSupervisor } from "./services/window-runtime-supervisor";

const subscribeShellTransportReady = (listener: () => void): (() => void) => {
  const unsubscribeWindow = windowRuntimeSupervisor.subscribe(listener);
  const unsubscribeIdentity = subscribeIdentityStore(listener);
  return () => {
    unsubscribeWindow();
    unsubscribeIdentity();
  };
};

export const useShellTransportReady = (): boolean => (
  useSyncExternalStore(
    subscribeShellTransportReady,
    isRuntimeTransportOwnerEnabled,
    () => false,
  )
);
