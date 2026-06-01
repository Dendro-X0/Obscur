import { ProfileRegistryService } from "./profile-registry-service";

export type ProfileMigrationReport = Readonly<{
  backupCreated: boolean;
  migratedIdentity: boolean;
  migratedPrivacy: boolean;
  migratedProfile: boolean;
  skipped: number;
  conflicted: number;
  errors: number;
  snapshotKey?: string;
  activeProfileId: string;
}>;

const DEFAULT_PROFILE_ID = "default";
let profileScopeOverride: string | null = null;

type WindowWithSyncProfileScope = Window & {
  __OBSCUR_SYNC_PROFILE_SCOPE__?: string;
};

const readSyncInjectedProfileScope = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const syncScope = (window as WindowWithSyncProfileScope).__OBSCUR_SYNC_PROFILE_SCOPE__;
  return syncScope && syncScope.trim().length > 0 ? syncScope.trim() : null;
};

/** Registry-backed active profile when {@link ProfileRuntimeScope} is not injected (v1.5 Phase 1). */
export const readRegistryBackedActiveProfileId = (): string => {
  const syncScope = readSyncInjectedProfileScope();
  if (syncScope) {
    return syncScope;
  }
  if (profileScopeOverride && profileScopeOverride.trim().length > 0) {
    return profileScopeOverride;
  }
  try {
    return ProfileRegistryService.getActiveProfileId() || DEFAULT_PROFILE_ID;
  } catch {
    return DEFAULT_PROFILE_ID;
  }
};

export const setProfileScopeOverride = (profileId: string | null | undefined): void => {
  profileScopeOverride = typeof profileId === "string" && profileId.trim().length > 0 ? profileId.trim() : null;
};

export const getProfileScopeOverride = (): string | null => (
  readSyncInjectedProfileScope() ?? profileScopeOverride
);

export const getScopedStorageKey = (baseKey: string, profileId = readRegistryBackedActiveProfileId()): string => {
  return `${baseKey}::${profileId}`;
};

export const getDefaultScopedStorageKey = (baseKey: string): string => {
  return getScopedStorageKey(baseKey, DEFAULT_PROFILE_ID);
};

export const getProfileIdentityDbKey = (profileId = readRegistryBackedActiveProfileId()): string => {
  return `identity::${profileId}`;
};

export const getDefaultProfileIdentityDbKey = (): string => getProfileIdentityDbKey(DEFAULT_PROFILE_ID);

export const getDefaultProfileId = (): string => DEFAULT_PROFILE_ID;
