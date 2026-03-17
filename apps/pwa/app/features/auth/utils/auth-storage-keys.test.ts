import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/features/profiles/services/profile-scope", () => ({
  getActiveProfileIdSafe: () => "active-profile",
  getDefaultProfileId: () => "default",
  getScopedStorageKey: (baseKey: string, profileId?: string) => `${baseKey}::${profileId ?? "active-profile"}`,
}));

import {
  getAuthTokenStorageKey,
  getAuthTokenStorageKeyCandidates,
  getRememberMeStorageKey,
  getRememberMeStorageKeyCandidates,
  LEGACY_AUTH_TOKEN_KEY,
  LEGACY_REMEMBER_ME_KEY,
} from "./auth-storage-keys";

describe("auth-storage-keys", () => {
  it("returns active profile scoped keys by default", () => {
    expect(getRememberMeStorageKey()).toBe("obscur_remember_me::active-profile");
    expect(getAuthTokenStorageKey()).toBe("obscur_auth_token::active-profile");
  });

  it("supports explicit profile-scoped keys", () => {
    expect(getRememberMeStorageKey("bound-profile")).toBe("obscur_remember_me::bound-profile");
    expect(getAuthTokenStorageKey("bound-profile")).toBe("obscur_auth_token::bound-profile");
  });

  it("returns deterministic candidate lists with legacy fallback", () => {
    expect(getRememberMeStorageKeyCandidates({ profileId: "bound-profile", includeLegacy: true })).toEqual([
      "obscur_remember_me::bound-profile",
      "obscur_remember_me::active-profile",
      "obscur_remember_me::default",
      LEGACY_REMEMBER_ME_KEY,
    ]);
    expect(getAuthTokenStorageKeyCandidates({ profileId: "bound-profile", includeLegacy: true })).toEqual([
      "obscur_auth_token::bound-profile",
      "obscur_auth_token::active-profile",
      "obscur_auth_token::default",
      LEGACY_AUTH_TOKEN_KEY,
    ]);
  });

  it("can omit legacy fallback keys", () => {
    expect(getRememberMeStorageKeyCandidates({ includeLegacy: false })).toEqual([
      "obscur_remember_me::active-profile",
      "obscur_remember_me::default",
    ]);
    expect(getAuthTokenStorageKeyCandidates({ includeLegacy: false })).toEqual([
      "obscur_auth_token::active-profile",
      "obscur_auth_token::default",
    ]);
  });
});
