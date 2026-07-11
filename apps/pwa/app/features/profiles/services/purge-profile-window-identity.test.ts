import { beforeEach, describe, expect, it, vi } from "vitest";
import { purgeProfileWindowIdentityCompletely } from "./purge-profile-window-identity";

vi.mock("@/app/features/auth-kernel/auth-kernel-sign-out-cleanup", () => ({
  runAuthKernelSignOutCleanup: vi.fn(async () => undefined),
}));

vi.mock("@/app/features/auth/services/device-trust-service", () => ({
  revokeDeviceTrust: vi.fn(),
  clearDeviceTrustArtifacts: vi.fn(),
}));

vi.mock("@/app/features/auth/services/native-device-session-lifecycle", () => ({
  endNativeDeviceSignInBestEffort: vi.fn(async () => undefined),
}));

vi.mock("@/app/features/auth/services/native-session-persist-feedback", () => ({
  clearNativeSessionPersistError: vi.fn(),
}));

vi.mock("@/app/features/auth/utils/clear-stored-identity", () => ({
  clearStoredIdentity: vi.fn(async () => undefined),
}));

vi.mock("@/app/features/auth/utils/identity-persistence", () => ({
  clearIdentityRecordsFromLocalStorage: vi.fn(),
}));

vi.mock("./profile-data-cleanup", () => ({
  clearProfileLocalData: vi.fn(async () => undefined),
}));

import { runAuthKernelSignOutCleanup } from "@/app/features/auth-kernel/auth-kernel-sign-out-cleanup";
import {
  clearDeviceTrustArtifacts,
  revokeDeviceTrust,
} from "@/app/features/auth/services/device-trust-service";
import { endNativeDeviceSignInBestEffort } from "@/app/features/auth/services/native-device-session-lifecycle";
import { clearNativeSessionPersistError } from "@/app/features/auth/services/native-session-persist-feedback";
import { clearStoredIdentity } from "@/app/features/auth/utils/clear-stored-identity";
import { clearIdentityRecordsFromLocalStorage } from "@/app/features/auth/utils/identity-persistence";
import { clearProfileLocalData } from "./profile-data-cleanup";

describe("purgeProfileWindowIdentityCompletely", () => {
  const publicKeyHex = "a".repeat(64) as import("@dweb/crypto/public-key-hex").PublicKeyHex;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("purges native keychain before durable storage", async () => {
    const callOrder: string[] = [];
    vi.mocked(endNativeDeviceSignInBestEffort).mockImplementation(async () => {
      callOrder.push("native");
    });
    vi.mocked(clearStoredIdentity).mockImplementation(async () => {
      callOrder.push("idb");
    });

    await purgeProfileWindowIdentityCompletely({
      profileId: "profile-secondary",
      publicKeyHex,
    });

    expect(callOrder).toEqual(["native", "idb"]);
    expect(endNativeDeviceSignInBestEffort).toHaveBeenCalled();
    expect(runAuthKernelSignOutCleanup).toHaveBeenCalledWith("profile-secondary");
    expect(revokeDeviceTrust).toHaveBeenCalledWith("profile-secondary");
    expect(clearDeviceTrustArtifacts).toHaveBeenCalledWith({
      profileId: "profile-secondary",
      includeLegacy: true,
    });
    expect(clearNativeSessionPersistError).toHaveBeenCalledWith("profile-secondary");
    expect(clearIdentityRecordsFromLocalStorage).toHaveBeenCalledWith({
      profileId: "profile-secondary",
      publicKeyHex,
    });
    expect(clearProfileLocalData).toHaveBeenCalledWith("profile-secondary");
    expect(clearStoredIdentity).toHaveBeenCalled();
  });

  it("continues when IndexedDB purge fails after native keychain purge", async () => {
    vi.mocked(clearStoredIdentity).mockRejectedValue(new Error("idb unavailable"));

    const warnings = await purgeProfileWindowIdentityCompletely({
      profileId: "default",
      publicKeyHex,
    });

    expect(endNativeDeviceSignInBestEffort).toHaveBeenCalled();
    expect(warnings.some((warning) => warning.includes("IndexedDB identity purge failed"))).toBe(true);
  });
});
