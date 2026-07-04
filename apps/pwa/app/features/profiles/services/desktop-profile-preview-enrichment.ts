import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { readIdentityRecordFromLocalStorage } from "@/app/features/auth/utils/identity-persistence";
import { listStoredIdentityBindings } from "@/app/features/auth/utils/identity-profile-binding";
import { isGenericProfileSlotLabel } from "./desktop-profile-card-display";
import type { ProfileId } from "./profile-isolation-contracts";
import { getScopedStorageKey } from "./profile-scope";
import { getLastBoundAccountPublicKeyHex } from "./profile-window-account-binding";
import type { DesktopProfilePreview } from "./desktop-profile-switcher-view";

const PROFILE_STORAGE_KEY = "dweb.nostr.pwa.profile";
const PROFILE_SCOPED_PREFIX = `${PROFILE_STORAGE_KEY}::`;
const BOUND_ACCOUNT_PREFIX = "obscur.profile_window.last_bound_account::";

type StoredProfileRecord = Readonly<{
  version: 1;
  profile?: Readonly<{
    username?: string;
    avatarUrl?: string;
  }>;
}>;

type AccountDisplayHint = Readonly<{
  username: string;
  avatarUrl: string;
}>;

const normalizeString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const readProfileDraft = (profileId: ProfileId): Readonly<{ username: string; avatarUrl: string }> => {
  if (typeof window === "undefined") {
    return { username: "", avatarUrl: "" };
  }
  try {
    const raw = window.localStorage.getItem(getScopedStorageKey(PROFILE_STORAGE_KEY, profileId));
    if (!raw) {
      return { username: "", avatarUrl: "" };
    }
    const parsed = JSON.parse(raw) as StoredProfileRecord;
    return {
      username: normalizeString(parsed?.profile?.username),
      avatarUrl: normalizeString(parsed?.profile?.avatarUrl),
    };
  } catch {
    return { username: "", avatarUrl: "" };
  }
};

const collectKnownProfileIds = (): ReadonlyArray<ProfileId> => {
  if (typeof window === "undefined") {
    return [];
  }
  const profileIds = new Set<string>();
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) {
        continue;
      }
      if (key.startsWith(PROFILE_SCOPED_PREFIX)) {
        const profileId = key.slice(PROFILE_SCOPED_PREFIX.length).trim();
        if (profileId.length > 0) {
          profileIds.add(profileId);
        }
      }
      if (key.startsWith(BOUND_ACCOUNT_PREFIX)) {
        const profileId = key.slice(BOUND_ACCOUNT_PREFIX.length).trim();
        if (profileId.length > 0) {
          profileIds.add(profileId);
        }
      }
    }
  } catch {
    // Best-effort scan only.
  }
  return [...profileIds];
};

const mergeAccountDisplayHint = (
  hints: Map<string, AccountDisplayHint>,
  publicKeyHex: string,
  username: string,
  avatarUrl: string,
  profileId: ProfileId,
): void => {
  const normalizedUsername = normalizeString(username);
  if (!normalizedUsername || isGenericProfileSlotLabel(normalizedUsername, profileId)) {
    return;
  }
  const key = publicKeyHex.trim().toLowerCase();
  if (key.length !== 64) {
    return;
  }
  const existing = hints.get(key);
  if (!existing) {
    hints.set(key, { username: normalizedUsername, avatarUrl: normalizeString(avatarUrl) });
    return;
  }
  hints.set(key, {
    username: existing.username || normalizedUsername,
    avatarUrl: existing.avatarUrl || normalizeString(avatarUrl),
  });
};

/** Best-known username + avatar for each account pubkey across all profile slots on this device. */
export const buildAccountDisplayHintsByPublicKey = (): ReadonlyMap<string, AccountDisplayHint> => {
  const hints = new Map<string, AccountDisplayHint>();
  for (const profileId of collectKnownProfileIds()) {
    ingestProfileSlotAccountHints(hints, profileId);
  }
  return hints;
};

/** Async variant also scans IndexedDB identity records (covers sign-out / partial localStorage states). */
export const buildAccountDisplayHints = async (): Promise<ReadonlyMap<string, AccountDisplayHint>> => {
  const hints = new Map(buildAccountDisplayHintsByPublicKey());
  try {
    const bindings = await listStoredIdentityBindings();
    for (const { profileId, record } of bindings) {
      const draft = readProfileDraft(profileId);
      const username = normalizeString(record.username) || draft.username;
      mergeAccountDisplayHint(hints, record.publicKeyHex, username, draft.avatarUrl, profileId);
    }
  } catch {
    // Best-effort only.
  }
  return hints;
};

const ingestProfileSlotAccountHints = (
  hints: Map<string, AccountDisplayHint>,
  profileId: ProfileId,
): void => {
  const draft = readProfileDraft(profileId);
  const bound = getLastBoundAccountPublicKeyHex(profileId);
  const identity = readIdentityRecordFromLocalStorage(profileId);
  const publicKeyHex = bound || identity?.publicKeyHex || null;
  if (!publicKeyHex) {
    return;
  }
  const username = draft.username || normalizeString(identity?.username);
  mergeAccountDisplayHint(hints, publicKeyHex, username, draft.avatarUrl, profileId);
};

export const enrichDesktopProfilePreview = (
  profileId: ProfileId,
  preview: Omit<DesktopProfilePreview, "profileId">,
  hintsByPublicKey: ReadonlyMap<string, AccountDisplayHint>,
  registryLabel?: string,
): DesktopProfilePreview => {
  let username = normalizeString(preview.username);
  let avatarUrl = normalizeString(preview.avatarUrl);
  let publicKeyHex = normalizeString(preview.publicKeyHex);

  const registryUsername = normalizeString(registryLabel);
  if (!username && registryUsername && !isGenericProfileSlotLabel(registryUsername, profileId)) {
    username = registryUsername;
  }

  if (!publicKeyHex) {
    const bound = getLastBoundAccountPublicKeyHex(profileId);
    if (bound) {
      publicKeyHex = bound;
    }
  }

  if (publicKeyHex) {
    const hint = hintsByPublicKey.get(publicKeyHex.toLowerCase());
    if (hint) {
      if (!username || isGenericProfileSlotLabel(username, profileId)) {
        username = hint.username;
      }
      if (!avatarUrl && hint.avatarUrl) {
        avatarUrl = hint.avatarUrl;
      }
    }
  }

  if (!username) {
    const draft = readProfileDraft(profileId);
    username = draft.username;
    if (!avatarUrl) {
      avatarUrl = draft.avatarUrl;
    }
  }

  if (!username || isGenericProfileSlotLabel(username, profileId)) {
    const identity = readIdentityRecordFromLocalStorage(profileId);
    const identityUsername = normalizeString(identity?.username);
    if (identityUsername) {
      username = identityUsername;
    }
  }

  if ((!username || isGenericProfileSlotLabel(username, profileId)) && publicKeyHex) {
    username = `Account ${publicKeyHex.slice(0, 8)}`;
  }

  return {
    profileId,
    username,
    avatarUrl,
    publicKeyHex: publicKeyHex || undefined,
  };
};

export const hasSavedAccountPickerPresence = (params: Readonly<{
  profileId: ProfileId;
  username: string;
  publicKeyHex?: string;
}>): boolean => {
  const username = normalizeString(params.username);
  if (username.length > 0 && !isGenericProfileSlotLabel(username, params.profileId)) {
    return true;
  }
  return normalizeString(params.publicKeyHex).length === 64;
};
