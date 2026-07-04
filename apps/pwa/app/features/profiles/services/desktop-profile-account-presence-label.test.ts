import { describe, expect, it } from "vitest";
import { resolveDesktopProfileAccountPresenceLabelKey } from "./desktop-profile-account-presence-label";

describe("resolveDesktopProfileAccountPresenceLabelKey", () => {
  it("prefers current-window and cross-window states over needs setup", () => {
    expect(resolveDesktopProfileAccountPresenceLabelKey({
      isCurrentWindow: true,
      hasStoredIdentity: false,
      hasSavedAccountPresence: false,
      shouldFocusExistingWindow: false,
    })).toBe("profiles.picker.presence.thisWindow");

    expect(resolveDesktopProfileAccountPresenceLabelKey({
      isCurrentWindow: true,
      hasStoredIdentity: true,
      hasSavedAccountPresence: true,
      shouldFocusExistingWindow: false,
    })).toBe("profiles.picker.presence.signInHere");

    expect(resolveDesktopProfileAccountPresenceLabelKey({
      isCurrentWindow: false,
      hasStoredIdentity: true,
      hasSavedAccountPresence: true,
      shouldFocusExistingWindow: false,
    })).toBe("profiles.picker.presence.savedAccount");

    expect(resolveDesktopProfileAccountPresenceLabelKey({
      isCurrentWindow: false,
      hasStoredIdentity: false,
      hasSavedAccountPresence: true,
      shouldFocusExistingWindow: false,
    })).toBe("profiles.picker.presence.savedAccount");

    expect(resolveDesktopProfileAccountPresenceLabelKey({
      isCurrentWindow: false,
      hasStoredIdentity: false,
      hasSavedAccountPresence: false,
      shouldFocusExistingWindow: true,
    })).toBe("profiles.picker.presence.switchToActiveWindow");

    expect(resolveDesktopProfileAccountPresenceLabelKey({
      isCurrentWindow: false,
      hasStoredIdentity: false,
      hasSavedAccountPresence: false,
      shouldFocusExistingWindow: false,
    })).toBe("profiles.picker.presence.needsSetup");
  });
});
