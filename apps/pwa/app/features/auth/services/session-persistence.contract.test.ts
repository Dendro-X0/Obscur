import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isDeviceSessionRestoreAllowed,
  readDeviceSessionConsent,
  resolveStaySignedIn,
} from "./device-session-consent";
import {
  DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY,
  isDeviceSessionTrustPersistenceEnabled,
  isNativeDeviceSessionConsentPersistenceEnabled,
  NATIVE_SECURE_SESSION_RESTORE_ENABLED,
  SESSION_CREDENTIAL_PERSISTENCE_ENABLED,
} from "./session-credential-policy";
import { getRememberMeStorageKey } from "@/app/features/auth/utils/auth-storage-keys";

vi.mock("@/app/features/runtime/shell-contract", () => ({
  isMobileShellBuild: () => false,
  isDesktopShellBuild: () => true,
}));

describe("session-persistence contract", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("desktop shell uses OS keychain consent — not browser credential persistence", () => {
    expect(DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY).toBe(true);
    expect(NATIVE_SECURE_SESSION_RESTORE_ENABLED).toBe(true);
    expect(SESSION_CREDENTIAL_PERSISTENCE_ENABLED).toBe(false);
    expect(isNativeDeviceSessionConsentPersistenceEnabled()).toBe(true);
    expect(isDeviceSessionTrustPersistenceEnabled()).toBe(true);
  });

  it("maps explicit stay-signed-in opt-out to unlock options and restore gate", () => {
    localStorage.setItem(getRememberMeStorageKey("default"), "false");
    expect(resolveStaySignedIn({ staySignedIn: false })).toBe(false);
    expect(readDeviceSessionConsent("default")).toBe(false);
    expect(isDeviceSessionRestoreAllowed("default")).toBe(false);
  });

  it("defaults stay-signed-in and restore when desktop consent is unset", () => {
    expect(readDeviceSessionConsent("default")).toBe(true);
    expect(resolveStaySignedIn()).toBe(true);
    expect(isDeviceSessionRestoreAllowed("default")).toBe(true);
  });
});
