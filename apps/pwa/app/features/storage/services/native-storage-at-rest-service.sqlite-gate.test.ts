import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: vi.fn(() => true),
}));

vi.mock("@/app/features/runtime/native-adapters", () => ({
  invokeNativeCommand: vi.fn(),
}));

vi.mock("./profile-storage-key-session", () => ({
  clearProfileStorageKeySession: vi.fn(),
  establishProfileStorageKeySession: vi.fn(),
  establishProfileStorageKeySessionFromMaterial: vi.fn(),
  getProfileStorageKeyMaterial: vi.fn(() => null),
}));

vi.mock("./vault-at-rest", () => ({
  isVaultWriteEncryptionReady: vi.fn(() => false),
  resolveVaultProfileId: vi.fn(() => "default"),
}));

vi.mock("./profile-data-key", () => ({
  profileDataKeyMaterialToBase64: vi.fn(() => ""),
}));

import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import {
  activateNativeStorageAtRestUnlock,
  ensureNativeSqliteOpenForWrites,
  restoreNativeVaultEncryptionSessionIfNeeded,
  syncNativeVaultEncryptionSessionAfterIdentityUnlock,
} from "./native-storage-at-rest-service";
import {
  establishProfileStorageKeySession,
  establishProfileStorageKeySessionFromMaterial,
  getProfileStorageKeyMaterial,
} from "./profile-storage-key-session";
import { isVaultWriteEncryptionReady } from "./vault-at-rest";
import { profileDataKeyMaterialToBase64 } from "./profile-data-key";
import { fromBase64 } from "@dweb/crypto/from-base64";

vi.mock("@dweb/crypto/from-base64", () => ({
  fromBase64: vi.fn(() => new Uint8Array(32)),
}));

describe("ensureNativeSqliteOpenForWrites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
  });

  it("returns true on non-native runtimes", async () => {
    vi.mocked(hasNativeRuntime).mockReturnValue(false);
    await expect(ensureNativeSqliteOpenForWrites()).resolves.toBe(true);
    expect(invokeNativeCommand).not.toHaveBeenCalled();
  });

  it("falls back to desktop_db_ensure_open when vault PDK restore fails", async () => {
    vi.mocked(invokeNativeCommand).mockImplementation(async (command) => {
      if (command === "desktop_storage_at_rest_restore_keychain") {
        return { ok: true, value: null };
      }
      if (command === "desktop_db_ensure_open") {
        return { ok: true, value: true };
      }
      return { ok: false, reason: "failed", message: `unexpected ${command}` };
    });
    await expect(ensureNativeSqliteOpenForWrites()).resolves.toBe(true);
    expect(invokeNativeCommand).toHaveBeenCalledWith(
      "desktop_db_ensure_open",
      {},
      expect.objectContaining({ timeoutMs: 8_000 }),
    );
  });

  it("returns false when encrypted envelope blocks plaintext reopen", async () => {
    vi.mocked(invokeNativeCommand).mockImplementation(async (command) => {
      if (command === "desktop_storage_at_rest_restore_keychain") {
        return { ok: true, value: null };
      }
      if (command === "desktop_db_ensure_open") {
        return {
          ok: false,
          reason: "failed",
          message: "Local database is locked. Unlock this profile to continue.",
        };
      }
      return { ok: false, reason: "failed", message: `unexpected ${command}` };
    });
    await expect(ensureNativeSqliteOpenForWrites()).resolves.toBe(false);
  });
});

