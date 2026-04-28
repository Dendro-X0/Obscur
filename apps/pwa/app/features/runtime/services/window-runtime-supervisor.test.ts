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

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: runtimeSupervisorLogMocks.logAppEvent,
}));

import { windowRuntimeSupervisor, windowRuntimeSupervisorInternals } from "./window-runtime-supervisor";

describe("windowRuntimeSupervisor", () => {
  beforeEach(() => {
    windowRuntimeSupervisorInternals.resetForTests();
    vi.clearAllMocks();
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
    expect(windowRuntimeSupervisor.getSnapshot().phase).toBe("binding_profile");

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

  it("re-converges to activating_runtime after late profile bind when identity is already unlocked", () => {
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
    expect(windowRuntimeSupervisor.getSnapshot().phase).toBe("binding_profile");

    windowRuntimeSupervisor.syncIdentity({
      startupState: createRestoredStartupAuthState({
        storedPublicKeyHex: "abc",
        unlockedPublicKeyHex: "abc",
      }),
    });

    const snapshot = windowRuntimeSupervisor.getSnapshot();
    expect(snapshot.phase).toBe("activating_runtime");
    expect(snapshot.session.profileId).toBe("profile-c");
    expect(snapshot.session.identityStatus).toBe("unlocked");
    expect(snapshot.session.startupState.kind).toBe("restored");
  });

  it("resets the bound profile to pending startup state before identity re-sync", () => {
    windowRuntimeSupervisor.syncIdentity({
      startupState: createRestoredStartupAuthState({
        storedPublicKeyHex: "abc",
        unlockedPublicKeyHex: "abc",
      }),
    });

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
    expect(snapshot.phase).toBe("binding_profile");
    expect(snapshot.session.identityStatus).toBe("loading");
    expect(snapshot.session.startupState).toEqual(createPendingStartupAuthState());
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
