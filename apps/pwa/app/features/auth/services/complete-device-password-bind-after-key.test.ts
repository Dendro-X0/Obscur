import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Passphrase } from "@dweb/crypto/passphrase";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";

const storageMocks = vi.hoisted(() => ({
  activateNativeStorageAtRestUnlock: vi.fn(async () => true),
  ensureNativeSqliteOpenForWrites: vi.fn(async () => true),
}));

vi.mock("@/app/features/storage/services/native-storage-at-rest-service", () => ({
  activateNativeStorageAtRestUnlock: storageMocks.activateNativeStorageAtRestUnlock,
  ensureNativeSqliteOpenForWrites: storageMocks.ensureNativeSqliteOpenForWrites,
}));

import { completeDevicePasswordBindAfterKey } from "./complete-device-password-bind-after-key";

describe("completeDevicePasswordBindAfterKey (Slice A)", () => {
  beforeEach(() => {
    storageMocks.activateNativeStorageAtRestUnlock.mockReset();
    storageMocks.activateNativeStorageAtRestUnlock.mockResolvedValue(true);
    storageMocks.ensureNativeSqliteOpenForWrites.mockReset();
    storageMocks.ensureNativeSqliteOpenForWrites.mockResolvedValue(true);
  });

  it("activates PDK, re-wraps identity, and confirms sqlite open", async () => {
    const resetPassphraseWithPrivateKey = vi.fn(async () => undefined);
    const result = await completeDevicePasswordBindAfterKey({
      profileId: "default",
      passphrase: "DevicePass#2026" as Passphrase,
      privateKeyHex: "a".repeat(64) as PrivateKeyHex,
      resetPassphraseWithPrivateKey,
    });

    expect(result).toEqual({ ok: true });
    expect(storageMocks.activateNativeStorageAtRestUnlock).toHaveBeenCalledWith({
      profileId: "default",
      passphrase: "DevicePass#2026",
    });
    expect(resetPassphraseWithPrivateKey).toHaveBeenCalledWith({
      privateKeyHex: "a".repeat(64),
      newPassphrase: "DevicePass#2026",
    });
    expect(storageMocks.ensureNativeSqliteOpenForWrites).toHaveBeenCalledWith({
      profileId: "default",
    });
  });

  it("rejects short passphrases before touching storage", async () => {
    const result = await completeDevicePasswordBindAfterKey({
      profileId: "default",
      passphrase: "short" as Passphrase,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("policy");
    expect(storageMocks.activateNativeStorageAtRestUnlock).not.toHaveBeenCalled();
  });

  it("fails closed when activate returns false", async () => {
    storageMocks.activateNativeStorageAtRestUnlock.mockResolvedValueOnce(false);
    const result = await completeDevicePasswordBindAfterKey({
      profileId: "default",
      passphrase: "DevicePass#2026" as Passphrase,
    });
    expect(result).toEqual({ ok: false, reason: "activate_failed" });
  });
});
