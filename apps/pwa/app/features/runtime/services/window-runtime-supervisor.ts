"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { Passphrase } from "@dweb/crypto/passphrase";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { desktopProfileRuntime, useDesktopProfileIsolationSnapshot } from "@/app/features/profiles/services/desktop-profile-runtime";
import type { ProfileIsolationSnapshot } from "@/app/features/profiles/services/profile-isolation-contracts";
import {
  createDefaultRelayRuntimeSnapshot,
  type RelayRuntimeSnapshot,
} from "@/app/features/relays/services/relay-runtime-contracts";
import {
  type MessagingTransportRuntimeSnapshot,
  type ProfileBoundSessionSnapshot,
  type RelationshipRuntimeSnapshot,
  type RuntimeActivationReport,
  type TransportQueueSnapshot,
  type WindowRuntimeDegradedReason,
  type WindowRuntimePhase,
  type WindowRuntimeSnapshot,
} from "./window-runtime-contracts";

type Listener = () => void;

const listeners = new Set<Listener>();

const now = (): number => Date.now();

const defaultSession: ProfileBoundSessionSnapshot = {
  windowLabel: "main",
  profileId: "default",
  profileLabel: "Default",
  identityStatus: "loading",
};

const createDefaultTransportQueueSnapshot = (): TransportQueueSnapshot => ({
  pendingCount: 0,
  updatedAtUnixMs: now(),
});

const createDefaultRelationshipRuntimeSnapshot = (): RelationshipRuntimeSnapshot => ({
  acceptedPeerCount: 0,
  pendingIncomingCount: 0,
  pendingOutgoingCount: 0,
  updatedAtUnixMs: now(),
});

const createDefaultMessagingTransportRuntimeSnapshot = (): MessagingTransportRuntimeSnapshot => ({
  activeIncomingOwnerCount: 0,
  activeQueueProcessorCount: 0,
  updatedAtUnixMs: now(),
});

const defaultSnapshot: WindowRuntimeSnapshot = {
  phase: "booting",
  degradedReason: "none",
  phaseEnteredAtUnixMs: now(),
  session: defaultSession,
  relayRuntime: createDefaultRelayRuntimeSnapshot({
    windowLabel: defaultSession.windowLabel,
    profileId: defaultSession.profileId,
  }),
  transportQueue: createDefaultTransportQueueSnapshot(),
  relationshipRuntime: createDefaultRelationshipRuntimeSnapshot(),
  messagingTransportRuntime: createDefaultMessagingTransportRuntimeSnapshot(),
  traces: [{
    phase: "booting",
    enteredAtUnixMs: now(),
    outcome: "entered",
  }],
};

let snapshot: WindowRuntimeSnapshot = defaultSnapshot;

const emit = (): void => {
  listeners.forEach((listener) => listener());
};

const completeCurrentTrace = (reason?: string): ReadonlyArray<WindowRuntimeSnapshot["traces"][number]> => {
  const traces = [...snapshot.traces];
  const last = traces[traces.length - 1];
  if (!last || last.completedAtUnixMs) {
    return traces;
  }
  traces[traces.length - 1] = {
    ...last,
    completedAtUnixMs: now(),
    durationMs: now() - last.enteredAtUnixMs,
    outcome: reason ? "failed" : "completed",
    reason: reason ?? last.reason,
  };
  return traces;
};

const setSnapshot = (next: WindowRuntimeSnapshot): void => {
  snapshot = next;
  if (typeof window !== "undefined") {
    (window as Window & { obscurWindowRuntime?: unknown }).obscurWindowRuntime = {
      getSnapshot: () => snapshot,
      getTrace: () => snapshot.traces,
    };
  }
  emit();
};

const transitionTo = (
  phase: WindowRuntimePhase,
  patch: Partial<WindowRuntimeSnapshot> = {},
  reason?: string,
): void => {
  if (snapshot.phase === phase && !patch.lastError && !patch.lastActivationReport) {
    return;
  }
  const traces = [
    ...completeCurrentTrace(reason),
    {
      phase,
      enteredAtUnixMs: now(),
      outcome: "entered" as const,
      reason,
    },
  ];
  setSnapshot({
    ...snapshot,
    ...patch,
    phase,
    phaseEnteredAtUnixMs: now(),
    traces,
  });
};

