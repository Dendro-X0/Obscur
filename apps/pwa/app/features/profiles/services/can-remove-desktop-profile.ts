import type { ProfileId } from "./profile-isolation-contracts";
import type { DesktopProfileMenuEntry } from "./desktop-profile-switcher-view";

export const DEFAULT_DESKTOP_PROFILE_ID: ProfileId = "default";

/** Non-default profiles not bound to this window may be removed from the device. */
export const canRemoveDesktopProfileEntry = (
  entry: Pick<DesktopProfileMenuEntry, "profileId" | "isCurrentWindow">,
): boolean => (
  !entry.isCurrentWindow && entry.profileId !== DEFAULT_DESKTOP_PROFILE_ID
);
