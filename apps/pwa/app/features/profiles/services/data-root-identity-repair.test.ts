import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { PASSWORDLESS_NATIVE_ONLY_SENTINEL } from "@/app/features/auth/services/passwordless-native-only-identity";

const PUBLIC_KEY = "e07f67dcb8a58f53b13fd15ae549c31fb3817a3a6cf0e8bd6903bae3c191ea56" as PublicKeyHex;
const ENCRYPTED = "{\"v\":1,\"alg\":\"PBKDF2-SHA256/AES-256-GCM\"}";

const harvestMock = vi.fn();
const writeMock = vi.fn();

vi.mock("./profile-web-storage-harvest-service", () => ({
  harvestProfileWebStorage: (...args: unknown[]) => harvestMock(...args),
}));

vi.mock("@/app/features/auth/utils/identity-persistence", () => ({
  parseIdentityRecord: (value: unknown) => value,
  writeIdentityRecordToLocalStorage: (...args: unknown[]) => writeMock(...args),
  listIdentityRecordCandidatesFromLocalStorage: vi.fn(() => []),
  readIdentityRecordFromLocalStorage: vi.fn(() => undefined),
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: () => true,
}));

import {
  repairPasswordProtectedIdentityFromWebStorageHarvest,
  resolvePasswordProtectedIdentityRecord,
  shouldAttemptPasswordProtectedIdentityRepair,
} from "./data-root-identity-repair";
import {
  listIdentityRecordCandidatesFromLocalStorage,
} from "@/app/features/auth/utils/identity-persistence";

describe("data-root-identity-repair", () => {
  beforeEach(() => {
    harvestMock.mockReset();
    writeMock.mockReset();
  });

  it("detects passwordless native-only records and missing records", () => {
    expect(shouldAttemptPasswordProtectedIdentityRepair({
      encryptedPrivateKey: PASSWORDLESS_NATIVE_ONLY_SENTINEL,
      publicKeyHex: PUBLIC_KEY,
    })).toBe(true);
    expect(shouldAttemptPasswordProtectedIdentityRepair(undefined)).toBe(true);
    expect(shouldAttemptPasswordProtectedIdentityRepair({
      encryptedPrivateKey: ENCRYPTED,
      publicKeyHex: PUBLIC_KEY,
    })).toBe(false);
  });

  it("restores a password-protected identity from sibling web storage harvest", async () => {
    harvestMock.mockResolvedValue({
      scannedFileCount: 2,
      ledgers: [],
      directories: [],
      identities: [
        {
          profileSlot: "default",
          profileId: "default",
          publicKeyHex: PUBLIC_KEY,
          isPasswordless: true,
          sourcePath: "000017.ldb",
          record: {
            encryptedPrivateKey: PASSWORDLESS_NATIVE_ONLY_SENTINEL,
            publicKeyHex: PUBLIC_KEY,
            username: "Tester1",
          },
        },
        {
          profileSlot: "default",
          profileId: "default",
          publicKeyHex: PUBLIC_KEY,
          isPasswordless: false,
          sourcePath: "000005.ldb",
          record: {
            encryptedPrivateKey: ENCRYPTED,
            publicKeyHex: PUBLIC_KEY,
            username: "Tester1",
          },
        },
      ],
    });

    const repaired = await repairPasswordProtectedIdentityFromWebStorageHarvest({
      profileId: "default",
      expectedPublicKeyHex: PUBLIC_KEY,
    });

    expect(repaired).toBe(true);
    expect(writeMock).toHaveBeenCalledWith({
      profileId: "default",
      record: {
        encryptedPrivateKey: ENCRYPTED,
        publicKeyHex: PUBLIC_KEY,
        username: "Tester1",
      },
    });
  });

  it("restores password-protected identity by pubkey when profile id alias differs", async () => {
    harvestMock.mockResolvedValue({
      scannedFileCount: 1,
      ledgers: [],
      directories: [],
      identities: [
        {
          profileSlot: "legacy-slot",
          profileId: "default",
          publicKeyHex: PUBLIC_KEY,
          isPasswordless: false,
          sourcePath: "000005.ldb",
          record: {
            encryptedPrivateKey: ENCRYPTED,
            publicKeyHex: PUBLIC_KEY,
            username: "Tester2",
          },
        },
      ],
    });

    const repaired = await repairPasswordProtectedIdentityFromWebStorageHarvest({
      profileId: "profile-tester2-window",
      expectedPublicKeyHex: PUBLIC_KEY,
    });

    expect(repaired).toBe(true);
    expect(writeMock).toHaveBeenCalledWith({
      profileId: "profile-tester2-window",
      record: {
        encryptedPrivateKey: ENCRYPTED,
        publicKeyHex: PUBLIC_KEY,
        username: "Tester2",
      },
    });
  });

  it("promotes password-protected alias rows from local storage candidates", async () => {
    vi.mocked(listIdentityRecordCandidatesFromLocalStorage).mockReturnValue([
      {
        encryptedPrivateKey: PASSWORDLESS_NATIVE_ONLY_SENTINEL,
        publicKeyHex: PUBLIC_KEY,
        username: "Tester2",
      },
      {
        encryptedPrivateKey: ENCRYPTED,
        publicKeyHex: PUBLIC_KEY,
        username: "Tester2",
      },
    ]);

    const restored = await resolvePasswordProtectedIdentityRecord({
      profileId: "profile-tester2",
      expectedPublicKeyHex: PUBLIC_KEY,
    });

    expect(restored?.encryptedPrivateKey).toBe(ENCRYPTED);
    expect(writeMock).toHaveBeenCalledWith({
      profileId: "profile-tester2",
      record: {
        encryptedPrivateKey: ENCRYPTED,
        publicKeyHex: PUBLIC_KEY,
        username: "Tester2",
      },
    });
    expect(harvestMock).not.toHaveBeenCalled();
  });
});
