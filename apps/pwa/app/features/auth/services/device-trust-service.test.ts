import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDeviceTrustSnapshot,
  persistDeviceUnlockCredential,
  revokeDeviceTrust,
  setDeviceTrustEnabled,
} from "./device-trust-service";
import {
  getAuthTokenStorageKey,
  getRememberMeStorageKey,
} from "@/app/features/auth/utils/auth-storage-keys";

const nativeRuntime = vi.hoisted(() => ({
  isNative: false,
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: () => nativeRuntime.isNative,
}));

vi.mock("@/app/features/auth/services/session-credential-policy", () => ({
  SESSION_CREDENTIAL_PERSISTENCE_ENABLED: false,
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

describe("device-trust-service", () => {
  beforeEach(() => {
    localStorage.clear();
    nativeRuntime.isNative = false;
  });

  it("does not enable trust while credential persistence is disabled", () => {
    nativeRuntime.isNative = true;
    setDeviceTrustEnabled("default", true);

    expect(getDeviceTrustSnapshot("default")).toMatchObject({
      trusted: false,
      restorePath: "none",
      usesNativeSecureStore: true,
      hasUnlockToken: false,
    });
  });

  it("does not persist unlock tokens while credential persistence is disabled", () => {
    persistDeviceUnlockCredential({
      profileId: "default",
      trusted: true,
      passphrase: "secret-passphrase",
    });

    expect(getDeviceTrustSnapshot("default").trusted).toBe(false);
    expect(localStorage.getItem(getAuthTokenStorageKey("default"))).toBeNull();
  });

  it("revoke clears trust flag and unlock tokens", () => {
    persistDeviceUnlockCredential({
      profileId: "default",
      trusted: true,
      passphrase: "secret-passphrase",
    });
    revokeDeviceTrust("default");

    expect(getDeviceTrustSnapshot("default").trusted).toBe(false);
    expect(localStorage.getItem(getAuthTokenStorageKey("default"))).toBeNull();
    expect(localStorage.getItem(getRememberMeStorageKey("default"))).toBeNull();
  });
});
