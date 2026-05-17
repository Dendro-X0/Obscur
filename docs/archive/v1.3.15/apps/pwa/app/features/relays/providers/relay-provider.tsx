"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useRelayList } from "../hooks/use-relay-list";
import { useRelayPool } from "../hooks/use-relay-pool";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import type { RelayStatusSummary } from "@/app/features/messaging/types";
import {
  createRelayRuntimeSupervisor,
  useRelayRuntimeSnapshot,
} from "../services/relay-runtime-supervisor";
import type { RelayRecoveryReasonCode, RelayRecoverySnapshot } from "../services/relay-recovery-policy";
import type { RelayRuntimeSnapshot } from "../services/relay-runtime-contracts";
import { useDesktopProfileIsolationSnapshot } from "@/app/features/profiles/services/desktop-profile-runtime";
import { windowRuntimeSupervisor } from "@/app/features/runtime/services/window-runtime-supervisor";

interface RelayContextType {
  relayList: ReturnType<typeof useRelayList>;
  relayPool: ReturnType<typeof useRelayPool>;
  relayStatus: RelayStatusSummary;
  enabledRelayUrls: ReadonlyArray<string>;
  relayRecovery: RelayRecoverySnapshot;
  relayRuntime: RelayRuntimeSnapshot;
  triggerRelayRecovery: (reason?: RelayRecoveryReasonCode) => Promise<RelayRuntimeSnapshot>;
}

const RelayContext = createContext<RelayContextType | null>(null);

export const RelayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const identity = useIdentity();
  const desktopSnapshot = useDesktopProfileIsolationSnapshot();
  const publicKeyHex = identity.state.publicKeyHex ?? null;

  const relayList = useRelayList({ publicKeyHex });
  const enabledRelayUrls = useMemo(() => {
    return relayList.state.relays
      .filter((relay) => relay.enabled)
      .map((relay) => relay.url);
  }, [relayList.state.relays]);
  const enabledRelayUrlsKey = useMemo(() => enabledRelayUrls.join("|"), [enabledRelayUrls]);

  const relayPool = useRelayPool(enabledRelayUrls);
  const relayPoolRef = useRef(relayPool);
  const relayRuntimeSupervisor = useMemo(() => createRelayRuntimeSupervisor(), []);
  const relayRuntime = useRelayRuntimeSnapshot(relayRuntimeSupervisor);
  const relayRuntimeRefreshRafRef = useRef<number | null>(null);

  useEffect(() => {
    relayPoolRef.current = relayPool;
  }, [relayPool]);

  useEffect(() => {
    relayRuntimeSupervisor.configure({
      pool: relayPoolRef.current,
      enabledRelayUrls,
      scope: {
        windowLabel: desktopSnapshot.currentWindow.windowLabel,
        profileId: desktopSnapshot.currentWindow.profileId,
        publicKeyHex,
      },
    });
  }, [
    desktopSnapshot.currentWindow.profileId,
    desktopSnapshot.currentWindow.windowLabel,
    enabledRelayUrlsKey,
    publicKeyHex,
    relayPool.getWritableRelaySnapshot,
    relayPool.getTransportActivitySnapshot,
    relayPool.reconnectAll,
    relayPool.resubscribeAll,
    relayPool.recycle,
    relayRuntimeSupervisor,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      relayRuntimeSupervisor.refresh();
      return;
    }
    if (relayRuntimeRefreshRafRef.current !== null) {
      window.cancelAnimationFrame(relayRuntimeRefreshRafRef.current);
    }
    relayRuntimeRefreshRafRef.current = window.requestAnimationFrame(() => {
      relayRuntimeRefreshRafRef.current = null;
      relayRuntimeSupervisor.refresh();
    });
    return () => {
      if (relayRuntimeRefreshRafRef.current !== null) {
        window.cancelAnimationFrame(relayRuntimeRefreshRafRef.current);
        relayRuntimeRefreshRafRef.current = null;
      }
    };
  }, [relayPool.connections, relayPool.healthMetrics, relayRuntimeSupervisor]);

  useEffect(() => {
    windowRuntimeSupervisor.syncRelayRuntime(relayRuntime);
  }, [relayRuntime]);

  useEffect(() => {
    return () => {
      if (relayRuntimeRefreshRafRef.current !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(relayRuntimeRefreshRafRef.current);
        relayRuntimeRefreshRafRef.current = null;
      }
      relayRuntimeSupervisor.dispose();
    };
  }, [relayRuntimeSupervisor]);

  const relayStatus = useMemo<RelayStatusSummary>(() => {
    const total = relayPool.connections.length;
    let openCount = 0;
    let errorCount = 0;
    relayPool.connections.forEach((conn) => {
      if (conn.status === "open") openCount++;
      if (conn.status === "error") errorCount++;
    });
    return { total, openCount, errorCount };
  }, [relayPool.connections]);

  const triggerRelayRecovery = useCallback((reason: RelayRecoveryReasonCode = "manual") => {
    return relayRuntimeSupervisor.triggerRecovery(reason);
  }, [relayRuntimeSupervisor]);

  const value = useMemo(() => ({
    relayList,
    relayPool,
    relayStatus,
    enabledRelayUrls,
    relayRecovery: relayRuntime.recovery,
    relayRuntime,
    triggerRelayRecovery,
  }), [enabledRelayUrls, relayList, relayPool, relayRuntime, relayStatus, triggerRelayRecovery]);

  return <RelayContext.Provider value={value}>{children}</RelayContext.Provider>;
};

export const useRelay = () => {
  const context = useContext(RelayContext);
  if (!context) {
    throw new Error("useRelay must be used within a RelayProvider");
  }
  return context;
};
