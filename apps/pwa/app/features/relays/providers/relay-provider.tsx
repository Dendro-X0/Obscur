"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRelayList } from "../hooks/use-relay-list";
import { useRelayPool } from "../hooks/use-relay-pool";
import { useRelayPrimarySelection } from "../hooks/use-relay-primary-selection";
import {
  reconcilePrimarySelection,
  resolveActivePoolRelayUrls,
  resolveStandbyProbeUrls,
  type RelayPrimarySelection,
} from "../services/relay-primary-selector";
import { buildRelayHealthHints } from "../services/relay-health-hints";
import { useRelayHealthHints } from "../hooks/use-relay-health-hints";
import { useRelayTransportMode } from "../hooks/use-relay-transport-mode";
import type { RelayTransportMode } from "../services/relay-transport-mode";
import { logAppEvent } from "@/app/shared/log-app-event";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import type { RelayStatusSummary } from "@/app/features/messaging/types";
import {
  createRelayRuntimeSupervisor,
  useRelayRuntimeSnapshot,
} from "../services/relay-runtime-supervisor";
import type { RelayRecoveryReasonCode, RelayRecoverySnapshot } from "../services/relay-recovery-types";
import type { RelayRuntimeSnapshot } from "../services/relay-runtime-contracts";
import { useDesktopProfileIsolationSnapshot } from "@/app/features/profiles/services/desktop-profile-runtime";
import { useShellTransportReady } from "@/app/features/runtime/use-shell-transport-ready";
import {
  RELAY_RUNTIME_REFRESH_MIN_INTERVAL_MS,
  resolveRelayTransportBootstrapDelayMs,
} from "@/app/features/runtime/relay-transport-bootstrap-policy";
import { relayNativeAdapter } from "../hooks/relay-native-adapter";
import { listenToNativeEvent } from "@/app/features/runtime/native-event-adapter";
import { getRuntimeCapabilities } from "@/app/features/runtime/runtime-capabilities";
import { useStandbyLatencyProbe } from "../hooks/use-standby-latency-probe";
import { useRelaySessionWatchdog } from "../hooks/use-relay-session-watchdog";
import { isExperimentOfflineStubEnabled } from "@/app/features/runtime/experiment-shell-policy";
import {
  resolveCommunityCandidateRelayUrls,
  resolveDmTransportRelayUrls,
} from "../services/relay-transport-scope";
import {
  mergeNostrPoolWithCustomNodeRelayUrls,
  resolveEnabledCustomNodeRelayUrls,
} from "../services/relay-custom-node-pool";
import { readOperatorWorkspaceRelayUrl } from "@/app/features/groups/services/operator-trust-config";
import { ExperimentRelayShell } from "./experiment-relay-shell";
import { WorkspaceDevRelayBootstrapOwner } from "../components/workspace-dev-relay-bootstrap-owner";
import { isExperimentOnlineEnabled } from "@/app/features/runtime/experiment-shell-policy";
import { useTransportRelayPersistence } from "../hooks/use-transport-relay-persistence";
import { mergeSupervisorRelayUrlCandidates } from "../services/transport-relay-supervisor-bootstrap";
import {
  resolveEffectiveDmTransportRelayUrls,
  resolveEnginePoolHydrationRelayUrls,
} from "../services/transport-relay-pool-hydration";
import { useTransportEnginePoolSubscribe } from "../hooks/use-transport-engine-pool-subscribe";
import { isTransportKernelAuthority } from "@/app/features/transport-kernel/transport-kernel-policy";

interface RelayContextType {
  relayList: ReturnType<typeof useRelayList>;
  relayPool: ReturnType<typeof useRelayPool>;
  relayStatus: RelayStatusSummary;
  /** DM + profile Nostr transport (excludes workspace-only intranet relays). */
  enabledRelayUrls: ReadonlyArray<string>;
  /** Enabled private/custom relays for workspace community create. */
  communityCandidateRelayUrls: ReadonlyArray<string>;
  relayRecovery: RelayRecoverySnapshot;
  relayRuntime: RelayRuntimeSnapshot;
  triggerRelayRecovery: (reason?: RelayRecoveryReasonCode) => Promise<RelayRuntimeSnapshot>;
  relaySelection: RelayPrimarySelection;
  activePoolRelayUrls: ReadonlyArray<string>;
  relayTransportMode: RelayTransportMode;
  setRelayTransportMode: (mode: RelayTransportMode) => void;
  setPrimaryRelay: (url: string) => void;
}

