import { describe, expect, it, vi } from "vitest";
import {
  isDeviceSessionTrustPersistenceEnabled,
  isNativeDeviceSessionConsentPersistenceEnabled,
  NATIVE_DEVICE_SESSION_CONSENT_ENABLED,
  SESSION_CREDENTIAL_PERSISTENCE_ENABLED,
} from "./session-credential-policy";

vi.mock("@/app/features/runtime/shell-contract", () => ({
  isMobileShellBuild: () => false,
}));

describe("session-credential-policy", () => {
  it("keeps native device session consent enabled on desktop builds", () => {
    expect(NATIVE_DEVICE_SESSION_CONSENT_ENABLED).toBe(true);
    expect(isNativeDeviceSessionConsentPersistenceEnabled()).toBe(true);
    expect(SESSION_CREDENTIAL_PERSISTENCE_ENABLED).toBe(false);
    expect(isDeviceSessionTrustPersistenceEnabled()).toBe(true);
  });
});