describe("activateNativeStorageAtRestUnlock (soft-lock slice 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    vi.mocked(establishProfileStorageKeySession).mockResolvedValue(undefined as never);
    vi.mocked(getProfileStorageKeyMaterial).mockReturnValue(new Uint8Array(32) as never);
    vi.mocked(profileDataKeyMaterialToBase64).mockReturnValue("dGVzdA==");
  });

  it("returns false when native unlock invoke fails", async () => {
    vi.mocked(invokeNativeCommand).mockResolvedValue({
      ok: false,
      reason: "failed",
      message: "Local database is locked. Unlock this profile to continue.",
    });
    await expect(
      activateNativeStorageAtRestUnlock({
        profileId: "default",
        passphrase: "correct-horse" as never,
      }),
    ).resolves.toBe(false);
  });

  it("returns true when native unlock invoke succeeds", async () => {
    vi.mocked(invokeNativeCommand).mockResolvedValue({ ok: true, value: undefined });
    await expect(
      activateNativeStorageAtRestUnlock({
        profileId: "default",
        passphrase: "correct-horse" as never,
      }),
    ).resolves.toBe(true);
    expect(invokeNativeCommand).toHaveBeenCalledWith(
      "desktop_storage_at_rest_unlock",
      expect.objectContaining({ profileId: "default" }),
    );
  });
});

describe("syncNativeVaultEncryptionSessionAfterIdentityUnlock (Slice C)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    vi.mocked(isVaultWriteEncryptionReady).mockReturnValue(false);
    vi.mocked(establishProfileStorageKeySession).mockResolvedValue(undefined as never);
    vi.mocked(establishProfileStorageKeySessionFromMaterial).mockReturnValue(undefined as never);
    vi.mocked(getProfileStorageKeyMaterial).mockReturnValue(new Uint8Array(32) as never);
    vi.mocked(profileDataKeyMaterialToBase64).mockReturnValue("dGVzdA==");
    vi.mocked(fromBase64).mockReturnValue(new Uint8Array(32));
  });

  it("restores PDK from keychain when no passphrase is provided (Advanced key path)", async () => {
    const keyB64 = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    vi.mocked(invokeNativeCommand).mockImplementation(async (command) => {
      if (command === "desktop_storage_at_rest_restore_keychain") {
        return { ok: true, value: keyB64 };
      }
      return { ok: false, reason: "failed", message: `unexpected ${command}` };
    });
    vi.mocked(isVaultWriteEncryptionReady).mockReturnValueOnce(false).mockReturnValue(true);

    await expect(
      syncNativeVaultEncryptionSessionAfterIdentityUnlock({ profileId: "default" }),
    ).resolves.toBe(true);
    expect(invokeNativeCommand).toHaveBeenCalledWith(
      "desktop_storage_at_rest_restore_keychain",
      { profileId: "default" },
      expect.objectContaining({ timeoutMs: 8_000 }),
    );
    expect(establishProfileStorageKeySessionFromMaterial).toHaveBeenCalled();
  });

  it("falls back to keychain restore when passphrase activate fails", async () => {
    vi.mocked(invokeNativeCommand).mockImplementation(async (command) => {
      if (command === "desktop_storage_at_rest_unlock") {
        return { ok: false, reason: "failed", message: "locked" };
      }
      if (command === "desktop_storage_at_rest_restore_keychain") {
        return { ok: true, value: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" };
      }
      return { ok: false, reason: "failed", message: `unexpected ${command}` };
    });
    vi.mocked(isVaultWriteEncryptionReady).mockReturnValueOnce(false).mockReturnValue(true);

    await expect(
      syncNativeVaultEncryptionSessionAfterIdentityUnlock({
        profileId: "default",
        passphrase: "DevicePass#2026" as never,
      }),
    ).resolves.toBe(true);
    expect(invokeNativeCommand).toHaveBeenCalledWith(
      "desktop_storage_at_rest_unlock",
      expect.objectContaining({ profileId: "default" }),
    );
    expect(invokeNativeCommand).toHaveBeenCalledWith(
      "desktop_storage_at_rest_restore_keychain",
      { profileId: "default" },
      expect.objectContaining({ timeoutMs: 8_000 }),
    );
  });

  it("restoreNativeVaultEncryptionSessionIfNeeded returns true when vault already ready", async () => {
    vi.mocked(isVaultWriteEncryptionReady).mockReturnValue(true);
    await expect(
      restoreNativeVaultEncryptionSessionIfNeeded({ profileId: "default" }),
    ).resolves.toBe(true);
    expect(invokeNativeCommand).not.toHaveBeenCalled();
  });
});
