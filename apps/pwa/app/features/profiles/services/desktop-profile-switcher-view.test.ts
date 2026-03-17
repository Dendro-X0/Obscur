import { describe, expect, it } from "vitest";
import {
  buildDesktopProfileMenuEntries,
  deriveDesktopProfileSessionMismatch,
} from "./desktop-profile-switcher-view";
import type { ProfileIsolationSnapshot } from "./profile-isolation-contracts";

const snapshot: ProfileIsolationSnapshot = {
  currentWindow: {
    windowLabel: "main",
    profileId: "alpha",
    profileLabel: "Alpha",
    launchMode: "existing",
  },
  profiles: [
    { profileId: "alpha", label: "Alpha", createdAtUnixMs: 1, lastUsedAtUnixMs: 1_000 },
    { profileId: "beta", label: "Beta", createdAtUnixMs: 1, lastUsedAtUnixMs: 2_000 },
  ],
  windowBindings: [],
};

describe("desktop-profile-switcher-view", () => {
  it("derives current-window badges and switch safety from the isolation snapshot", () => {
    const entries = buildDesktopProfileMenuEntries({
      snapshot,
      previewByProfileId: {
        alpha: { profileId: "alpha", username: "Alice", avatarUrl: "", publicKeyHex: "a".repeat(64) },
        beta: { profileId: "beta", username: "", avatarUrl: "", publicKeyHex: undefined },
      },
      currentProfileUsername: "Alice",
      currentProfileAvatarUrl: "",
      sessionMismatch: false,
    });

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      profileId: "alpha",
      label: "Alice",
      hasStoredIdentity: true,
      isCurrentWindow: true,
      canSwitchHere: false,
      subtitle: "aaaaaaaa...aaaaaaaa",
    });
    expect(entries[1]).toMatchObject({
      profileId: "beta",
      label: "Beta",
      hasStoredIdentity: false,
      isCurrentWindow: false,
      canSwitchHere: true,
      subtitle: "beta",
    });
  });

  it("blocks switch-here actions when the current session owner mismatches the stored profile owner", () => {
    const entries = buildDesktopProfileMenuEntries({
      snapshot,
      previewByProfileId: {},
      currentProfileUsername: "",
      currentProfileAvatarUrl: "",
      sessionMismatch: true,
    });

    expect(entries[1]?.canSwitchHere).toBe(false);
  });

  it("detects a bound-profile versus unlocked-session mismatch", () => {
    expect(deriveDesktopProfileSessionMismatch({
      storedPublicKeyHex: "a".repeat(64),
      unlockedPublicKeyHex: "b".repeat(64),
    })).toBe(true);
    expect(deriveDesktopProfileSessionMismatch({
      storedPublicKeyHex: "a".repeat(64),
      unlockedPublicKeyHex: "a".repeat(64),
    })).toBe(false);
  });
});