const bindProfile = (desktopSnapshot: ProfileIsolationSnapshot): void => {
  const nextSession: ProfileBoundSessionSnapshot = {
    ...snapshot.session,
    windowLabel: desktopSnapshot.currentWindow.windowLabel,
    profileId: desktopSnapshot.currentWindow.profileId,
    profileLabel: desktopSnapshot.currentWindow.profileLabel,
  };
  if (
    snapshot.session.windowLabel === nextSession.windowLabel
    && snapshot.session.profileId === nextSession.profileId
    && snapshot.session.profileLabel === nextSession.profileLabel
  ) {
    return;
  }
  transitionTo("binding_profile", {
    degradedReason: "none",
    lastError: undefined,
    session: nextSession,
    relayRuntime: createDefaultRelayRuntimeSnapshot({
      windowLabel: nextSession.windowLabel,
      profileId: nextSession.profileId,
      publicKeyHex: nextSession.unlockedPublicKeyHex,
    }),
    transportQueue: createDefaultTransportQueueSnapshot(),
    relationshipRuntime: createDefaultRelationshipRuntimeSnapshot(),
    messagingTransportRuntime: createDefaultMessagingTransportRuntimeSnapshot(),
    runtimeActivatedAtUnixMs: undefined,
    lastActivationReport: undefined,
    traces: [],
  });
};

