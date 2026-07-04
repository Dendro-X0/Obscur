"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { EnhancedRelayPoolResult } from "./enhanced-relay-pool-types";
import { createEnhancedRelayPoolRuntime } from "./enhanced-relay-pool-legacy";

type EnhancedRelayPoolRuntime = ReturnType<typeof createEnhancedRelayPoolRuntime>;
type RelayPoolState = ReturnType<EnhancedRelayPoolRuntime["getStateSnapshot"]>;

const serverSnapshot: RelayPoolState = { connections: [], healthMetrics: [] };

/** Shared React hook for enhanced relay pool runtime — used by legacy and transport-kernel pool hooks. */
export const useEnhancedRelayPoolRuntime = (urls: ReadonlyArray<string>): EnhancedRelayPoolResult => {
  const [runtime] = useState<EnhancedRelayPoolRuntime>(() => createEnhancedRelayPoolRuntime());
  const urlsKey: string = urls.join("|");
  const urlsFromKey: ReadonlyArray<string> = useMemo(() => (urlsKey ? urlsKey.split("|") : []), [urlsKey]);

  useEffect(() => {
    runtime.setRelayUrls(urlsFromKey);
  }, [runtime, urlsKey, urlsFromKey]);

  useEffect(() => {
    return () => {
      runtime.dispose();
    };
  }, [runtime]);

  const snapshot: RelayPoolState = useSyncExternalStore(runtime.subscribe, runtime.getStateSnapshot, () => serverSnapshot);

  return useMemo(() => ({
    connections: snapshot.connections,
    healthMetrics: snapshot.healthMetrics,
    sendToOpen: runtime.sendToOpen,
    publishToUrl: runtime.publishToUrl,
    publishToUrls: runtime.publishToUrls,
    publishToRelay: runtime.publishToRelay,
    publishToAll: runtime.publishToAll,
    broadcastEvent: runtime.broadcastEvent,
    subscribeToMessages: runtime.subscribeToMessages,
    subscribe: runtime.subscribeFilters,
    unsubscribe: runtime.unsubscribeFilters,
    getRelayHealth: runtime.getRelayHealth,
    getRelayCircuitState: runtime.getRelayCircuitState,
    canConnectToRelay: runtime.canConnectToRelay,
    addTransientRelay: runtime.addTransientRelay,
    removeTransientRelay: runtime.removeTransientRelay,
    reconnectRelay: runtime.reconnectRelay,
    reconnectAll: runtime.reconnectAll,
    resubscribeAll: runtime.resubscribeAll,
    recycle: runtime.recycle,
    isConnected: runtime.isConnected,
    waitForConnection: runtime.waitForConnection,
    waitForScopedConnection: runtime.waitForScopedConnection,
    getWritableRelaySnapshot: runtime.getWritableRelaySnapshot,
    getTransportActivitySnapshot: runtime.getTransportActivitySnapshot,
    getActiveSubscriptionCount: runtime.getActiveSubscriptionCount,
    dispose: runtime.dispose,
  }), [runtime, snapshot]);
};
