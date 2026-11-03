import { formatIdentityKeyFragment } from "@/app/features/security/services/identity-binding-presenter";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { readIdentityRecordFromLocalStorage } from "@/app/features/auth/utils/identity-persistence";

const PROFILE_STORAGE_KEY = "dweb.nostr.pwa.profile";

const normalize = (value: string | null | undefined): string => (
  typeof value === "string" ? value.trim() : ""
);

/** Profile-draft username for this window (same store the title-bar picker reads). */
export const readProfileStoreUsername = (profileId: string): string => {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    const raw = window.localStorage.getItem(getScopedStorageKey(PROFILE_STORAGE_KEY, profileId));
    if (!raw) {
      return "";
    }
    const parsed = JSON.parse(raw) as { profile?: { username?: string } };
    return normalize(parsed?.profile?.username);
  } catch {
    return "";
  }
};

/**
 * Single locked-window identity label: profile store wins over stale IdentityRecord.username.
 * Pubkey remains the isolation key; this is display-only.
 */
export const resolveUnlockAccountDisplayName = (params: Readonly<{
  profileId: string;
  publicKeyHex?: string | null;
  identityUsername?: string | null;
  profileStoreUsername?: string | null;
  profileLabel?: string | null;
}>): string => {
  const fromProfileStore = normalize(params.profileStoreUsername)
    || readProfileStoreUsername(params.profileId);
  if (fromProfileStore) {
    return fromProfileStore;
  }
  const fromIdentity = normalize(params.identityUsername)
    || normalize(readIdentityRecordFromLocalStorage(params.profileId)?.username);
  if (fromIdentity) {
    return fromIdentity;
  }
  const pubkey = normalize(params.publicKeyHex).toLowerCase();
  if (pubkey.length === 64) {
    return formatIdentityKeyFragment(pubkey);
  }
  const label = normalize(params.profileLabel);
  return label || params.profileId || "Account";
};

/** When profile-store name and identity username disagree, prefer profile-store for repair. */
export const resolveIdentityUsernameRepair = (params: Readonly<{
  profileId: string;
  identityUsername?: string | null;
  profileStoreUsername?: string | null;
}>): string | null => {
  const profileName = normalize(params.profileStoreUsername)
    || readProfileStoreUsername(params.profileId);
  const identityName = normalize(params.identityUsername);
  if (!profileName) {
    return null;
  }
  if (!identityName) {
    return profileName;
  }
  if (profileName.toLowerCase() === identityName.toLowerCase()) {
    return null;
  }
  return profileName;
};
