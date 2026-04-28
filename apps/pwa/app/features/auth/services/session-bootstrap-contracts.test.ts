import { beforeEach, describe, expect, it } from "vitest";
import {
  getAuthTokenStorageKey,
  getRememberMeStorageKey,
  LEGACY_AUTH_TOKEN_KEY,
  LEGACY_REMEMBER_ME_KEY,
} from "@/app/features/auth/utils/auth-storage-keys";
import {
  deriveRememberMeBootstrapPreference,
  isRememberMeEnabledForProfile,
  scanStoredSessionBootstrap,
} from "./session-bootstrap-contracts";

describe("session-bootstrap-contracts", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("detects remember-me enablement from scoped and legacy candidates", () => {
    window.localStorage.setItem(getRememberMeStorageKey("bound-profile"), "true");
    expect(isRememberMeEnabledForProfile("bound-profile")).toBe(true);

    window.localStorage.clear();
    window.localStorage.setItem(LEGACY_REMEMBER_ME_KEY, "true");
    expect(isRememberMeEnabledForProfile("default")).toBe(true);
  });

  it("classifies scoped token auto-unlock as the primary bootstrap path", () => {
    window.localStorage.setItem(getRememberMeStorageKey("bound-profile"), "true");
    window.localStorage.setItem(getAuthTokenStorageKey("bound-profile"), "scoped-token");

    expect(scanStoredSessionBootstrap("bound-profile")).toEqual({
      profileId: "bound-profile",
      rememberMeState: "enabled",
      rememberCandidateCount: 1,
      rememberSource: "scoped",
      tokenCandidates: ["scoped-token"],
      tokenCandidateCount: 1,
      tokenSource: "scoped",
      autoUnlockPath: "token",
      autoUnlockEligible: true,
    });
  });

  it("falls back to native-session restore when remember-me is set but tokens are absent", () => {
    window.localStorage.setItem(LEGACY_REMEMBER_ME_KEY, "true");

    expect(scanStoredSessionBootstrap("default")).toEqual({
      profileId: "default",
      rememberMeState: "enabled",
      rememberCandidateCount: 1,
      rememberSource: "legacy",
      tokenCandidates: [],
      tokenCandidateCount: 0,
      tokenSource: "none",
      autoUnlockPath: "native_session",
      autoUnlockEligible: false,
    });
  });

  it("classifies mixed scoped and legacy token sources without duplicating candidates", () => {
    window.localStorage.setItem(getRememberMeStorageKey("default"), "true");
    window.localStorage.setItem(LEGACY_REMEMBER_ME_KEY, "true");
    window.localStorage.setItem(getAuthTokenStorageKey("default"), "shared-token");
    window.localStorage.setItem(LEGACY_AUTH_TOKEN_KEY, "shared-token");

    expect(scanStoredSessionBootstrap("default")).toEqual({
      profileId: "default",
      rememberMeState: "enabled",
      rememberCandidateCount: 2,
      rememberSource: "mixed",
      tokenCandidates: ["shared-token"],
      tokenCandidateCount: 1,
      tokenSource: "mixed",
      autoUnlockPath: "token",
      autoUnlockEligible: true,
    });
  });

  it("defaults remember-me to true for stored identities when no credential markers exist", () => {
    expect(deriveRememberMeBootstrapPreference({
      profileId: "default",
      hasStoredIdentity: true,
    })).toEqual({
      rememberMe: true,
      source: "stored_identity_default",
      tokenCandidateCount: 0,
      rememberCandidateCount: 0,
    });
  });
});
