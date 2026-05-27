"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Passphrase } from "@dweb/crypto/passphrase";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { useIdentity, getIdentitySnapshot, getIdentityDiagnosticsSnapshot } from "@/app/features/auth/hooks/use-identity";
import {
  createPendingStartupAuthState,
  createStoredLockedStartupAuthState,
  type StartupAuthState,
} from "@/app/features/auth/services/startup-auth-state-contracts";
import { desktopProfileRuntime } from "@/app/features/profiles/services/desktop-profile-runtime";
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
import { logAppEvent } from "@/app/shared/log-app-event";

type Listener = () => void;

const listeners = new Set<Listener>();

const now = (): number => Date.now();

const defaultSession: ProfileBoundSessionSnapshot = {
  windowLabel: "main",
  profileId: "default",
  profileLabel: "Default",
  identityStatus: "loading",
  startupState: createPendingStartupAuthState(),
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

const emitStartupAuthStateTransition = (params: Readonly<{
  previous: StartupAuthState;
  next: StartupAuthState;
  profileId: string;
  windowLabel: string;
}>): void => {
  if (
    params.previous.kind === params.next.kind
    && params.previous.identityStatus === params.next.identityStatus
    && params.previous.mismatchReason === params.next.mismatchReason
    && params.previous.message === params.next.message
    && params.previous.storedPublicKeyHex === params.next.storedPublicKeyHex
    && params.previous.unlockedPublicKeyHex === params.next.unlockedPublicKeyHex
    && params.previous.nativeSessionPublicKeyHex === params.next.nativeSessionPublicKeyHex
  ) {
    return;
  }
  const level = params.next.kind === "mismatch" || params.next.kind === "fatal_storage_error"
    ? "warn"
    : "info";
  logAppEvent({
    name: "runtime.startup_auth_state_transition",
    level,
    scope: { feature: "runtime", action: "startup_auth_state" },
    context: {
      profileId: params.profileId,
      windowLabel: params.windowLabel,
      fromKind: params.previous.kind,
      toKind: params.next.kind,
      identityStatus: params.next.identityStatus,
      runtimePhaseHint: params.next.runtimePhaseHint,
      degradedReasonHint: params.next.degradedReasonHint,
      mismatchReason: params.next.mismatchReason ?? null,
      hasStoredIdentity: Boolean(params.next.storedPublicKeyHex),
    },
  });
};

const transitionTo = (
  phase: WindowRuntimePhase,
  patch: Partial<WindowRuntimeSnapshot> = {},
  reason?: string,
): void => {
  const hasMaterialSessionPatch = Boolean(patch.session) && (
    patch.session!.profileId !== snapshot.session.profileId
    || patch.session!.profileLabel !== snapshot.session.profileLabel
    || patch.session!.windowLabel !== snapshot.session.windowLabel
    || patch.session!.identityStatus !== snapshot.session.identityStatus
    || patch.session!.startupState.kind !== snapshot.session.startupState.kind
    || patch.session!.storedPublicKeyHex !== snapshot.session.storedPublicKeyHex
    || patch.session!.unlockedPublicKeyHex !== snapshot.session.unlockedPublicKeyHex
  );
  if (snapshot.phase === phase && !patch.lastError && !patch.lastActivationReport && !hasMaterialSessionPatch) {
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
  const nextWindowLabel = desktopSnapshot.currentWindow.windowLabel;
  const nextProfileId = desktopSnapshot.currentWindow.profileId;
  const nextProfileLabel = desktopSnapshot.currentWindow.profileLabel;

  const identity = getIdentitySnapshot();
  if (identity.status === "unlocked" && identity.publicKeyHex) {
    const diagnostics = getIdentityDiagnosticsSnapshot();
    const nextSession: ProfileBoundSessionSnapshot = {
      windowLabel: nextWindowLabel,
      profileId: nextProfileId,
      profileLabel: nextProfileLabel,
      identityStatus: "unlocked",
      startupState: diagnostics.startupState,
      storedPublicKeyHex: identity.stored?.publicKeyHex ?? diagnostics.storedPublicKeyHex,
      unlockedPublicKeyHex: identity.publicKeyHex,
    };
    const bindingUnchanged = (
      snapshot.session.windowLabel === nextWindowLabel
      && snapshot.session.profileId === nextProfileId
      && snapshot.session.profileLabel === nextProfileLabel
      && snapshot.session.unlockedPublicKeyHex === identity.publicKeyHex
      && snapshot.session.identityStatus === "unlocked"
    );
    if (
      bindingUnchanged
      && (
        snapshot.phase === "ready"
        || snapshot.phase === "degraded"
        || snapshot.phase === "activating_runtime"
      )
    ) {
      return;
    }
    emitStartupAuthStateTransition({
      previous: snapshot.session.startupState,
      next: nextSession.startupState,
      profileId: nextSession.profileId,
      windowLabel: nextSession.windowLabel,
    });
    transitionTo("activating_runtime", {
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

  if (identity.status === "locked" && identity.stored?.publicKeyHex) {
    const diagnostics = getIdentityDiagnosticsSnapshot();
    const nextStartupState: StartupAuthState = (
      diagnostics.startupState.kind === "stored_locked"
      || diagnostics.startupState.kind === "mismatch"
      || diagnostics.startupState.kind === "native_restorable"
    )
      ? diagnostics.startupState
      : createStoredLockedStartupAuthState({
        storedPublicKeyHex: identity.stored.publicKeyHex,
      });
    const nextSession: ProfileBoundSessionSnapshot = {
      windowLabel: nextWindowLabel,
      profileId: nextProfileId,
      profileLabel: nextProfileLabel,
      identityStatus: "locked",
      startupState: nextStartupState,
      storedPublicKeyHex: identity.stored.publicKeyHex,
      unlockedPublicKeyHex: undefined,
    };
    emitStartupAuthStateTransition({
      previous: snapshot.session.startupState,
      next: nextStartupState,
      profileId: nextProfileId,
      windowLabel: nextWindowLabel,
    });
    if (
      snapshot.phase !== "auth_required"
      || snapshot.session.profileId !== nextProfileId
      || snapshot.session.windowLabel !== nextWindowLabel
      || snapshot.session.profileLabel !== nextProfileLabel
      || snapshot.session.startupState.kind !== nextStartupState.kind
      || snapshot.session.storedPublicKeyHex !== identity.stored.publicKeyHex
    ) {
      transitionTo("auth_required", {
        degradedReason: "none",
        lastError: nextStartupState.message,
        session: nextSession,
        relayRuntime: createDefaultRelayRuntimeSnapshot({
          windowLabel: nextSession.windowLabel,
          profileId: nextSession.profileId,
        }),
      });
    }
    return;
  }

  if (identity.status === "loading") {
    const diagnostics = getIdentityDiagnosticsSnapshot();
    const storedPublicKeyHex = identity.stored?.publicKeyHex ?? diagnostics.storedPublicKeyHex;
    if (storedPublicKeyHex) {
      const nextStartupState = createStoredLockedStartupAuthState({
        storedPublicKeyHex,
      });
      const nextSession: ProfileBoundSessionSnapshot = {
        windowLabel: nextWindowLabel,
        profileId: nextProfileId,
        profileLabel: nextProfileLabel,
        identityStatus: "locked",
        startupState: nextStartupState,
        storedPublicKeyHex,
        unlockedPublicKeyHex: undefined,
      };
      if (
        snapshot.phase !== "auth_required"
        || snapshot.session.profileId !== nextProfileId
        || snapshot.session.windowLabel !== nextWindowLabel
        || snapshot.session.profileLabel !== nextProfileLabel
        || snapshot.session.storedPublicKeyHex !== storedPublicKeyHex
      ) {
        transitionTo("auth_required", {
          degradedReason: "none",
          lastError: nextStartupState.message,
          session: nextSession,
          relayRuntime: createDefaultRelayRuntimeSnapshot({
            windowLabel: nextSession.windowLabel,
            profileId: nextSession.profileId,
          }),
        });
      }
      return;
    }
  }

  if (
    snapshot.session.windowLabel === nextWindowLabel
    && snapshot.session.profileId === nextProfileId
    && snapshot.session.profileLabel === nextProfileLabel
  ) {
    return;
  }

  const previousStartupState = snapshot.session.startupState;
  const nextSession: ProfileBoundSessionSnapshot = {
    windowLabel: nextWindowLabel,
    profileId: nextProfileId,
    profileLabel: nextProfileLabel,
    identityStatus: "loading",
    startupState: createPendingStartupAuthState(),
    storedPublicKeyHex: undefined,
    unlockedPublicKeyHex: undefined,
  };
  emitStartupAuthStateTransition({
    previous: previousStartupState,
    next: nextSession.startupState,
    profileId: nextSession.profileId,
    windowLabel: nextSession.windowLabel,
  });
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
    startupState: StartupAuthState;
  }>): void {
    const previousStartupState = snapshot.session.startupState;
    const identitySnapshotUnchanged = (
      snapshot.session.identityStatus === params.startupState.identityStatus
      && snapshot.session.storedPublicKeyHex === params.startupState.storedPublicKeyHex
      && snapshot.session.unlockedPublicKeyHex === params.startupState.unlockedPublicKeyHex
      && snapshot.session.startupState.kind === params.startupState.kind
      && snapshot.session.startupState.message === params.startupState.message
      && snapshot.session.startupState.mismatchReason === params.startupState.mismatchReason
      && snapshot.session.startupState.nativeSessionPublicKeyHex === params.startupState.nativeSessionPublicKeyHex
      && snapshot.lastError === params.startupState.message
    );
    const phaseAlreadyAligned = (
      snapshot.phase === params.startupState.runtimePhaseHint
      && snapshot.degradedReason === params.startupState.degradedReasonHint
      && snapshot.lastError === params.startupState.message
    );
    if (identitySnapshotUnchanged && phaseAlreadyAligned) {
      return;
    }
    const nextSession: ProfileBoundSessionSnapshot = {
      ...snapshot.session,
      identityStatus: params.startupState.identityStatus,
      startupState: params.startupState,
      storedPublicKeyHex: params.startupState.storedPublicKeyHex,
      unlockedPublicKeyHex: params.startupState.unlockedPublicKeyHex,
    };
    emitStartupAuthStateTransition({
      previous: previousStartupState,
      next: params.startupState,
      profileId: nextSession.profileId,
      windowLabel: nextSession.windowLabel,
    });
    if (!identitySnapshotUnchanged) {
      setSnapshot({
        ...snapshot,
        session: nextSession,
        lastError: params.startupState.message,
      });
    }
    if (params.startupState.runtimePhaseHint === "fatal") {
      transitionTo("fatal", {
        degradedReason: params.startupState.degradedReasonHint,
        lastError: params.startupState.message ?? "Identity error",
        session: nextSession,
      }, params.startupState.message ?? "Identity error");
      return;
    }
    if (params.startupState.runtimePhaseHint === "binding_profile") {
      transitionTo("binding_profile", {
        degradedReason: params.startupState.degradedReasonHint,
        session: nextSession,
        relayRuntime: createDefaultRelayRuntimeSnapshot({
          windowLabel: nextSession.windowLabel,
          profileId: nextSession.profileId,
          publicKeyHex: nextSession.unlockedPublicKeyHex,
        }),
      });
      return;
    }
    if (params.startupState.runtimePhaseHint === "auth_required") {
      transitionTo("auth_required", {
        degradedReason: params.startupState.degradedReasonHint,
        lastError: params.startupState.message,
        session: nextSession,
        relayRuntime: createDefaultRelayRuntimeSnapshot({
          windowLabel: nextSession.windowLabel,
          profileId: nextSession.profileId,
          publicKeyHex: nextSession.unlockedPublicKeyHex,
        }),
      });
      return;
    }
    if (params.startupState.runtimePhaseHint === "activating_runtime" && !["ready", "degraded"].includes(snapshot.phase)) {
      transitionTo("activating_runtime", {
        degradedReason: params.startupState.degradedReasonHint,
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
  const runtimeSnapshot = useWindowRuntimeSnapshot();

  return useMemo(() => ({
    snapshot: runtimeSnapshot,
    refreshWindowBinding: desktopProfileRuntime.refresh,
    createIdentityForBoundProfile: async (params: Readonly<{ passphrase: Passphrase; username?: string }>): Promise<void> => {
      windowRuntimeSupervisor.beginUnlock("create");
      try {
        await identity.createIdentity(params);
        const diagnostics = identity.getIdentityDiagnostics?.();
        if (diagnostics?.startupState) {
          windowRuntimeSupervisor.syncIdentity({ startupState: diagnostics.startupState });
        }
      } catch (error) {
        windowRuntimeSupervisor.resetToAuthRequired();
        throw error;
      }
    },
    importIdentityForBoundProfile: async (params: Readonly<{ privateKeyHex: PrivateKeyHex; passphrase: Passphrase; username?: string }>): Promise<void> => {
      windowRuntimeSupervisor.beginUnlock("import");
      try {
        await identity.importIdentity(params);
        const diagnostics = identity.getIdentityDiagnostics?.();
        if (diagnostics?.startupState) {
          windowRuntimeSupervisor.syncIdentity({ startupState: diagnostics.startupState });
        }
      } catch (error) {
        windowRuntimeSupervisor.resetToAuthRequired();
        throw error;
      }
    },
    unlockBoundProfile: async (params: Readonly<{ passphrase: Passphrase }>): Promise<void> => {
      windowRuntimeSupervisor.beginUnlock("unlock");
      try {
        await identity.unlockIdentity(params);
        const diagnostics = identity.getIdentityDiagnostics?.();
        if (diagnostics?.startupState) {
          windowRuntimeSupervisor.syncIdentity({ startupState: diagnostics.startupState });
        }
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
