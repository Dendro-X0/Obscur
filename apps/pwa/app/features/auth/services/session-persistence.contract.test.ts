import { describe, expect, it } from "vitest";
import { readDeviceSessionConsent, resolveStaySignedIn } from "./device-session-consent";
import {
  isDeviceSessionTrustPersistenceEnabled,
  isNativeDeviceSessionConsentPersistenceEnabled,
  SESSION_CREDENTIAL_PERSISTENCE_ENABLED,
} from "./session-credential-policy";
import { getRememberMeStorageKey } from "@/app/features/auth/utils/auth-storage-keys";

describe("session-persistence contract", () => {
  it("enables native consent without browser credential persistence on desktop builds", () => {
    expect(SESSION_CREDENTIAL_PERSISTENCE_ENABLED).toBe(false);
    expect(isNativeDeviceSessionConsentPersistenceEnabled()).toBe(true);
    expect(isDeviceSessionTrustPersistenceEnabled()).toBe(true);
  });

  it("maps stay-signed-in checkbox to unlock options and restore gate", () => {
    localStorage.setItem(getRememberMeStorageKey("default"), "false");
    expect(resolveStaySignedIn({ staySignedIn: false })).toBe(false);
    expect(readDeviceSessionConsent("default")).toBe(false);
  });
});
