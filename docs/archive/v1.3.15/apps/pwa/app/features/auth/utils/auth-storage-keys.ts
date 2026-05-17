import {
  getActiveProfileIdSafe,
  getDefaultProfileId,
  getScopedStorageKey,
} from "@/app/features/profiles/services/profile-scope";

const REMEMBER_ME_BASE_KEY = "obscur_remember_me";
const AUTH_TOKEN_BASE_KEY = "obscur_auth_token";
export const LEGACY_REMEMBER_ME_KEY = REMEMBER_ME_BASE_KEY;
export const LEGACY_AUTH_TOKEN_KEY = AUTH_TOKEN_BASE_KEY;

type StorageKeyCandidatesParams = Readonly<{
  profileId?: string | null;
  includeLegacy?: boolean;
}>;

type ScopedStorageKeysParams = Readonly<{
  profileId?: string | null;
  includeLegacy?: boolean;
}>;

const unique = (values: ReadonlyArray<string>): ReadonlyArray<string> => Array.from(new Set(values));

const resolveProfileCandidates = (explicitProfileId?: string | null): ReadonlyArray<string> => {
  const candidates = [
    explicitProfileId?.trim(),
    getActiveProfileIdSafe(),
    getDefaultProfileId(),
  ].filter((value): value is string => Boolean(value && value.length > 0));
  return unique(candidates);
};

const buildScopedStorageKeyCandidates = (
  baseKey: string,
  params?: StorageKeyCandidatesParams,
): ReadonlyArray<string> => {
  const scopedKeys = resolveProfileCandidates(params?.profileId)
    .map((profileId) => getScopedStorageKey(baseKey, profileId));
  if (params?.includeLegacy) {
    return unique([...scopedKeys, baseKey]);
  }
  return unique(scopedKeys);
};

export const getRememberMeStorageKey = (profileId?: string): string => (
  getScopedStorageKey(REMEMBER_ME_BASE_KEY, profileId ?? getActiveProfileIdSafe())
);

export const getAuthTokenStorageKey = (profileId?: string): string => (
  getScopedStorageKey(AUTH_TOKEN_BASE_KEY, profileId ?? getActiveProfileIdSafe())
);

const resolveScopedProfileId = (profileId?: string | null): string => {
  const normalized = profileId?.trim();
  if (normalized && normalized.length > 0) {
    return normalized;
  }
  return getActiveProfileIdSafe();
};

const buildScopedStorageKeys = (
  baseKey: string,
  params?: ScopedStorageKeysParams,
): ReadonlyArray<string> => {
  const profileId = resolveScopedProfileId(params?.profileId);
  const keys = [getScopedStorageKey(baseKey, profileId)];
  if ((params?.includeLegacy ?? false) && profileId === getDefaultProfileId()) {
    keys.push(baseKey);
  }
  return keys;
};

export const getRememberMeScopedStorageKeys = (params?: ScopedStorageKeysParams): ReadonlyArray<string> => (
  buildScopedStorageKeys(REMEMBER_ME_BASE_KEY, params)
);

export const getAuthTokenScopedStorageKeys = (params?: ScopedStorageKeysParams): ReadonlyArray<string> => (
  buildScopedStorageKeys(AUTH_TOKEN_BASE_KEY, params)
);

export const getRememberMeStorageKeyCandidates = (params?: StorageKeyCandidatesParams): ReadonlyArray<string> => (
  buildScopedStorageKeyCandidates(REMEMBER_ME_BASE_KEY, {
    ...params,
    includeLegacy: params?.includeLegacy ?? true,
  })
);

export const getAuthTokenStorageKeyCandidates = (params?: StorageKeyCandidatesParams): ReadonlyArray<string> => (
  buildScopedStorageKeyCandidates(AUTH_TOKEN_BASE_KEY, {
    ...params,
    includeLegacy: params?.includeLegacy ?? true,
  })
);