export const windowRuntimeSupervisor = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): WindowRuntimeSnapshot {
    return snapshot;
  },
  bindProfile,
  syncRelayRuntime(relayRuntime: RelayRuntimeSnapshot): void {
    const current = snapshot.relayRuntime;
    if (
      current.instanceId === relayRuntime.instanceId
      && current.updatedAtUnixMs === relayRuntime.updatedAtUnixMs
      && current.phase === relayRuntime.phase
      && current.writableRelayCount === relayRuntime.writableRelayCount
      && current.subscribableRelayCount === relayRuntime.subscribableRelayCount
      && current.activeSubscriptionCount === relayRuntime.activeSubscriptionCount
      && current.lastInboundMessageAtUnixMs === relayRuntime.lastInboundMessageAtUnixMs
      && current.lastInboundEventAtUnixMs === relayRuntime.lastInboundEventAtUnixMs
      && current.lastSuccessfulPublishAtUnixMs === relayRuntime.lastSuccessfulPublishAtUnixMs
      && current.recoveryAttemptCount === relayRuntime.recoveryAttemptCount
      && current.recoveryReasonCode === relayRuntime.recoveryReasonCode
    ) {
      return;
    }
    setSnapshot({
      ...snapshot,
      relayRuntime,
    });
  },
  syncTransportQueue(transportQueue: TransportQueueSnapshot): void {
    const current = snapshot.transportQueue;
    if (
      current.pendingCount === transportQueue.pendingCount
      && current.updatedAtUnixMs === transportQueue.updatedAtUnixMs
    ) {
      return;
    }
    setSnapshot({
      ...snapshot,
      transportQueue,
    });
  },
  syncRelationshipRuntime(relationshipRuntime: RelationshipRuntimeSnapshot): void {
    const current = snapshot.relationshipRuntime;
    if (
      current.acceptedPeerCount === relationshipRuntime.acceptedPeerCount
      && current.pendingIncomingCount === relationshipRuntime.pendingIncomingCount
      && current.pendingOutgoingCount === relationshipRuntime.pendingOutgoingCount
      && current.updatedAtUnixMs === relationshipRuntime.updatedAtUnixMs
    ) {
      return;
    }
    setSnapshot({
      ...snapshot,
      relationshipRuntime,
    });
  },
  syncMessagingTransportRuntime(messagingTransportRuntime: MessagingTransportRuntimeSnapshot): void {
    const current = snapshot.messagingTransportRuntime;
    if (
      current.activeIncomingOwnerCount === messagingTransportRuntime.activeIncomingOwnerCount
      && current.activeQueueProcessorCount === messagingTransportRuntime.activeQueueProcessorCount
      && current.updatedAtUnixMs === messagingTransportRuntime.updatedAtUnixMs
    ) {
      return;
    }
    setSnapshot({
      ...snapshot,
      messagingTransportRuntime,
    });
  },
  syncIdentity(params: Readonly<{
    identityStatus: ProfileBoundSessionSnapshot["identityStatus"];
    storedPublicKeyHex?: string;
    unlockedPublicKeyHex?: string;
    error?: string;
  }>): void {
    if (
      snapshot.session.identityStatus === params.identityStatus
      && snapshot.session.storedPublicKeyHex === params.storedPublicKeyHex
      && snapshot.session.unlockedPublicKeyHex === params.unlockedPublicKeyHex
      && snapshot.lastError === params.error
    ) {
      return;
    }
    const nextSession: ProfileBoundSessionSnapshot = {
      ...snapshot.session,
      identityStatus: params.identityStatus,
      storedPublicKeyHex: params.storedPublicKeyHex,
      unlockedPublicKeyHex: params.unlockedPublicKeyHex,
    };
    setSnapshot({
      ...snapshot,
      session: nextSession,
      lastError: params.error ?? snapshot.lastError,
    });
    if (params.identityStatus === "error") {
      transitionTo("fatal", {
        degradedReason: "identity_error",
        lastError: params.error ?? "Identity error",
        session: nextSession,
      }, params.error ?? "Identity error");
      return;
    }
    if (params.identityStatus === "loading") {
      transitionTo("binding_profile", {
        degradedReason: "none",
        session: nextSession,
        relayRuntime: createDefaultRelayRuntimeSnapshot({
          windowLabel: nextSession.windowLabel,
          profileId: nextSession.profileId,
          publicKeyHex: nextSession.unlockedPublicKeyHex,
        }),
      });
      return;
    }
    if (params.identityStatus === "locked") {
      transitionTo("auth_required", {
        degradedReason: "none",
        lastError: undefined,
        session: nextSession,
        relayRuntime: createDefaultRelayRuntimeSnapshot({
          windowLabel: nextSession.windowLabel,
          profileId: nextSession.profileId,
          publicKeyHex: nextSession.unlockedPublicKeyHex,
        }),
      });
      return;
    }
    if (params.identityStatus === "unlocked" && !["ready", "degraded"].includes(snapshot.phase)) {
      transitionTo("activating_runtime", {
        degradedReason: "none",
        lastError: undefined,
        session: nextSession,
      });
    }
  },
  beginUnlock(mode: "create" | "import" | "unlock"): void {
    transitionTo("unlocking", {
      degradedReason: "none",
      lastError: undefined,
    }, mode);
  },
  markRuntimeReady(report: RuntimeActivationReport): void {
    transitionTo("ready", {
      degradedReason: "none",
      runtimeActivatedAtUnixMs: report.completedAtUnixMs,
      lastActivationReport: report,
    });
  },
  markRuntimeDegraded(reason: WindowRuntimeDegradedReason, report: RuntimeActivationReport): void {
    transitionTo("degraded", {
      degradedReason: reason,
      runtimeActivatedAtUnixMs: report.completedAtUnixMs,
      lastActivationReport: report,
      lastError: report.message,
    }, report.message);
  },
  markFatal(reason: WindowRuntimeDegradedReason, error: string): void {
    transitionTo("fatal", {
      degradedReason: reason,
      lastError: error,
    }, error);
  },
  resetToAuthRequired(): void {
    transitionTo("auth_required", {
      degradedReason: "none",
      lastError: undefined,
      runtimeActivatedAtUnixMs: undefined,
      lastActivationReport: undefined,
      relayRuntime: createDefaultRelayRuntimeSnapshot({
        windowLabel: snapshot.session.windowLabel,
        profileId: snapshot.session.profileId,
      }),
      transportQueue: createDefaultTransportQueueSnapshot(),
      relationshipRuntime: createDefaultRelationshipRuntimeSnapshot(),
      messagingTransportRuntime: createDefaultMessagingTransportRuntimeSnapshot(),
    });
  },
};