export const RelayContext = createContext<RelayContextType | null>(null);

export const RelayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (isExperimentOfflineStubEnabled()) {
    return <ExperimentRelayShell>{children}</ExperimentRelayShell>;
  }
  return <FullRelayProvider>{children}</FullRelayProvider>;
};

const FullRelayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const identity = useIdentity();
  const desktopSnapshot = useDesktopProfileIsolationSnapshot();
  const publicKeyHex = identity.state.publicKeyHex ?? null;

  const relayList = useRelayList({ publicKeyHex });
  const dmTransportRelayUrls = useMemo(
    () => resolveDmTransportRelayUrls(relayList.state.relays),
    [relayList.state.relays],
  );
  const communityCandidateRelayUrls = useMemo(
    () => resolveCommunityCandidateRelayUrls(relayList.state.relays),
    [relayList.state.relays],
  );
  const enabledRelayUrls = dmTransportRelayUrls;
  const enabledRelayUrlsKey = useMemo(() => enabledRelayUrls.join("|"), [enabledRelayUrls]);
  const enabledRelayUrlsRef = useRef(enabledRelayUrls);
  enabledRelayUrlsRef.current = enabledRelayUrls;

  const { mode: relayTransportMode, setMode: setRelayTransportMode } = useRelayTransportMode();

  const shellReady = useShellTransportReady();
  const profileId = desktopSnapshot.currentWindow.profileId?.trim() || "default";
  const windowLabel = desktopSnapshot.currentWindow.windowLabel;
  const transportKernelAuthority = isTransportKernelAuthority();
  const [transportBootstrapReady, setTransportBootstrapReady] = useState(false);
  const transportPersistence = useTransportRelayPersistence({
    profileId,
    windowLabel,
    enabled: transportBootstrapReady && transportKernelAuthority,
  });
  const {
    engineConfiguredRelayUrls,
    engineCheckpointRelayUrls,
    relayCheckpoints,
  } = transportPersistence;
  const engineConfiguredRelayUrlsKey = engineConfiguredRelayUrls.join("|");
  const engineCheckpointRelayUrlsKey = engineCheckpointRelayUrls.join("|");

  const engineOnlyRelayUrls = useMemo(() => {
    const userRelaySet = new Set(
      enabledRelayUrls.map((url) => url.trim()).filter((url) => url.length > 0),
    );
    return engineConfiguredRelayUrls
      .map((url) => url.trim())
      .filter((url) => url.length > 0 && !userRelaySet.has(url));
  }, [enabledRelayUrlsKey, engineConfiguredRelayUrlsKey]);
  const engineOnlyRelayUrlsKey = engineOnlyRelayUrls.join("|");

  useEffect(() => {
    if (!shellReady) {
      setTransportBootstrapReady(false);
      return;
    }
    if (typeof window === "undefined") {
      setTransportBootstrapReady(true);
      return;
    }
    const bootstrapDelayMs = resolveRelayTransportBootstrapDelayMs(profileId);
    const timerId = window.setTimeout(() => {
      setTransportBootstrapReady(true);
    }, bootstrapDelayMs);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [profileId, shellReady]);

  const [poolRelayUrls, setPoolRelayUrls] = useState<ReadonlyArray<string>>(() => (
    enabledRelayUrls.length > 0 ? [enabledRelayUrls[0]!] : []
  ));

  const relayPool = useRelayPool(transportBootstrapReady ? poolRelayUrls : []);
  const relayPoolRef = useRef(relayPool);

  const [operatorWorkspaceRelayUrl, setOperatorWorkspaceRelayUrl] = useState<string | null>(
    () => (typeof window === "undefined" ? null : readOperatorWorkspaceRelayUrl()),
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const refreshOperatorRelay = (): void => {
      setOperatorWorkspaceRelayUrl(readOperatorWorkspaceRelayUrl());
    };
    refreshOperatorRelay();
    const onStorage = (event: StorageEvent): void => {
      if (!event.key || event.key.includes("obscur.operator.workspace_relay")) {
        refreshOperatorRelay();
      }
    };
    const onOperatorTrustChanged = (): void => {
      refreshOperatorRelay();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("obscur:operator-trust-config-changed", onOperatorTrustChanged);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("obscur:operator-trust-config-changed", onOperatorTrustChanged);
    };
  }, []);

  const customNodeRelayUrls = useMemo(() => (
    resolveEnabledCustomNodeRelayUrls({
      communityCandidateRelayUrls,
      operatorWorkspaceRelayUrl,
    })
  ), [communityCandidateRelayUrls.join("|"), operatorWorkspaceRelayUrl]);

  const enginePoolHydrationRelayUrls = useMemo(() => (
    transportKernelAuthority
      ? resolveEnginePoolHydrationRelayUrls({
        userEnabledRelayUrls: enabledRelayUrls,
        customNodeRelayUrls,
        engineConfiguredRelayUrls,
        engineCheckpointRelayUrls,
      })
      : []
  ), [
    transportKernelAuthority,
    enabledRelayUrlsKey,
    customNodeRelayUrls.join("|"),
    engineConfiguredRelayUrlsKey,
    engineCheckpointRelayUrlsKey,
  ]);

  const effectiveDmTransportRelayUrls = useMemo(() => (
    resolveEffectiveDmTransportRelayUrls({
      userDmTransportRelayUrls: enabledRelayUrls,
      enginePoolHydrationRelayUrls,
    })
  ), [enabledRelayUrlsKey, enginePoolHydrationRelayUrls.join("|")]);
  const effectiveDmTransportRelayUrlsKey = effectiveDmTransportRelayUrls.join("|");

  const { hints: relayHealthHints, hintsSignature, reconcileHintsSignature } = useRelayHealthHints({
    orderedEnabledUrls: effectiveDmTransportRelayUrls,
    pool: relayPool,
    enabled: transportBootstrapReady,
  });

  const { selection: relaySelection, setPrimaryManual } = useRelayPrimarySelection(
    effectiveDmTransportRelayUrls,
    relayHealthHints,
  );

  const relaySelectionRef = useRef(relaySelection);
  useEffect(() => {
    relaySelectionRef.current = relaySelection;
  }, [relaySelection]);

  const activePoolRelayUrls = useMemo(() => (
    resolveActivePoolRelayUrls({
      mode: relayTransportMode,
      orderedEnabledUrls: effectiveDmTransportRelayUrls,
      selection: relaySelection,
      hints: relayHealthHints,
    })
  ), [
    relayTransportMode,
    effectiveDmTransportRelayUrlsKey,
    relaySelection.primaryUrl,
    relaySelection.standbyUrls.join("|"),
    reconcileHintsSignature,
  ]);

  const poolConnectionRelayUrls = useMemo(() => (
    mergeNostrPoolWithCustomNodeRelayUrls({
      nostrActivePoolRelayUrls: activePoolRelayUrls,
      customNodeRelayUrls,
    })
  ), [activePoolRelayUrls.join("|"), customNodeRelayUrls.join("|")]);

  useEffect(() => {
    const hasUserOrCustomRelays = enabledRelayUrls.length > 0 || customNodeRelayUrls.length > 0;
    const hasEngineHydration = enginePoolHydrationRelayUrls.length > 0;
    if (!hasUserOrCustomRelays && !hasEngineHydration) {
      setPoolRelayUrls([]);
      return;
    }
    if (!transportBootstrapReady) {
      const bootstrapUrl = poolConnectionRelayUrls[0]
        ?? effectiveDmTransportRelayUrls[0]
        ?? customNodeRelayUrls[0]
        ?? enginePoolHydrationRelayUrls[0];
      if (!bootstrapUrl) {
        setPoolRelayUrls([]);
        return;
      }
      setPoolRelayUrls((previous) => (
        previous.length === 1 && previous[0] === bootstrapUrl ? previous : [bootstrapUrl]
      ));
      return;
    }
    const nextKey = poolConnectionRelayUrls.length > 0
      ? poolConnectionRelayUrls.join("|")
      : enginePoolHydrationRelayUrls.join("|");
    const nextUrls = poolConnectionRelayUrls.length > 0
      ? poolConnectionRelayUrls
      : enginePoolHydrationRelayUrls;
    setPoolRelayUrls((previous) => (previous.join("|") === nextKey ? previous : nextUrls));
  }, [
    enabledRelayUrlsKey,
    enabledRelayUrls,
    transportBootstrapReady,
    poolConnectionRelayUrls,
    customNodeRelayUrls.join("|"),
    effectiveDmTransportRelayUrlsKey,
    enginePoolHydrationRelayUrls.join("|"),
  ]);

  const standbyProbeUrls = useMemo(() => (
    resolveStandbyProbeUrls({
      orderedEnabledUrls: effectiveDmTransportRelayUrls,
      activePoolUrls: activePoolRelayUrls,
    })
  ), [effectiveDmTransportRelayUrlsKey, activePoolRelayUrls.join("|")]);

  const relayConnectionSignature = useMemo(
    () => relayPool.connections.map((connection) => `${connection.url}:${connection.status}`).join("|"),
    [relayPool.connections],
  );

  const relayRuntimeSupervisor = useMemo(() => createRelayRuntimeSupervisor(), []);
  const relayRuntime = useRelayRuntimeSnapshot(relayRuntimeSupervisor);

  const attemptPrimaryFailover = useCallback((): boolean => {
    const orderedEnabledUrls = enabledRelayUrlsRef.current;
    if (orderedEnabledUrls.length <= 1) {
      return false;
    }
    const hints = buildRelayHealthHints(orderedEnabledUrls, relayPoolRef.current);
    const current = relaySelectionRef.current;
    const reconciled = reconcilePrimarySelection(current, orderedEnabledUrls, hints);
    if (!reconciled || reconciled.primaryUrl === current.primaryUrl) {
      return false;
    }
    relaySelectionRef.current = reconciled;
    setPrimaryManual(reconciled.primaryUrl!);
    logAppEvent({
      name: "relay.primary_failover_applied",
      level: "info",
      scope: { feature: "relays", action: "primary_failover_applied" },
      context: {
        fromUrl: current.primaryUrl ?? "none",
        toUrl: reconciled.primaryUrl ?? "none",
      },
    });
    return true;
  }, [enabledRelayUrlsKey, setPrimaryManual]);
  const attemptPrimaryFailoverRef = useRef(attemptPrimaryFailover);
  attemptPrimaryFailoverRef.current = attemptPrimaryFailover;
  const relayRuntimeRefreshRafRef = useRef<number | null>(null);
  const relayRuntimeRefreshTimerRef = useRef<number | null>(null);
  const lastRuntimeRefreshAtUnixMsRef = useRef(0);
  const [transportRoutingMode, setTransportRoutingMode] = useState<"direct" | "privacy_routed">("direct");
  const [transportProxySummary, setTransportProxySummary] = useState<string | undefined>(undefined);

  useEffect(() => {
    relayPoolRef.current = relayPool;
  }, [relayPool]);

  useEffect(() => {
    const runtimeCapabilities = getRuntimeCapabilities();
    if (!runtimeCapabilities.supportsTor) {
      setTransportRoutingMode("direct");
      setTransportProxySummary(undefined);
      return;
    }

    let active = true;
    const summarizeProxyUrl = (proxyUrl: string): string | undefined => {
      const trimmed = proxyUrl.trim();
      if (trimmed.length === 0) {
        return undefined;
      }
      return trimmed.length <= 32
        ? trimmed
        : `${trimmed.slice(0, 24)}...`;
    };
    const refreshRoutingMode = async (): Promise<void> => {
      const torStatus = await relayNativeAdapter.getTorStatus();
      if (!active) {
        return;
      }
      setTransportRoutingMode(torStatus.configured ? "privacy_routed" : "direct");
      setTransportProxySummary(torStatus.configured ? summarizeProxyUrl(torStatus.proxyUrl) : undefined);
    };

    void refreshRoutingMode();

    let unlisten: (() => void) | undefined;
    void listenToNativeEvent("tor-status", () => {
      void refreshRoutingMode();
    }).then((cleanup) => {
      if (!active) {
        cleanup();
        return;
      }
      unlisten = cleanup;
    });

    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  useStandbyLatencyProbe(transportBootstrapReady ? standbyProbeUrls : []);

  const permanentPoolUrls = poolConnectionRelayUrls.length > 0
    ? poolConnectionRelayUrls
    : poolRelayUrls;
  useTransportEnginePoolSubscribe({
    enabled: transportBootstrapReady && transportKernelAuthority,
    pool: relayPool,
    permanentPoolUrls,
    engineOnlyRelayUrls,
    engineCheckpointRelayUrls,
  });

  useEffect(() => {
    if (!transportBootstrapReady) {
      return;
    }
    const supervisorActiveRelayUrls = poolConnectionRelayUrls.length > 0
      ? poolConnectionRelayUrls
      : activePoolRelayUrls.length > 0
        ? activePoolRelayUrls
        : effectiveDmTransportRelayUrls;
    relayRuntimeSupervisor.configure({
      pool: relayPoolRef.current,
      enabledRelayUrls: supervisorActiveRelayUrls,
      allEnabledRelayUrls: transportKernelAuthority
        ? mergeSupervisorRelayUrlCandidates({
          userEnabledRelayUrls: enabledRelayUrlsRef.current,
          engineConfiguredRelayUrls,
        })
        : enabledRelayUrlsRef.current,
      userEnabledRelayUrls: enabledRelayUrlsRef.current,
      engineConfiguredRelayUrls: transportKernelAuthority ? engineConfiguredRelayUrls : [],
      engineCheckpointRelayUrls: transportKernelAuthority ? engineCheckpointRelayUrls : [],
      engineRelayCheckpointCount: transportKernelAuthority ? relayCheckpoints.length : 0,
      attemptPrimaryFailover: () => attemptPrimaryFailoverRef.current(),
      scope: {
        windowLabel,
        profileId: desktopSnapshot.currentWindow.profileId,
        publicKeyHex,
        transportRoutingMode,
        transportProxySummary,
      },
    });
  }, [
    transportBootstrapReady,
    transportKernelAuthority,
    desktopSnapshot.currentWindow.profileId,
    windowLabel,
    relaySelection.primaryUrl,
    enabledRelayUrlsKey,
    engineConfiguredRelayUrlsKey,
    engineCheckpointRelayUrlsKey,
    relayCheckpoints.length,
    publicKeyHex,
    transportProxySummary,
    transportRoutingMode,
    relayRuntimeSupervisor,
    activePoolRelayUrls.join("|"),
    poolConnectionRelayUrls.join("|"),
    effectiveDmTransportRelayUrlsKey,
  ]);

  useEffect(() => {
    if (!transportBootstrapReady) {
      return;
    }

    const scheduleRefresh = (): void => {
      if (typeof window === "undefined") {
        relayRuntimeSupervisor.refresh();
        return;
      }
      const nowUnixMs = Date.now();
      const elapsedMs = nowUnixMs - lastRuntimeRefreshAtUnixMsRef.current;
      const delayMs = Math.max(
        RELAY_RUNTIME_REFRESH_MIN_INTERVAL_MS - elapsedMs,
        0,
      );
      if (relayRuntimeRefreshTimerRef.current !== null) {
        window.clearTimeout(relayRuntimeRefreshTimerRef.current);
      }
      relayRuntimeRefreshTimerRef.current = window.setTimeout(() => {
        relayRuntimeRefreshTimerRef.current = null;
        if (relayRuntimeRefreshRafRef.current !== null) {
          window.cancelAnimationFrame(relayRuntimeRefreshRafRef.current);
        }
        relayRuntimeRefreshRafRef.current = window.requestAnimationFrame(() => {
          relayRuntimeRefreshRafRef.current = null;
          lastRuntimeRefreshAtUnixMsRef.current = Date.now();
          relayRuntimeSupervisor.refresh();
        });
      }, delayMs);
    };

    scheduleRefresh();

    return () => {
      if (typeof window !== "undefined") {
        if (relayRuntimeRefreshTimerRef.current !== null) {
          window.clearTimeout(relayRuntimeRefreshTimerRef.current);
          relayRuntimeRefreshTimerRef.current = null;
        }
        if (relayRuntimeRefreshRafRef.current !== null) {
          window.cancelAnimationFrame(relayRuntimeRefreshRafRef.current);
          relayRuntimeRefreshRafRef.current = null;
        }
      }
    };
  }, [relayConnectionSignature, relayRuntimeSupervisor, transportBootstrapReady]);

  useEffect(() => {
    return () => {
      if (relayRuntimeRefreshRafRef.current !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(relayRuntimeRefreshRafRef.current);
        relayRuntimeRefreshRafRef.current = null;
      }
      if (relayRuntimeRefreshTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(relayRuntimeRefreshTimerRef.current);
        relayRuntimeRefreshTimerRef.current = null;
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
    return {
      total,
      openCount,
      errorCount,
      coolingDownRelayCount: relayRuntime.recovery.coolingDownRelayCount ?? 0,
    };
  }, [relayConnectionSignature, relayRuntime.recovery.coolingDownRelayCount, relayPool.connections.length]);

  useRelaySessionWatchdog(transportBootstrapReady ? relayPool : {
    reconnectAll: () => { },
    isConnected: () => false,
  });

  const handleDevRelayBootstrapApplied = useCallback(() => {
    relayPoolRef.current.reconnectAll();
    void relayRuntimeSupervisor.triggerRecovery("startup_warmup");
  }, [relayRuntimeSupervisor]);

  useEffect(() => {
    if (!transportBootstrapReady || typeof window === "undefined") {
      return;
    }
    const timerId = window.setTimeout(() => {
      if (!relayPoolRef.current.isConnected()) {
        void relayRuntimeSupervisor.triggerRecovery("no_writable_relays");
      }
    }, 750);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [transportBootstrapReady, enabledRelayUrlsKey, relayRuntimeSupervisor]);

  const triggerRelayRecovery = useCallback((reason: RelayRecoveryReasonCode = "manual") => {
    return relayRuntimeSupervisor.triggerRecovery(reason);
  }, [relayRuntimeSupervisor]);

  const relayRecoverySignature = useMemo(
    () => [
      relayRuntime.recovery.readiness,
      relayRuntime.recovery.writableRelayCount,
      relayRuntime.recovery.subscribableRelayCount,
      relayRuntime.recovery.coolingDownRelayCount,
      relayRuntime.recovery.recoveryAttemptCount,
      relayRuntime.recovery.recoveryReasonCode ?? "",
      relayRuntime.recovery.currentAction ?? "",
    ].join("|"),
    [
      relayRuntime.recovery.readiness,
      relayRuntime.recovery.writableRelayCount,
      relayRuntime.recovery.subscribableRelayCount,
      relayRuntime.recovery.coolingDownRelayCount,
      relayRuntime.recovery.recoveryAttemptCount,
      relayRuntime.recovery.recoveryReasonCode,
      relayRuntime.recovery.currentAction,
    ],
  );

  const relayRecovery = useMemo(
    () => relayRuntime.recovery,
    [relayRecoverySignature],
  );

  const relayRuntimeContextSignature = useMemo(
    () => [
      relayRuntime.phase,
      relayRuntime.writableRelayCount,
      relayRuntime.subscribableRelayCount,
      relayRuntime.recoveryAttemptCount,
      relayRuntime.recoveryReasonCode ?? "",
      relayRuntime.activeSubscriptionCount,
      relayRuntime.pendingOutboundCount,
    ].join("|"),
    [
      relayRuntime.phase,
      relayRuntime.writableRelayCount,
      relayRuntime.subscribableRelayCount,
      relayRuntime.recoveryAttemptCount,
      relayRuntime.recoveryReasonCode,
      relayRuntime.activeSubscriptionCount,
      relayRuntime.pendingOutboundCount,
    ],
  );

  const relayRuntimeForContext = useMemo(
    () => relayRuntime,
    [relayRuntimeContextSignature],
  );

  const value = useMemo(() => ({
    relayList,
    relayPool,
    relayStatus,
    enabledRelayUrls,
    communityCandidateRelayUrls,
    relayRecovery,
    relayRuntime: relayRuntimeForContext,
    triggerRelayRecovery,
    relaySelection,
    activePoolRelayUrls,
    relayTransportMode,
    setRelayTransportMode,
    setPrimaryRelay: setPrimaryManual,
  }), [
    enabledRelayUrlsKey,
    communityCandidateRelayUrls,
    relayList,
    relayPool,
    relayRecovery,
    relayRuntimeForContext,
    relayStatus,
    triggerRelayRecovery,
    relaySelection,
    activePoolRelayUrls,
    relayTransportMode,
    setRelayTransportMode,
    setPrimaryManual,
  ]);

  return (
    <RelayContext.Provider value={value}>
      <WorkspaceDevRelayBootstrapOwner
        enabled={isExperimentOnlineEnabled() && transportBootstrapReady}
        relayList={relayList}
        onBootstrapApplied={handleDevRelayBootstrapApplied}
      />
      {children}
    </RelayContext.Provider>
  );
};

export const useRelay = () => {
  const context = useContext(RelayContext);
  if (!context) {
    throw new Error("useRelay must be used within a RelayProvider");
  }
  return context;
};
