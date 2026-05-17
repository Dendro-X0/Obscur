import { openIdentityDb } from "@/app/features/auth/utils/open-identity-db";
import { identityStoreName } from "@/app/features/auth/utils/identity-store-name";
import { formatPublicKeyPreview, formatRelativeTime } from "@/app/features/invites/utils/utils";
import type { ProfileId, ProfileIsolationSnapshot } from "./profile-isolation-contracts";
import { getProfileIdentityDbKey, getScopedStorageKey } from "./profile-scope";

const PROFILE_STORAGE_KEY = "dweb.nostr.pwa.profile";
const PUBLIC_KEY_HEX_REGEX = /^[0-9a-f]{64}$/i;

type StoredIdentityRecord = Readonly<{
  publicKeyHex?: string;
}>;

type StoredProfileRecord = Readonly<{
  version: 1;
  profile?: Readonly<{
    username?: string;
    avatarUrl?: string;
  }>;
}>;

export type DesktopProfilePreview = Readonly<{
  profileId: ProfileId;
  username: string;
  avatarUrl: string;
  publicKeyHex?: string;
}>;

export type DesktopProfileMenuEntry = Readonly<{
  profileId: ProfileId;
  label: string;
  avatarUrl: string;
  avatarName: string;
  subtitle: string;
  lastUsedLabel: string;
  hasStoredIdentity: boolean;
  isCurrentWindow: boolean;
  canSwitchHere: boolean;
}>;

type BuildDesktopProfileMenuEntriesParams = Readonly<{
  snapshot: ProfileIsolationSnapshot;
  previewByProfileId: Readonly<Record<string, DesktopProfilePreview | undefined>>;
  currentProfileAvatarUrl?: string;
  currentProfileUsername?: string;
  currentPublicKeyHex?: string;
  sessionMismatch: boolean;
}>;

const normalizeString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const safeFormatPublicKeyPreview = (value: string | undefined): string | null => {
  if (!value || !PUBLIC_KEY_HEX_REGEX.test(value)) {
    return null;
  }
  return formatPublicKeyPreview(value);
};

const readProfilePreviewFromStorage = (profileId: ProfileId): Omit<DesktopProfilePreview, "publicKeyHex" | "profileId"> => {
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

const readIdentityPreview = async (profileId: ProfileId): Promise<string | undefined> => {
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    const db = await openIdentityDb();
    return await new Promise<string | undefined>((resolve, reject) => {
      const tx = db.transaction(identityStoreName, "readonly");
      const store = tx.objectStore(identityStoreName);
      const request = store.get(getProfileIdentityDbKey(profileId));
      request.onsuccess = () => {
        const record = request.result as StoredIdentityRecord | undefined;
        const publicKeyHex = normalizeString(record?.publicKeyHex);
        resolve(publicKeyHex || undefined);
      };
      request.onerror = () => {
        reject(request.error ?? new Error("Failed to read profile identity."));
      };
    });
  } catch {
    return undefined;
  }
};

export const loadDesktopProfilePreviewMap = async (
  profileIds: ReadonlyArray<ProfileId>
): Promise<Readonly<Record<string, DesktopProfilePreview>>> => {
  const entries = await Promise.all(profileIds.map(async (profileId) => {
    const profile = readProfilePreviewFromStorage(profileId);
    const publicKeyHex = await readIdentityPreview(profileId);
    const preview: DesktopProfilePreview = {
      profileId,
      username: profile.username,
      avatarUrl: profile.avatarUrl,
      publicKeyHex,
    };
    return [profileId, preview] as const;
  }));
  return Object.fromEntries(entries);
};

export const deriveDesktopProfileSessionMismatch = (params: Readonly<{
  storedPublicKeyHex?: string;
  unlockedPublicKeyHex?: string;
}>): boolean => {
  const stored = normalizeString(params.storedPublicKeyHex);
  const unlocked = normalizeString(params.unlockedPublicKeyHex);
  return stored.length > 0 && unlocked.length > 0 && stored !== unlocked;
};

export const buildDesktopProfileMenuEntries = (
  params: BuildDesktopProfileMenuEntriesParams
): ReadonlyArray<DesktopProfileMenuEntry> => {
  return params.snapshot.profiles.map((profile) => {
    const preview = params.previewByProfileId[profile.profileId];
    const isCurrentWindow = profile.profileId === params.snapshot.currentWindow.profileId;
    const username = isCurrentWindow
      ? normalizeString(params.currentProfileUsername) || normalizeString(preview?.username)
      : normalizeString(preview?.username);
    const avatarUrl = isCurrentWindow
      ? normalizeString(params.currentProfileAvatarUrl) || normalizeString(preview?.avatarUrl)
      : normalizeString(preview?.avatarUrl);
    const publicKeyHex = isCurrentWindow
      ? normalizeString(params.currentPublicKeyHex) || normalizeString(preview?.publicKeyHex)
      : normalizeString(preview?.publicKeyHex);
    return {
      profileId: profile.profileId,
      label: username || profile.label,
      avatarUrl,
      avatarName: username || profile.label,
      subtitle: safeFormatPublicKeyPreview(publicKeyHex) || profile.profileId,
      lastUsedLabel: profile.lastUsedAtUnixMs > 0 ? formatRelativeTime(new Date(profile.lastUsedAtUnixMs)) : "never used",
      hasStoredIdentity: publicKeyHex.length > 0,
      isCurrentWindow,
      canSwitchHere: !isCurrentWindow && !params.sessionMismatch,
    };
  });
};
