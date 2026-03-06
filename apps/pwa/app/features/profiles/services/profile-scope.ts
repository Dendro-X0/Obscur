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

export const getActiveProfileIdSafe = (): string => {
  try {
    return ProfileRegistryService.getActiveProfileId() || DEFAULT_PROFILE_ID;
  } catch {
    return DEFAULT_PROFILE_ID;
  }
};

export const getScopedStorageKey = (baseKey: string, profileId = getActiveProfileIdSafe()): string => {
  return `${baseKey}::${profileId}`;
};

export const getDefaultScopedStorageKey = (baseKey: string): string => {
  return getScopedStorageKey(baseKey, DEFAULT_PROFILE_ID);
};

export const getProfileIdentityDbKey = (profileId = getActiveProfileIdSafe()): string => {
  return `identity::${profileId}`;
};

export const getDefaultProfileIdentityDbKey = (): string => getProfileIdentityDbKey(DEFAULT_PROFILE_ID);

export const getDefaultProfileId = (): string => DEFAULT_PROFILE_ID;
