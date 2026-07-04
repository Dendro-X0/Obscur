import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { PASSWORDLESS_NATIVE_ONLY_SENTINEL } from "@/app/features/auth/services/passwordless-native-only-identity";

const PUBLIC_KEY = "e07f67dcb8a58f53b13fd15ae549c31fb3817a3a6cf0e8bd6903bae3c191ea56" as PublicKeyHex;
const ENCRYPTED_A = "{\"v\":1,\"alg\":\"PBKDF2-SHA256/AES-256-GCM\",\"blob\":\"a\"}";
const ENCRYPTED_B = "{\"v\":1,\"alg\":\"PBKDF2-SHA256/AES-256-GCM\",\"blob\":\"b\"}";
const PRIVATE_KEY = "1".repeat(64);

const harvestMock = vi.fn();
const listLocalMock = vi.fn();
const decryptMock = vi.fn();
const deriveMock = vi.fn();
const repairMock = vi.fn();
const readActiveMock = vi.fn();

vi.mock("./profile-web-storage-harvest-service", () => ({
  harvestProfileWebStorage: (...args: unknown[]) => harvestMock(...args),
}));

vi.mock("./data-root-identity-repair", () => ({
  resolvePasswordProtectedIdentityRecord: (...args: unknown[]) => repairMock(...args),
  shouldAttemptPasswordProtectedIdentityRepair: (record?: { encryptedPrivateKey: string }) => (
    !record || record.encryptedPrivateKey === PASSWORDLESS_NATIVE_ONLY_SENTINEL
  ),
}));

vi.mock("@/app/features/auth/utils/identity-persistence", () => ({
  listIdentityRecordCandidatesFromLocalStorage: (...args: unknown[]) => listLocalMock(...args),
  parseIdentityRecord: (value: unknown) => value,
  readIdentityRecordFromLocalStorage: (...args: unknown[]) => readActiveMock(...args),
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: () => true,
}));

vi.mock("@dweb/crypto/decrypt-private-key-hex", () => ({
  decryptPrivateKeyHex: (...args: unknown[]) => decryptMock(...args),
}));

vi.mock("@dweb/crypto/derive-public-key-hex", () => ({
  derivePublicKeyHex: (...args: unknown[]) => deriveMock(...args),
}));

import {
  collectPasswordProtectedIdentityCandidates,
  tryUnlockIdentityWithPassphrase,
} from "./identity-passphrase-unlock";

describe("identity-passphrase-unlock", () => {
  beforeEach(() => {
    harvestMock.mockReset();
    listLocalMock.mockReset();
    decryptMock.mockReset();
    deriveMock.mockReset();
    repairMock.mockReset();
    readActiveMock.mockReset();
    repairMock.mockResolvedValue(undefined);
    readActiveMock.mockReturnValue(undefined);
    listLocalMock.mockReturnValue([]);
    harvestMock.mockResolvedValue({ identities: [], scannedFileCount: 0, ledgers: [], directories: [] });
  });

  it("collects password-protected harvest rows for the account pubkey", async () => {
    harvestMock.mockResolvedValue({
      scannedFileCount: 1,
      ledgers: [],
      directories: [],
      identities: [
        {
          profileSlot: "profile-tester2",
          profileId: "profile-tester2",
          publicKeyHex: PUBLIC_KEY,
          isPasswordless: false,
          sourcePath: "000005.ldb",
          record: {
            encryptedPrivateKey: ENCRYPTED_A,
            publicKeyHex: PUBLIC_KEY,
            username: "Tester2",
          },
        },
        {
          profileSlot: "profile-tester2",
          profileId: "profile-tester2",
          publicKeyHex: PUBLIC_KEY,
          isPasswordless: true,
          sourcePath: "000017.ldb",
          record: {
            encryptedPrivateKey: PASSWORDLESS_NATIVE_ONLY_SENTINEL,
            publicKeyHex: PUBLIC_KEY,
          },
        },
      ],
    });

    const candidates = await collectPasswordProtectedIdentityCandidates({
      profileId: "profile-tester2",
      publicKeyHex: PUBLIC_KEY,
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.encryptedPrivateKey).toBe(ENCRYPTED_A);
  });

  it("unlocks using a harvested candidate when the active row is passwordless", async () => {
    harvestMock.mockResolvedValue({
      scannedFileCount: 1,
      ledgers: [],
      directories: [],
      identities: [
        {
          profileSlot: "profile-tester2",
          profileId: "profile-tester2",
          publicKeyHex: PUBLIC_KEY,
          isPasswordless: false,
          sourcePath: "000005.ldb",
          record: {
            encryptedPrivateKey: ENCRYPTED_B,
            publicKeyHex: PUBLIC_KEY,
            username: "Tester2",
          },
        },
      ],
    });
    decryptMock.mockImplementation(async ({ payload }) => {
      if (payload === ENCRYPTED_B) {
        return PRIVATE_KEY;
      }
      throw new Error("decrypt failed");
    });
    deriveMock.mockReturnValue(PUBLIC_KEY);

    const unlocked = await tryUnlockIdentityWithPassphrase({
      profileId: "profile-tester2",
      publicKeyHex: PUBLIC_KEY,
      passphrase: "old-password" as never,
      activeRecord: {
        encryptedPrivateKey: PASSWORDLESS_NATIVE_ONLY_SENTINEL,
        publicKeyHex: PUBLIC_KEY,
        username: "Tester2",
      },
    });

    expect(unlocked?.record.encryptedPrivateKey).toBe(ENCRYPTED_B);
    expect(unlocked?.privateKeyHex).toBe(PRIVATE_KEY);
  });

  it("materializes password-protected identity before collecting unlock candidates", async () => {
    readActiveMock.mockReturnValue({
      encryptedPrivateKey: PASSWORDLESS_NATIVE_ONLY_SENTINEL,
      publicKeyHex: PUBLIC_KEY,
      username: "Tester1",
    });

    await collectPasswordProtectedIdentityCandidates({
      profileId: "default",
      publicKeyHex: PUBLIC_KEY,
    });

    expect(repairMock).toHaveBeenCalledWith({
      profileId: "default",
      expectedPublicKeyHex: PUBLIC_KEY,
    });
  });
});
