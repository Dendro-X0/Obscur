/** @vitest-environment node */
import { webcrypto } from "node:crypto";
Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  encryptVaultBytesForWrite,
  encryptVaultBytesIfAvailable,
  isVaultWriteEncryptionReady,
  VaultWriteEncryptionRequiredError,
} from "./vault-at-rest";
import { deriveProfileDataKeyMaterial } from "./profile-data-key";
import { getProfileStorageKeyMaterial } from "./profile-storage-key-session";

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: () => "default",
}));

vi.mock("./profile-storage-key-session", () => ({
  getProfileStorageKeyMaterial: vi.fn(() => null),
}));

describe("vault-at-rest write hardening", () => {
  beforeEach(() => {
    vi.mocked(getProfileStorageKeyMaterial).mockReturnValue(null);
  });

  it("reports encryption session readiness from PDK material", async () => {
    expect(isVaultWriteEncryptionReady("default")).toBe(false);
    const keyMaterial = await deriveProfileDataKeyMaterial({
      passphrase: "Obscur-Phase3-Test-Vector!",
      profileId: "default",
    });
    vi.mocked(getProfileStorageKeyMaterial).mockReturnValue(keyMaterial);
    expect(isVaultWriteEncryptionReady("default")).toBe(true);
  });

  it("refuses vault writes without an active PDK session", async () => {
    await expect(
      encryptVaultBytesForWrite({ plaintext: new TextEncoder().encode("secret-bytes") }),
    ).rejects.toBeInstanceOf(VaultWriteEncryptionRequiredError);
  });

  it("encrypts vault bytes when the PDK session is active", async () => {
    const keyMaterial = await deriveProfileDataKeyMaterial({
      passphrase: "Obscur-Phase3-Test-Vector!",
      profileId: "default",
    });
    vi.mocked(getProfileStorageKeyMaterial).mockReturnValue(keyMaterial);
    const result = await encryptVaultBytesForWrite({
      plaintext: new TextEncoder().encode("secret-bytes"),
    });
    expect(result.encrypted).toBe(true);
    expect(result.fileNameSuffix).toBe(".obscurvault");
    expect(new TextDecoder().decode(result.bytes)).toContain("obscur-storage-envelope-v1");
  });

  it("encryptVaultBytesIfAvailable aliases hard write path without plaintext fallback", async () => {
    await expect(
      encryptVaultBytesIfAvailable({ plaintext: new TextEncoder().encode("secret-bytes") }),
    ).rejects.toBeInstanceOf(VaultWriteEncryptionRequiredError);
  });
});
