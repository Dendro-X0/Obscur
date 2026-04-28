import {
  getAuthTokenScopedStorageKeys,
  getRememberMeScopedStorageKeys,
  getRememberMeStorageKeyCandidates,
  LEGACY_AUTH_TOKEN_KEY,
  LEGACY_REMEMBER_ME_KEY,
} from "@/app/features/auth/utils/auth-storage-keys";

export type SessionBootstrapCredentialSource = "none" | "scoped" | "legacy" | "mixed";

export type SessionBootstrapRememberMeState = "enabled" | "disabled";

export type SessionBootstrapAutoUnlockPath = "token" | "native_session" | "none";

export type SessionBootstrapRememberPreferenceSource =
  | "stored_credentials"
  | "stored_identity_default"
  | "explicit_false"
  | "default_true";

export type SessionBootstrapCredentialScan = Readonly<{
  profileId: string;
  rememberMeState: SessionBootstrapRememberMeState;
  rememberCandidateCount: number;
  rememberSource: SessionBootstrapCredentialSource;
  tokenCandidates: ReadonlyArray<string>;
  tokenCandidateCount: number;
  tokenSource: SessionBootstrapCredentialSource;
  autoUnlockPath: SessionBootstrapAutoUnlockPath;
  autoUnlockEligible: boolean;
}>;

export type SessionBootstrapRememberPreference = Readonly<{
  rememberMe: boolean;
  source: SessionBootstrapRememberPreferenceSource;
  tokenCandidateCount: number;
  rememberCandidateCount: number;
}>;

const classifyCredentialSource = (
  matchedKeys: ReadonlyArray<string>,
  legacyKey: string,
): SessionBootstrapCredentialSource => {
  if (matchedKeys.length === 0) {
    return "none";
  }
  const hasLegacy = matchedKeys.includes(legacyKey);
  const hasScoped = matchedKeys.some((key) => key !== legacyKey);
  if (hasLegacy && hasScoped) {
    return "mixed";
  }
  if (hasLegacy) {
    return "legacy";
  }
  return "scoped";
};

const readStoredValues = (keys: ReadonlyArray<string>): ReadonlyArray<Readonly<{ key: string; value: string }>> => {
  if (typeof window === "undefined") {
    return [];
  }
  return keys.flatMap((key) => {
    const value = window.localStorage.getItem(key);
    if (value === null) {
      return [];
    }
    return [{ key, value }] as const;
  });
};

export const isRememberMeEnabledForProfile = (profileId: string): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  return getRememberMeStorageKeyCandidates({
    profileId,
    includeLegacy: true,
  }).some((key) => window.localStorage.getItem(key) === "true");
};

export const scanStoredSessionBootstrap = (profileId: string): SessionBootstrapCredentialScan => {
  const rememberValues = readStoredValues(
    getRememberMeScopedStorageKeys({
      profileId,
      includeLegacy: true,
    }),
  );
  const tokenValues = readStoredValues(
    getAuthTokenScopedStorageKeys({
      profileId,
      includeLegacy: true,
    }),
  ).filter(({ value }) => value.length > 0);
  const uniqueTokenCandidates = Array.from(new Set(tokenValues.map(({ value }) => value)));
  const rememberEnabled = rememberValues.some(({ value }) => value === "true");
  const rememberSource = classifyCredentialSource(
    rememberValues.filter(({ value }) => value === "true").map(({ key }) => key),
    LEGACY_REMEMBER_ME_KEY,
  );
  const tokenSource = classifyCredentialSource(
    tokenValues.map(({ key }) => key),
    LEGACY_AUTH_TOKEN_KEY,
  );
  const autoUnlockPath: SessionBootstrapAutoUnlockPath = uniqueTokenCandidates.length > 0
    ? "token"
    : rememberEnabled
      ? "native_session"
      : "none";
  return {
    profileId,
    rememberMeState: rememberEnabled ? "enabled" : "disabled",
    rememberCandidateCount: rememberValues.length,
    rememberSource,
    tokenCandidates: uniqueTokenCandidates,
    tokenCandidateCount: uniqueTokenCandidates.length,
    tokenSource,
    autoUnlockPath,
    autoUnlockEligible: autoUnlockPath === "token",
  };
};

export const deriveRememberMeBootstrapPreference = (params: Readonly<{
  profileId: string;
  hasStoredIdentity: boolean;
}>): SessionBootstrapRememberPreference => {
  const scan = scanStoredSessionBootstrap(params.profileId);
  if (scan.rememberMeState === "enabled" || scan.tokenCandidateCount > 0) {
    return {
      rememberMe: true,
      source: "stored_credentials",
      tokenCandidateCount: scan.tokenCandidateCount,
      rememberCandidateCount: scan.rememberCandidateCount,
    };
  }
  if (params.hasStoredIdentity) {
    return {
      rememberMe: true,
      source: "stored_identity_default",
      tokenCandidateCount: scan.tokenCandidateCount,
      rememberCandidateCount: scan.rememberCandidateCount,
    };
  }
  if (scan.rememberCandidateCount > 0) {
    return {
      rememberMe: false,
      source: "explicit_false",
      tokenCandidateCount: scan.tokenCandidateCount,
      rememberCandidateCount: scan.rememberCandidateCount,
    };
  }
  return {
    rememberMe: true,
    source: "default_true",
    tokenCandidateCount: scan.tokenCandidateCount,
    rememberCandidateCount: scan.rememberCandidateCount,
  };
};
