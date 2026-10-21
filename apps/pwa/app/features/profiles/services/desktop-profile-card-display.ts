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
 * Profile cards show a real account name, or a pubkey preview when the account
 * is bound but unnamed. Empty slots stay unlabeled ("Profile slot" in the UI).
 */
export const resolveDesktopProfileCardDisplay = (
  entry: Pick<
    DesktopProfileMenuEntry,
    "label" | "avatarName" | "avatarUrl" | "hasStoredIdentity" | "hasSavedAccountPresence" | "profileId" | "subtitle"
  >,
): DesktopProfileCardDisplay => {
  const candidateName = entry.avatarName.trim() || entry.label.trim();
  const hasMeaningfulName = candidateName.length > 0
    && !isGenericProfileSlotLabel(candidateName, entry.profileId);
  const hasAccount = entry.hasSavedAccountPresence || entry.hasStoredIdentity;
  const subtitle = entry.subtitle.trim();
  const identifiableFallback = subtitle.length > 0
    && subtitle !== entry.profileId
    ? subtitle
    : null;

  if (!hasAccount) {
    return {
      showAccountIdentity: false,
      displayName: null,
      avatarName: "",
      avatarUrl: "",
    };
  }

  const displayName = hasMeaningfulName
    ? candidateName
    : (identifiableFallback || candidateName || entry.profileId);

  return {
    showAccountIdentity: true,
    displayName,
    avatarName: hasMeaningfulName ? candidateName : displayName,
    avatarUrl: entry.avatarUrl,
  };
};
