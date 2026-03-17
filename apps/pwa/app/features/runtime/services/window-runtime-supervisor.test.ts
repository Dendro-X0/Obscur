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
});