export const useWindowRuntimeSnapshot = (): WindowRuntimeSnapshot => (
  useSyncExternalStore(windowRuntimeSupervisor.subscribe, windowRuntimeSupervisor.getSnapshot, windowRuntimeSupervisor.getSnapshot)
);

export const useWindowRuntime = () => {
  const identity = useIdentity();
  const desktopSnapshot = useDesktopProfileIsolationSnapshot();
  const runtimeSnapshot = useWindowRuntimeSnapshot();

  useEffect(() => {
    windowRuntimeSupervisor.bindProfile(desktopSnapshot);
    windowRuntimeSupervisor.syncIdentity({
      identityStatus: identity.state.status,
      storedPublicKeyHex: identity.state.stored?.publicKeyHex,
      unlockedPublicKeyHex: identity.state.publicKeyHex,
      error: identity.state.error,
    });
  }, [
    desktopSnapshot,
    identity.state.error,
    identity.state.publicKeyHex,
    identity.state.status,
    identity.state.stored?.publicKeyHex,
  ]);

  return useMemo(() => ({
    snapshot: runtimeSnapshot,
    refreshWindowBinding: desktopProfileRuntime.refresh,
    createIdentityForBoundProfile: async (params: Readonly<{ passphrase: Passphrase; username?: string }>): Promise<void> => {
      windowRuntimeSupervisor.beginUnlock("create");
      try {
        await identity.createIdentity(params);
      } catch (error) {
        windowRuntimeSupervisor.resetToAuthRequired();
        throw error;
      }
    },
    importIdentityForBoundProfile: async (params: Readonly<{ privateKeyHex: PrivateKeyHex; passphrase: Passphrase; username?: string }>): Promise<void> => {
      windowRuntimeSupervisor.beginUnlock("import");
      try {
        await identity.importIdentity(params);
      } catch (error) {
        windowRuntimeSupervisor.resetToAuthRequired();
        throw error;
      }
    },
    unlockBoundProfile: async (params: Readonly<{ passphrase: Passphrase }>): Promise<void> => {
      windowRuntimeSupervisor.beginUnlock("unlock");
      try {
        await identity.unlockIdentity(params);
      } catch (error) {
        windowRuntimeSupervisor.resetToAuthRequired();
        throw error;
      }
    },
    logoutBoundProfile: async (): Promise<void> => {
      await identity.forgetIdentity();
      windowRuntimeSupervisor.resetToAuthRequired();
    },
    lockBoundProfile: (): void => {
      identity.lockIdentity();
      windowRuntimeSupervisor.resetToAuthRequired();
    },
    markRuntimeReady: windowRuntimeSupervisor.markRuntimeReady,
    markRuntimeDegraded: windowRuntimeSupervisor.markRuntimeDegraded,
    markFatal: windowRuntimeSupervisor.markFatal,
  }), [identity, runtimeSnapshot]);
};

export const windowRuntimeSupervisorInternals = {
  resetForTests: (): void => {
    snapshot = {
      ...defaultSnapshot,
      phaseEnteredAtUnixMs: now(),
      relayRuntime: createDefaultRelayRuntimeSnapshot({
        windowLabel: defaultSession.windowLabel,
        profileId: defaultSession.profileId,
      }),
      transportQueue: createDefaultTransportQueueSnapshot(),
      relationshipRuntime: createDefaultRelationshipRuntimeSnapshot(),
      messagingTransportRuntime: createDefaultMessagingTransportRuntimeSnapshot(),
      traces: [{
        phase: "booting",
        enteredAtUnixMs: now(),
        outcome: "entered",
      }],
    };
    emit();
  },
};
