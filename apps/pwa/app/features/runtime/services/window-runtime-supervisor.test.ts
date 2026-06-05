import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMismatchStartupAuthState,
  createPendingStartupAuthState,
  createRestoredStartupAuthState,
  createStoredLockedStartupAuthState,
} from "@/app/features/auth/services/startup-auth-state-contracts";

const runtimeSupervisorLogMocks = vi.hoisted(() => ({
  logAppEvent: vi.fn(),
}));

const identityMocks = vi.hoisted(() => ({
  getIdentitySnapshot: vi.fn(() => ({ status: "loading" as const })),
  getIdentityDiagnosticsSnapshot: vi.fn(() => ({
    status: "loading" as const,
    startupState: createPendingStartupAuthState(),
  })),
}));

vi.mock("@/app/features/auth/hooks/use-identity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/features/auth/hooks/use-identity")>();
  return {
    ...actual,
    getIdentitySnapshot: identityMocks.getIdentitySnapshot,
    getIdentityDiagnosticsSnapshot: identityMocks.getIdentityDiagnosticsSnapshot,
  };
});

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: runtimeSupervisorLogMocks.logAppEvent,
}));

import { createDefaultRelayRuntimeSnapshot } from "@/app/features/relays/services/relay-runtime-contracts";
import { windowRuntimeSupervisor, windowRuntimeSupervisorInternals } from "./window-runtime-supervisor";

