import type { DesktopProfileMenuEntry } from "./desktop-profile-switcher-view";

const GENERIC_PROFILE_LABEL_PATTERN = /^profile \d+$/i;

/** Registry slot labels ("Default", "Profile 2") — not end-user account names. */
export const isGenericProfileSlotLabel = (label: string, profileId: string): boolean => {
  const normalized = label.trim();
  if (!normalized) {
    return true;
  }
  if (profileId === "default" && normalized.toLowerCase() === "default") {
    return true;
  }
  if (GENERIC_PROFILE_LABEL_PATTERN.test(normalized)) {
    return true;
  }
  if (normalized === profileId) {
    return true;
  }
  return false;
};

export type DesktopProfileCardDisplay = Readonly<{
  showAccountIdentity: boolean;
  displayName: string | null;
  avatarName: string;
  avatarUrl: string;
}>;

/**
 * Profile cards show a real account name + avatar together, or neither.
 * Generic slot labels stay hidden until the profile has a stored identity.
 */
export const resolveDesktopProfileCardDisplay = (
  entry: Pick<
    DesktopProfileMenuEntry,
    "label" | "avatarName" | "avatarUrl" | "hasStoredIdentity" | "hasSavedAccountPresence" | "profileId"
  >,
): DesktopProfileCardDisplay => {
  const candidateName = entry.avatarName.trim() || entry.label.trim();
  const hasMeaningfulName = candidateName.length > 0
    && !isGenericProfileSlotLabel(candidateName, entry.profileId);
  const showAccountIdentity = entry.hasSavedAccountPresence
    && (hasMeaningfulName || entry.hasStoredIdentity);

  if (!showAccountIdentity) {
    return {
      showAccountIdentity: false,
      displayName: null,
      avatarName: "",
      avatarUrl: "",
    };
  }

  return {
    showAccountIdentity: true,
    displayName: candidateName,
    avatarName: candidateName,
    avatarUrl: entry.avatarUrl,
  };
};
