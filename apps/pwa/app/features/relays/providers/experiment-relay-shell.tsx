"use client";

import React, { useCallback, useEffect, useMemo } from "react";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import type { RelayStatusSummary } from "@/app/features/messaging/types";
import { useRelayList } from "../hooks/use-relay-list";
import { useRelayPrimarySelection } from "../hooks/use-relay-primary-selection";
import type { EnhancedRelayPoolResult } from "../hooks/enhanced-relay-pool";
import type { RelayRecoveryReasonCode } from "../services/relay-recovery-policy";
import { createDefaultRelayRuntimeSnapshot } from "../services/relay-runtime-contracts";
import { windowRuntimeSupervisor } from "@/app/features/runtime/services/window-runtime-supervisor";
import {
  resolveCommunityCandidateRelayUrls,
  resolveDmTransportRelayUrls,
} from "../services/relay-transport-scope";
import { RelayContext } from "./relay-provider";

const noop = (): void => {};

const createExperimentNoopRelayPool = (): EnhancedRelayPoolResult => ({
  connections: [],
  healthMetrics: [],
  sendToOpen: noop,
  publishToUrl: async () => ({ success: false, relayUrl: "", error: "experiment_shell" }),
  publishToUrls: async () => ({
    success: false,
    successCount: 0,
    totalRelays: 0,
    results: [],
    overallError: "experiment_shell",
  }),
  publishToRelay: async () => ({ success: false, relayUrl: "", error: "experiment_shell" }),
  publishToAll: async () => ({
    success: false,
    successCount: 0,
    totalRelays: 0,
    results: [],
    overallError: "experiment_shell",
  }),
  broadcastEvent: async () => ({
    success: false,
    successCount: 0,
    totalRelays: 0,
    results: [],
    overallError: "experiment_shell",
  }),
  subscribeToMessages: () => noop,
  subscribe: () => "experiment-noop",
  unsubscribe: noop,
  getRelayHealth: () => undefined,
  getRelayCircuitState: () => "healthy",
  canConnectToRelay: () => false,
  addTransientRelay: noop,
  removeTransientRelay: noop,
  reconnectRelay: noop,
  reconnectAll: noop,
  resubscribeAll: noop,
  recycle: async () => {},
  isConnected: () => false,
  waitForConnection: async () => false,
  waitForScopedConnection: async () => false,
  getWritableRelaySnapshot: () => ({
    atUnixMs: Date.now(),
    configuredRelayUrls: [],
    writableRelayUrls: [],
    totalRelayCount: 0,
    openRelayCount: 0,
  }),
  getTransportActivitySnapshot: () => ({
    writableRelayCount: 0,
    subscribableRelayCount: 0,
    writeBlockedRelayCount: 0,
    coolingDownRelayCount: 0,
    fallbackRelayUrls: [],
    fallbackWritableRelayCount: 0,
  }),
  getActiveSubscriptionCount: () => 0,
  dispose: noop,
});

const EXPERIMENT_NOOP_RELAY_POOL = createExperimentNoopRelayPool();

export const ExperimentRelayShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const identity = useIdentity();
  const publicKeyHex = identity.state.publicKeyHex ?? null;
  const relayList = useRelayList({ publicKeyHex });
  const enabledRelayUrls = useMemo(
    () => resolveDmTransportRelayUrls(relayList.state.relays),
    [relayList.state.relays],
  );
  const communityCandidateRelayUrls = useMemo(
    () => resolveCommunityCandidateRelayUrls(relayList.state.relays),
    [relayList.state.relays],
  );
  const { selection: relaySelection, setPrimaryManual } = useRelayPrimarySelection(enabledRelayUrls);
  const relayRuntime = useMemo(
    () => ({
      ...createDefaultRelayRuntimeSnapshot({ publicKeyHex }),
      phase: "offline" as const,
    }),
    [publicKeyHex],
  );

  useEffect(() => {
    windowRuntimeSupervisor.syncRelayRuntime(relayRuntime);
  }, [relayRuntime]);

  const relayStatus = useMemo<RelayStatusSummary>(() => ({
    total: 0,
    openCount: 0,
    errorCount: 0,
    coolingDownRelayCount: 0,
  }), []);

  const triggerRelayRecovery = useCallback(
    async (_reason?: RelayRecoveryReasonCode) => relayRuntime,
    [relayRuntime],
  );

  const value = useMemo(() => ({
    relayList,
    relayPool: EXPERIMENT_NOOP_RELAY_POOL,
    relayStatus,
    enabledRelayUrls,
    communityCandidateRelayUrls,
    relayRecovery: relayRuntime.recovery,
    relayRuntime,
    triggerRelayRecovery,
    relaySelection,
    activePoolRelayUrls: [],
    relayTransportMode: "basic" as const,
    setRelayTransportMode: noop,
    setPrimaryRelay: setPrimaryManual,
  }), [
    enabledRelayUrls,
    communityCandidateRelayUrls,
    relayList,
    relayRuntime,
    relaySelection,
    relayStatus,
    setPrimaryManual,
    triggerRelayRecovery,
  ]);

  return <RelayContext.Provider value={value}>{children}</RelayContext.Provider>;
};
