import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDeviceTrustSnapshot,
  persistDeviceUnlockCredential,
  persistSessionUnlockAfterSuccess,
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

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

describe("device-trust-service", () => {
  beforeEach(() => {
    localStorage.clear();
    nativeRuntime.isNative = false;
  });

  it("persists native trust flag without browser tokens on desktop", () => {
    nativeRuntime.isNative = true;
    setDeviceTrustEnabled("default", true);

    expect(getDeviceTrustSnapshot("default")).toMatchObject({
      trusted: true,
      restorePath: "native_session",
      usesNativeSecureStore: true,
      hasUnlockToken: false,
    });
    expect(localStorage.getItem(getAuthTokenStorageKey("default"))).toBeNull();
  });

  it("records opt-out without writing browser unlock tokens on native", () => {
    nativeRuntime.isNative = true;
    persistDeviceUnlockCredential({
      profileId: "default",
      trusted: false,
      passphrase: "secret-passphrase",
    });

    expect(getDeviceTrustSnapshot("default").trusted).toBe(false);
    expect(localStorage.getItem(getAuthTokenStorageKey("default"))).toBeNull();
    expect(localStorage.getItem(getRememberMeStorageKey("default"))).toBe("false");
  });

  it("persistSessionUnlockAfterSuccess writes native consent only", () => {
    nativeRuntime.isNative = true;
    persistSessionUnlockAfterSuccess({
      profileId: "default",
      passphrase: "secret-passphrase",
      trusted: true,
    });

    expect(getDeviceTrustSnapshot("default").trusted).toBe(true);
    expect(localStorage.getItem(getAuthTokenStorageKey("default"))).toBeNull();
  });

  it("revoke clears trust flag and unlock tokens", () => {
    nativeRuntime.isNative = true;
    persistDeviceUnlockCredential({
      profileId: "default",
      trusted: true,
    });
    revokeDeviceTrust("default");

    expect(getDeviceTrustSnapshot("default").trusted).toBe(false);
    expect(localStorage.getItem(getAuthTokenStorageKey("default"))).toBeNull();
    expect(localStorage.getItem(getRememberMeStorageKey("default"))).toBe("false");
  });
});
