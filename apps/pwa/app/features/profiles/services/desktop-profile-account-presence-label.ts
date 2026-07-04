import type { DesktopProfileMenuEntry } from "./desktop-profile-switcher-view";

/** Shared badge copy for profile lists — avoids "Needs setup" when another window owns the slot. */
export const resolveDesktopProfileAccountPresenceLabelKey = (
  entry: Pick<DesktopProfileMenuEntry, "isCurrentWindow" | "hasStoredIdentity" | "hasSavedAccountPresence" | "shouldFocusExistingWindow">,
): string => {
  if (entry.isCurrentWindow) {
    return entry.hasSavedAccountPresence
      ? "profiles.picker.presence.signInHere"
      : "profiles.picker.presence.thisWindow";
  }
  if (entry.shouldFocusExistingWindow) {
    return "profiles.picker.presence.switchToActiveWindow";
  }
  if (entry.hasSavedAccountPresence) {
    return "profiles.picker.presence.savedAccount";
  }
  return "profiles.picker.presence.needsSetup";
};
