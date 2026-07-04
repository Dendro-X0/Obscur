import { openIdentityDb } from "@/app/features/auth/utils/open-identity-db";
import { identityStoreName } from "@/app/features/auth/utils/identity-store-name";
import { formatPublicKeyPreview, formatRelativeTime } from "@/app/features/invites/utils/utils";
import type { ProfileId, ProfileIsolationSnapshot } from "./profile-isolation-contracts";
import type { ActiveSessionLeaseRecord } from "./cross-profile-active-session-lease";
import {
  buildAccountDisplayHints,
  enrichDesktopProfilePreview,
  hasSavedAccountPickerPresence,
} from "./desktop-profile-preview-enrichment";
import { buildProfilePickerHintsFromHarvest } from "./profile-web-storage-harvest-service";
import {
  parseIdentityRecord,
  readIdentityRecordFromLocalStorage,
} from "@/app/features/auth/utils/identity-persistence";
import { getProfileIdentityDbKey, getScopedStorageKey } from "./profile-scope";
import { getLastBoundAccountPublicKeyHex } from "./profile-window-account-binding";

const PROFILE_STORAGE_KEY = "dweb.nostr.pwa.profile";
const PUBLIC_KEY_HEX_REGEX = /^[0-9a-f]{64}$/i;

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
  /** Username or prior login binding exists — picker shows account name/avatar. */
  hasSavedAccountPresence: boolean;
  isCurrentWindow: boolean;
  canSwitchHere: boolean;
  /** Profile slot is bound to a different desktop window right now. */
  isOpenInAnotherWindow: boolean;
  /** Same account is unlocked in another profile/window — click should focus it. */
  shouldFocusExistingWindow: boolean;
  /** Profile id whose live window should be focused when shouldFocusExistingWindow is true. */
  focusTargetProfileId?: string;
}>;

