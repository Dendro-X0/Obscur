import { describe, expect, it } from "vitest";
import {
  buildDesktopProfileMenuEntries,
  deriveDesktopProfileSessionMismatch,
} from "./desktop-profile-switcher-view";
import type { ProfileIsolationSnapshot } from "./profile-isolation-contracts";

const snapshot: ProfileIsolationSnapshot = {
  currentWindow: {
    windowLabel: "profile-alpha-window",
    profileId: "alpha",
    profileLabel: "Alpha",
    launchMode: "existing",
  },
  profiles: [
    { profileId: "alpha", label: "Alpha", createdAtUnixMs: 1, lastUsedAtUnixMs: 1_000 },
    { profileId: "beta", label: "Beta", createdAtUnixMs: 1, lastUsedAtUnixMs: 2_000 },
  ],
  windowBindings: [
    {
      windowLabel: "main",
      profileId: "default",
      profileLabel: "Default",
      launchMode: "existing",
    },
  ],
};

const crossWindowSnapshot: ProfileIsolationSnapshot = {
  currentWindow: {
    windowLabel: "profile-profile-2-1700000000000",
    profileId: "profile-2",
    profileLabel: "Tester2",
    launchMode: "new_window",
  },
  profiles: [
    { profileId: "default", label: "Default", createdAtUnixMs: 1, lastUsedAtUnixMs: 1_000 },
    { profileId: "profile-2", label: "Tester2", createdAtUnixMs: 1, lastUsedAtUnixMs: 2_000 },
  ],
  windowBindings: [
    {
      windowLabel: "main",
      profileId: "default",
      profileLabel: "Default",
      launchMode: "existing",
    },
    {
      windowLabel: "profile-profile-2-1700000000000",
      profileId: "profile-2",
      profileLabel: "Tester2",
      launchMode: "new_window",
    },
  ],
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
      hasSavedAccountPresence: true,
      isCurrentWindow: true,
      canSwitchHere: false,
      subtitle: "aaaaaaaa...aaaaaaaa",
    });
    expect(entries[1]).toMatchObject({
      profileId: "beta",
      label: "Beta",
      hasStoredIdentity: false,
      hasSavedAccountPresence: false,
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

  it("marks profiles open in another window without local identity", () => {
    const entries = buildDesktopProfileMenuEntries({
      snapshot: crossWindowSnapshot,
      previewByProfileId: {
        "profile-2": { profileId: "profile-2", username: "Tester2", avatarUrl: "", publicKeyHex: "b".repeat(64) },
      },
      currentProfileUsername: "Tester2",
      currentProfileAvatarUrl: "",
      currentPublicKeyHex: "b".repeat(64),
      sessionMismatch: false,
    });

    expect(entries[0]).toMatchObject({
      profileId: "default",
      hasStoredIdentity: false,
      isCurrentWindow: false,
      isOpenInAnotherWindow: true,
      shouldFocusExistingWindow: true,
      focusTargetProfileId: "default",
    });
    expect(entries[1]).toMatchObject({
      profileId: "profile-2",
      isCurrentWindow: true,
      isOpenInAnotherWindow: false,
      shouldFocusExistingWindow: false,
    });
  });

  it("marks accounts with an active session lease in another profile for focus redirect", () => {
    const pubkey = "c".repeat(64);
    const entries = buildDesktopProfileMenuEntries({
      snapshot: crossWindowSnapshot,
      previewByProfileId: {
        default: { profileId: "default", username: "Tester1", avatarUrl: "", publicKeyHex: pubkey },
        "profile-2": { profileId: "profile-2", username: "Tester2", avatarUrl: "", publicKeyHex: pubkey },
      },
      currentProfileUsername: "Tester2",
      currentProfileAvatarUrl: "",
      currentPublicKeyHex: undefined,
      sessionMismatch: false,
      activeLeases: [{
        publicKeyHex: pubkey,
        profileId: "default",
        profileLabel: "Default",
        windowLabel: "main",
        updatedAtUnixMs: Date.now(),
      }],
    });

    expect(entries[1]).toMatchObject({
      profileId: "profile-2",
      shouldFocusExistingWindow: true,
      focusTargetProfileId: "default",
    });
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