describe("windowRuntimeSupervisor", () => {
  beforeEach(() => {
    windowRuntimeSupervisorInternals.resetForTests();
    vi.clearAllMocks();
    identityMocks.getIdentitySnapshot.mockReturnValue({ status: "loading" } as never);
    identityMocks.getIdentityDiagnosticsSnapshot.mockReturnValue({
      status: "loading",
      startupState: createPendingStartupAuthState(),
    } as never);
  });

  it("moves from boot to auth_required after profile bind and locked identity", () => {
    windowRuntimeSupervisor.bindProfile({
      currentWindow: {
        windowLabel: "profile-a",
        profileId: "profile-a",
        profileLabel: "Profile A",
        launchMode: "existing",
      },
      profiles: [],
      windowBindings: [],
    });

    windowRuntimeSupervisor.syncIdentity({
      startupState: createStoredLockedStartupAuthState({
        storedPublicKeyHex: "abc",
      }),
    });

    const snapshot = windowRuntimeSupervisor.getSnapshot();
    expect(snapshot.phase).toBe("auth_required");
    expect(snapshot.session.profileId).toBe("profile-a");
    expect(snapshot.session.identityStatus).toBe("locked");
    expect(snapshot.session.startupState.kind).toBe("stored_locked");
  });

  it("moves to activating and then ready after unlock and activation report", () => {
    windowRuntimeSupervisor.syncIdentity({
      startupState: createRestoredStartupAuthState({
        storedPublicKeyHex: "abc",
        unlockedPublicKeyHex: "abc",
      }),
    });

    expect(windowRuntimeSupervisor.getSnapshot().phase).toBe("activating_runtime");

    windowRuntimeSupervisor.markRuntimeReady({
      completedAtUnixMs: Date.now(),
      message: "ready",
    });

    const snapshot = windowRuntimeSupervisor.getSnapshot();
    expect(snapshot.phase).toBe("ready");
    expect(snapshot.lastActivationReport?.message).toBe("ready");
  });

  it("does not re-emit when markRuntimeReady repeats the same activation report", () => {
    windowRuntimeSupervisor.syncIdentity({
      startupState: createRestoredStartupAuthState({
        storedPublicKeyHex: "abc",
        unlockedPublicKeyHex: "abc",
      }),
    });

    const report = {
      completedAtUnixMs: 1_700_000_000_000,
      relayOpenCount: 1,
      relayTotalCount: 1,
      accountSyncPhase: "ready",
      accountSyncStatus: "ready",
      accountProjectionReady: true,
      accountProjectionPhase: "ready",
      accountProjectionStatus: "ready",
      projectionPhase: "ready",
      projectionStatus: "ready",
      migrationPhase: "legacy",
      driftStatus: "unknown",
      message: "Runtime activated",
    } as const;

    let listenerCalls = 0;
    const unsubscribe = windowRuntimeSupervisor.subscribe(() => {
      listenerCalls += 1;
    });

    windowRuntimeSupervisor.markRuntimeReady(report);
    const callsAfterFirstReady = listenerCalls;

    windowRuntimeSupervisor.markRuntimeReady({ ...report, completedAtUnixMs: report.completedAtUnixMs + 1 });

    expect(windowRuntimeSupervisor.getSnapshot().phase).toBe("ready");
    expect(listenerCalls).toBe(callsAfterFirstReady);
    unsubscribe();
  });

  it("re-converges to auth_required after late profile bind when identity is already locked", () => {
    windowRuntimeSupervisor.syncIdentity({
      startupState: createStoredLockedStartupAuthState({
        storedPublicKeyHex: "abc",
      }),
    });
    expect(windowRuntimeSupervisor.getSnapshot().phase).toBe("auth_required");

    windowRuntimeSupervisor.bindProfile({
      currentWindow: {
        windowLabel: "main",
        profileId: "profile-b",
        profileLabel: "Profile B",
        launchMode: "existing",
      },
      profiles: [],
      windowBindings: [],
    });
    expect(windowRuntimeSupervisor.getSnapshot().phase).toBe("auth_required");

    windowRuntimeSupervisor.syncIdentity({
      startupState: createStoredLockedStartupAuthState({
        storedPublicKeyHex: "abc",
      }),
    });

    const snapshot = windowRuntimeSupervisor.getSnapshot();
    expect(snapshot.phase).toBe("auth_required");
    expect(snapshot.session.profileId).toBe("profile-b");
    expect(snapshot.session.identityStatus).toBe("locked");
  });

  it("promotes to auth_required when binding is unchanged but identity is locked with stored credentials", () => {
    identityMocks.getIdentitySnapshot.mockReturnValue({
      status: "locked",
      stored: {
        encryptedPrivateKey: "cipher",
        publicKeyHex: "abc",
      },
    } as never);
    identityMocks.getIdentityDiagnosticsSnapshot.mockReturnValue({
      status: "locked",
      startupState: createPendingStartupAuthState(),
    } as never);

    windowRuntimeSupervisor.bindProfile({
      currentWindow: {
        windowLabel: "main",
        profileId: "default",
        profileLabel: "Default",
        launchMode: "existing",
      },
      profiles: [],
      windowBindings: [],
    });

    const snapshot = windowRuntimeSupervisor.getSnapshot();
    expect(snapshot.phase).toBe("auth_required");
    expect(snapshot.session.startupState.kind).toBe("stored_locked");
    expect(snapshot.session.storedPublicKeyHex).toBe("abc");
  });

  it("promotes to activating_runtime when binding is unchanged but identity unlocks after bootstrap", () => {
    windowRuntimeSupervisor.bindProfile({
      currentWindow: {
        windowLabel: "main",
        profileId: "default",
        profileLabel: "Default",
        launchMode: "existing",
      },
      profiles: [],
      windowBindings: [],
    });
    windowRuntimeSupervisor.syncIdentity({
      startupState: createStoredLockedStartupAuthState({
        storedPublicKeyHex: "abc",
      }),
    });
    expect(windowRuntimeSupervisor.getSnapshot().phase).toBe("auth_required");

    identityMocks.getIdentitySnapshot.mockReturnValue({
      status: "unlocked",
      publicKeyHex: "abc",
      privateKeyHex: "def",
      stored: {
        encryptedPrivateKey: "cipher",
        publicKeyHex: "abc",
      },
    } as never);
    identityMocks.getIdentityDiagnosticsSnapshot.mockReturnValue({
      status: "unlocked",
      startupState: createRestoredStartupAuthState({
        storedPublicKeyHex: "abc",
        unlockedPublicKeyHex: "abc",
      }),
    } as never);

    windowRuntimeSupervisor.bindProfile({
      currentWindow: {
        windowLabel: "main",
        profileId: "default",
        profileLabel: "Default",
        launchMode: "existing",
      },
      profiles: [],
      windowBindings: [],
    });

    const snapshot = windowRuntimeSupervisor.getSnapshot();
    expect(snapshot.phase).toBe("activating_runtime");
    expect(snapshot.session.identityStatus).toBe("unlocked");
  });

  it("re-converges to activating_runtime after late profile bind when identity is already unlocked", () => {
    identityMocks.getIdentitySnapshot.mockReturnValue({
      status: "unlocked",
      publicKeyHex: "abc",
      privateKeyHex: "def",
      stored: {
        encryptedPrivateKey: "cipher",
        publicKeyHex: "abc",
      },
    } as never);
    identityMocks.getIdentityDiagnosticsSnapshot.mockReturnValue({
      status: "unlocked",
      startupState: createRestoredStartupAuthState({
        storedPublicKeyHex: "abc",
        unlockedPublicKeyHex: "abc",
      }),
    } as never);

    windowRuntimeSupervisor.syncIdentity({
      startupState: createRestoredStartupAuthState({
        storedPublicKeyHex: "abc",
        unlockedPublicKeyHex: "abc",
      }),
    });
    windowRuntimeSupervisor.markRuntimeReady({
      completedAtUnixMs: Date.now(),
      message: "ready",
    });
    expect(windowRuntimeSupervisor.getSnapshot().phase).toBe("ready");

    windowRuntimeSupervisor.bindProfile({
      currentWindow: {
        windowLabel: "main",
        profileId: "profile-c",
        profileLabel: "Profile C",
        launchMode: "existing",
      },
      profiles: [],
      windowBindings: [],
    });
    expect(windowRuntimeSupervisor.getSnapshot().phase).toBe("activating_runtime");

    const snapshot = windowRuntimeSupervisor.getSnapshot();
    expect(snapshot.session.profileId).toBe("profile-c");
    expect(snapshot.session.identityStatus).toBe("unlocked");
    expect(snapshot.session.startupState.kind).toBe("restored");
  });

  it("does not re-enter activating_runtime when ready binding is unchanged", () => {
    identityMocks.getIdentitySnapshot.mockReturnValue({
      status: "unlocked",
      publicKeyHex: "abc",
      privateKeyHex: "def",
      stored: {
        encryptedPrivateKey: "cipher",
        publicKeyHex: "abc",
      },
    } as never);
    identityMocks.getIdentityDiagnosticsSnapshot.mockReturnValue({
      status: "unlocked",
      startupState: createRestoredStartupAuthState({
        storedPublicKeyHex: "abc",
        unlockedPublicKeyHex: "abc",
      }),
    } as never);

    const desktopBinding = {
      currentWindow: {
        windowLabel: "main",
        profileId: "default",
        profileLabel: "Default",
        launchMode: "existing" as const,
      },
      profiles: [],
      windowBindings: [],
    };

    windowRuntimeSupervisor.bindProfile(desktopBinding);
    windowRuntimeSupervisor.markRuntimeReady({
      completedAtUnixMs: Date.now(),
      message: "ready",
    });
    expect(windowRuntimeSupervisor.getSnapshot().phase).toBe("ready");

    windowRuntimeSupervisor.bindProfile(desktopBinding);
    expect(windowRuntimeSupervisor.getSnapshot().phase).toBe("ready");
  });

  it("does not regress activating runtime to binding_profile while identity snapshot is still loading", () => {
    windowRuntimeSupervisor.syncIdentity({
      startupState: createRestoredStartupAuthState({
        storedPublicKeyHex: "abc",
        unlockedPublicKeyHex: "abc",
      }),
    } as never);

    windowRuntimeSupervisor.bindProfile({
      currentWindow: {
        windowLabel: "main",
        profileId: "profile-z",
        profileLabel: "Profile Z",
        launchMode: "existing",
      },
      profiles: [],
      windowBindings: [],
    });

    const snapshot = windowRuntimeSupervisor.getSnapshot();
    expect(snapshot.phase).toBe("activating_runtime");
    expect(snapshot.session.profileId).toBe("profile-z");
  });

  it("surfaces native session mismatch through the runtime startup state", () => {
    windowRuntimeSupervisor.syncIdentity({
      startupState: createMismatchStartupAuthState({
        storedPublicKeyHex: "abc",
        nativeSessionPublicKeyHex: "def",
        mismatchReason: "native_mismatch",
        message: "Native secure storage belonged to another account.",
      }),
    });

    const snapshot = windowRuntimeSupervisor.getSnapshot();
    expect(snapshot.phase).toBe("auth_required");
    expect(snapshot.degradedReason).toBe("native_session_mismatch");
    expect(snapshot.lastError).toBe("Native secure storage belonged to another account.");
    expect(snapshot.session.startupState.kind).toBe("mismatch");
  });

  it("does not reset to binding_profile when locked identity profile label metadata updates", () => {
    identityMocks.getIdentitySnapshot.mockReturnValue({
      status: "locked",
      stored: {
        encryptedPrivateKey: "cipher",
        publicKeyHex: "abc",
      },
    } as never);
    identityMocks.getIdentityDiagnosticsSnapshot.mockReturnValue({
      status: "locked",
      startupState: createStoredLockedStartupAuthState({
        storedPublicKeyHex: "abc",
      }),
    } as never);

    windowRuntimeSupervisor.bindProfile({
      currentWindow: {
        windowLabel: "main",
        profileId: "default",
        profileLabel: "Default",
        launchMode: "existing",
      },
      profiles: [],
      windowBindings: [],
    });
    expect(windowRuntimeSupervisor.getSnapshot().phase).toBe("auth_required");

    windowRuntimeSupervisor.bindProfile({
      currentWindow: {
        windowLabel: "main",
        profileId: "default",
        profileLabel: "Renamed Profile",
        launchMode: "existing",
      },
      profiles: [],
      windowBindings: [],
    });

    const snapshot = windowRuntimeSupervisor.getSnapshot();
    expect(snapshot.phase).toBe("auth_required");
    expect(snapshot.session.profileLabel).toBe("Renamed Profile");
    expect(snapshot.session.startupState.kind).toBe("stored_locked");
  });

  it("promotes auth_required while identity is still loading but stored credentials are known", () => {
    identityMocks.getIdentityDiagnosticsSnapshot.mockReturnValue({
      status: "loading",
      storedPublicKeyHex: "abc",
      startupState: createPendingStartupAuthState({
        storedPublicKeyHex: "abc",
      }),
    } as never);

    windowRuntimeSupervisor.bindProfile({
      currentWindow: {
        windowLabel: "main",
        profileId: "default",
        profileLabel: "Default",
        launchMode: "existing",
      },
      profiles: [],
      windowBindings: [],
    });

    const snapshot = windowRuntimeSupervisor.getSnapshot();
    expect(snapshot.phase).toBe("auth_required");
    expect(snapshot.session.startupState.kind).toBe("stored_locked");
  });

  it("syncRelayRuntime ignores timestamp-only relay snapshot churn", () => {
    windowRuntimeSupervisor.bindProfile({
      currentWindow: {
        windowLabel: "main",
        profileId: "default",
        profileLabel: "Default",
        launchMode: "existing",
      },
      profiles: [],
      windowBindings: [],
    });

    const base = createDefaultRelayRuntimeSnapshot({ instanceId: "relay-1" });
    const healthyRelayRuntime = {
      ...base,
      phase: "healthy" as const,
      recovery: {
        ...base.recovery,
        readiness: "healthy" as const,
      },
      writableRelayCount: 1,
      subscribableRelayCount: 1,
      updatedAtUnixMs: 1_000,
    };

    let listenerCalls = 0;
    const unsubscribe = windowRuntimeSupervisor.subscribe(() => {
      listenerCalls += 1;
    });

    windowRuntimeSupervisor.syncRelayRuntime(healthyRelayRuntime);
    const callsAfterFirstSync = listenerCalls;

    windowRuntimeSupervisor.syncRelayRuntime({
      ...healthyRelayRuntime,
      updatedAtUnixMs: 9_999,
      pendingOutboundCount: 42,
      pendingSubscriptionBatchCount: 7,
    });

    expect(listenerCalls).toBe(callsAfterFirstSync);
    unsubscribe();
  });

  it("emits startup auth state transition diagnostics when the startup owner changes", () => {
    windowRuntimeSupervisor.syncIdentity({
      startupState: createStoredLockedStartupAuthState({
        storedPublicKeyHex: "abc",
      }),
    });

    expect(runtimeSupervisorLogMocks.logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
      name: "runtime.startup_auth_state_transition",
      level: "info",
      context: expect.objectContaining({
        fromKind: "pending",
        toKind: "stored_locked",
        profileId: "default",
        hasStoredIdentity: true,
      }),
    }));
  });
});