type BuildDesktopProfileMenuEntriesParams = Readonly<{
  snapshot: ProfileIsolationSnapshot;
  previewByProfileId: Readonly<Record<string, DesktopProfilePreview | undefined>>;
  currentProfileAvatarUrl?: string;
  currentProfileUsername?: string;
  currentPublicKeyHex?: string;
  sessionMismatch: boolean;
  activeLeases?: ReadonlyArray<ActiveSessionLeaseRecord>;
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

type IdentityPreview = Readonly<{
  publicKeyHex?: string;
  username?: string;
}>;

const readIdentityPreviewFromStorage = (profileId: ProfileId): IdentityPreview => {
  const record = readIdentityRecordFromLocalStorage(profileId);
  if (!record) {
    return {};
  }
  return {
    publicKeyHex: normalizeString(record.publicKeyHex) || undefined,
    username: normalizeString(record.username) || undefined,
  };
};

const readIdentityPreview = async (profileId: ProfileId): Promise<IdentityPreview> => {
  const fromStorage = readIdentityPreviewFromStorage(profileId);
  if (typeof window === "undefined") {
    return fromStorage;
  }
  try {
    const db = await openIdentityDb();
    const fromDb = await new Promise<IdentityPreview>((resolve, reject) => {
      const tx = db.transaction(identityStoreName, "readonly");
      const store = tx.objectStore(identityStoreName);
      const request = store.get(getProfileIdentityDbKey(profileId));
      request.onsuccess = () => {
        const record = parseIdentityRecord(request.result);
        if (!record) {
          resolve({});
          return;
        }
        resolve({
          publicKeyHex: normalizeString(record.publicKeyHex) || undefined,
          username: normalizeString(record.username) || undefined,
        });
      };
      request.onerror = () => {
        reject(request.error ?? new Error("Failed to read profile identity."));
      };
    });
    return {
      publicKeyHex: fromDb.publicKeyHex || fromStorage.publicKeyHex,
      username: fromDb.username || fromStorage.username,
    };
  } catch {
    return fromStorage;
  }
};

export const loadDesktopProfilePreviewMap = async (
  profiles: ReadonlyArray<Readonly<{ profileId: ProfileId; label?: string }>>,
): Promise<Readonly<Record<string, DesktopProfilePreview>>> => {
  const [hintsByPublicKey, harvestedByProfileId] = await Promise.all([
    buildAccountDisplayHints(),
    buildProfilePickerHintsFromHarvest(),
  ]);
  const entries = await Promise.all(profiles.map(async ({ profileId, label: registryLabel }) => {
    const profile = readProfilePreviewFromStorage(profileId);
    const identityPreview = await readIdentityPreview(profileId);
    const harvested = harvestedByProfileId.get(profileId);
    const publicKeyHex = identityPreview.publicKeyHex
      || harvested?.publicKeyHex
      || getLastBoundAccountPublicKeyHex(profileId)
      || undefined;
    const preview = enrichDesktopProfilePreview(
      profileId,
      {
        username: profile.username || identityPreview.username || harvested?.username || "",
        avatarUrl: profile.avatarUrl,
        publicKeyHex,
      },
      hintsByPublicKey,
      registryLabel,
    );
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
  const currentWindowLabel = params.snapshot.currentWindow.windowLabel;
  const currentProfileId = params.snapshot.currentWindow.profileId;

  return params.snapshot.profiles.map((profile) => {
    const preview = params.previewByProfileId[profile.profileId];
    const isCurrentWindow = profile.profileId === currentProfileId;
    const username = isCurrentWindow
      ? normalizeString(params.currentProfileUsername) || normalizeString(preview?.username)
      : normalizeString(preview?.username);
    const avatarUrl = isCurrentWindow
      ? normalizeString(params.currentProfileAvatarUrl) || normalizeString(preview?.avatarUrl)
      : normalizeString(preview?.avatarUrl);
    const publicKeyHex = isCurrentWindow
      ? normalizeString(params.currentPublicKeyHex) || normalizeString(preview?.publicKeyHex)
      : normalizeString(preview?.publicKeyHex);
    const isOpenInAnotherWindow = params.snapshot.windowBindings.some(
      (binding) => binding.profileId === profile.profileId
        && binding.windowLabel !== currentWindowLabel,
    );

    let focusTargetProfileId: string | undefined = isOpenInAnotherWindow
      ? profile.profileId
      : undefined;
    let shouldFocusExistingWindow = isOpenInAnotherWindow;

    if (publicKeyHex.length > 0 && params.activeLeases && params.activeLeases.length > 0) {
      const normalizedKey = publicKeyHex.toLowerCase();
      const lease = params.activeLeases.find((candidate) => {
        if (candidate.publicKeyHex.toLowerCase() !== normalizedKey) {
          return false;
        }
        return !(candidate.profileId === currentProfileId && candidate.windowLabel === currentWindowLabel);
      });
      if (lease) {
        shouldFocusExistingWindow = true;
        focusTargetProfileId = lease.profileId;
      }
    }

    const hasSavedAccountPresence = hasSavedAccountPickerPresence({
      profileId: profile.profileId,
      username,
      publicKeyHex: publicKeyHex || undefined,
    });

    return {
      profileId: profile.profileId,
      label: username || profile.label,
      avatarUrl,
      avatarName: username || profile.label,
      subtitle: safeFormatPublicKeyPreview(publicKeyHex) || profile.profileId,
      lastUsedLabel: profile.lastUsedAtUnixMs > 0 ? formatRelativeTime(new Date(profile.lastUsedAtUnixMs)) : "never used",
      hasStoredIdentity: publicKeyHex.length > 0,
      hasSavedAccountPresence,
      isCurrentWindow,
      canSwitchHere: !isCurrentWindow && !params.sessionMismatch,
      isOpenInAnotherWindow,
      shouldFocusExistingWindow,
      focusTargetProfileId,
    };
  });
};
