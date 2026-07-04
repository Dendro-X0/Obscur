import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isDeviceSessionRestoreAllowed,
  readDeviceSessionConsent,
  resolveStaySignedIn,
} from "./device-session-consent";
import { getRememberMeStorageKey } from "@/app/features/auth/utils/auth-storage-keys";

const policyMocks = vi.hoisted(() => ({
  nativeRestoreEnabled: true,
  nativeConsentEnabled: true,
  browserPersistenceEnabled: false,
}));

vi.mock("@/app/features/auth/services/session-credential-policy", () => ({
  get NATIVE_SECURE_SESSION_RESTORE_ENABLED() {
    return policyMocks.nativeRestoreEnabled;
  },
  isNativeDeviceSessionConsentPersistenceEnabled: () => policyMocks.nativeConsentEnabled,
  get SESSION_CREDENTIAL_PERSISTENCE_ENABLED() {
    return policyMocks.browserPersistenceEnabled;
  },
}));

describe("device-session-consent", () => {
  afterEach(() => {
    localStorage.clear();
    policyMocks.nativeRestoreEnabled = true;
    policyMocks.nativeConsentEnabled = true;
    policyMocks.browserPersistenceEnabled = false;
  });

  it("defaults stay signed in to true when unset and consent persistence is enabled", () => {
    expect(readDeviceSessionConsent("default")).toBe(true);
    expect(isDeviceSessionRestoreAllowed("default")).toBe(true);
  });

  it("respects explicit opt-out", () => {
    localStorage.setItem(getRememberMeStorageKey("default"), "false");
    expect(readDeviceSessionConsent("default")).toBe(false);
    expect(isDeviceSessionRestoreAllowed("default")).toBe(false);
  });

  it("resolveStaySignedIn treats undefined as true when persistence is enabled", () => {
    expect(resolveStaySignedIn()).toBe(true);
    expect(resolveStaySignedIn({ staySignedIn: false })).toBe(false);
  });

  it("blocks restore and persist when native restore is cancelled", () => {
    policyMocks.nativeRestoreEnabled = false;
    policyMocks.nativeConsentEnabled = false;
    expect(isDeviceSessionRestoreAllowed("default")).toBe(false);
    expect(resolveStaySignedIn()).toBe(false);
  });
});
