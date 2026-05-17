import { describe, expect, it, beforeEach } from "vitest";
import { windowRuntimeSupervisor, windowRuntimeSupervisorInternals } from "./window-runtime-supervisor";

describe("windowRuntimeSupervisor", () => {
  beforeEach(() => {
    windowRuntimeSupervisorInternals.resetForTests();
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
      identityStatus: "locked",
      storedPublicKeyHex: "abc",
    });

    const snapshot = windowRuntimeSupervisor.getSnapshot();
    expect(snapshot.phase).toBe("auth_required");
    expect(snapshot.session.profileId).toBe("profile-a");
    expect(snapshot.session.identityStatus).toBe("locked");
  });

  it("moves to activating and then ready after unlock and activation report", () => {
    windowRuntimeSupervisor.syncIdentity({
      identityStatus: "unlocked",
      storedPublicKeyHex: "abc",
      unlockedPublicKeyHex: "abc",
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
      identityStatus: "locked",
      storedPublicKeyHex: "abc",
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
      identityStatus: "locked",
      storedPublicKeyHex: "abc",
    });

    const snapshot = windowRuntimeSupervisor.getSnapshot();
    expect(snapshot.phase).toBe("auth_required");
    expect(snapshot.session.profileId).toBe("profile-b");
    expect(snapshot.session.identityStatus).toBe("locked");
  });

  it("re-converges to activating_runtime after late profile bind when identity is already unlocked", () => {
    windowRuntimeSupervisor.syncIdentity({
      identityStatus: "unlocked",
      storedPublicKeyHex: "abc",
      unlockedPublicKeyHex: "abc",
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
      identityStatus: "unlocked",
      storedPublicKeyHex: "abc",
      unlockedPublicKeyHex: "abc",
    });

    const snapshot = windowRuntimeSupervisor.getSnapshot();
    expect(snapshot.phase).toBe("activating_runtime");
    expect(snapshot.session.profileId).toBe("profile-c");
    expect(snapshot.session.identityStatus).toBe("unlocked");
  });
});
