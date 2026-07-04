import { describe, expect, it, vi } from "vitest";
import {
  DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY,
  isDeviceSessionTrustPersistenceEnabled,
  isNativeDeviceSessionConsentPersistenceEnabled,
  NATIVE_DEVICE_SESSION_CONSENT_ENABLED,
  NATIVE_SECURE_SESSION_RESTORE_ENABLED,
  SESSION_CREDENTIAL_PERSISTENCE_ENABLED,
} from "./session-credential-policy";

vi.mock("@/app/features/runtime/shell-contract", () => ({
  isMobileShellBuild: () => false,
  isDesktopShellBuild: () => true,
}));

describe("session-credential-policy", () => {
  it("enables desktop OS session restore after AUTH-KERN-1 gate", () => {
    expect(DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY).toBe(true);
    expect(NATIVE_SECURE_SESSION_RESTORE_ENABLED).toBe(true);
    expect(NATIVE_DEVICE_SESSION_CONSENT_ENABLED).toBe(true);
    expect(isNativeDeviceSessionConsentPersistenceEnabled()).toBe(true);
    expect(SESSION_CREDENTIAL_PERSISTENCE_ENABLED).toBe(false);
    expect(isDeviceSessionTrustPersistenceEnabled()).toBe(true);
  });
});
