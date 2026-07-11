import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DELETE_PROFILE_WINDOW_CONFIRM_TEXT,
  deleteCurrentProfileWindowCompletely,
} from "./delete-current-profile-window";

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: vi.fn(() => false),
}));

vi.mock("./cross-profile-active-session-lease", () => ({
  releaseActiveSessionLeaseAsync: vi.fn(async () => undefined),
}));

vi.mock("./desktop-profile-runtime", () => ({
  desktopProfileRuntime: {
    removeProfile: vi.fn(async () => ({ profiles: [], currentWindow: { profileId: "default" } })),
  },
  broadcastProfileIsolationChanged: vi.fn(async () => undefined),
}));

vi.mock("./pending-profile-import-service", () => ({
  clearPendingProfileImport: vi.fn(),
}));

vi.mock("./profile-workspace-archive-service", () => ({
  archiveProfileWorkspaceBeforeWipe: vi.fn(async () => ({
    fileName: "archive.zip",
    absolutePath: "/tmp/archive.zip",
    downloadTriggered: false,
  })),
}));

vi.mock("./purge-profile-window-identity", () => ({
  purgeProfileWindowIdentityCompletely: vi.fn(async () => []),
}));

vi.mock("./wipe-profile-workspace", () => ({
  wipeProfileWorkspaceCompletely: vi.fn(async () => ({
    profileId: "profile-2",
    publicKeyHex: null,
    localReset: { tier: "complete" },
  })),
}));

import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { releaseActiveSessionLeaseAsync } from "./cross-profile-active-session-lease";
import { broadcastProfileIsolationChanged, desktopProfileRuntime } from "./desktop-profile-runtime";
import { purgeProfileWindowIdentityCompletely } from "./purge-profile-window-identity";
import { wipeProfileWorkspaceCompletely } from "./wipe-profile-workspace";

describe("deleteCurrentProfileWindowCompletely", () => {
  const syncInMemoryIdentity = vi.fn(async () => undefined);
  const publicKeyHex = "a".repeat(64) as import("@dweb/crypto/public-key-hex").PublicKeyHex;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasNativeRuntime).mockReturnValue(false);
  });

  it("exports confirm phrase constant", () => {
    expect(DELETE_PROFILE_WINDOW_CONFIRM_TEXT).toBe("DELETE PROFILE WINDOW");
  });

  it("purges identity, releases lease, and wipes workspace", async () => {
    await deleteCurrentProfileWindowCompletely({
      profileId: "default",
      profileLabel: "Default",
      publicKeyHex,
      syncInMemoryIdentity,
    });

    expect(purgeProfileWindowIdentityCompletely).toHaveBeenCalledWith({
      profileId: "default",
      publicKeyHex,
    });
    expect(syncInMemoryIdentity).toHaveBeenCalled();
    expect(releaseActiveSessionLeaseAsync).toHaveBeenCalledWith({
      publicKeyHex,
      profileId: "default",
    });
    expect(wipeProfileWorkspaceCompletely).toHaveBeenCalledWith({
      profileId: "default",
      publicKeyHex,
    });
    expect(desktopProfileRuntime.removeProfile).not.toHaveBeenCalled();
    expect(broadcastProfileIsolationChanged).toHaveBeenCalled();
  });

  it("removes non-default desktop profile windows from the registry", async () => {
    vi.mocked(hasNativeRuntime).mockReturnValue(true);

    await deleteCurrentProfileWindowCompletely({
      profileId: "profile-secondary",
      profileLabel: "Secondary",
      publicKeyHex,
      syncInMemoryIdentity,
    });

    expect(desktopProfileRuntime.removeProfile).toHaveBeenCalledWith("profile-secondary");
    expect(broadcastProfileIsolationChanged).toHaveBeenCalled();
  });
});
