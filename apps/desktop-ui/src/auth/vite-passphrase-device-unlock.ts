import type { Passphrase } from "@dweb/crypto/passphrase";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { decryptPrivateKeyHex } from "@dweb/crypto/decrypt-private-key-hex";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import { encryptPrivateKeyHex } from "@dweb/crypto/encrypt-private-key-hex";
import { generatePrivateKeyHex } from "@dweb/crypto/generate-private-key-hex";
import type { DeviceUnlockHandlers } from "@obscur/auth-engine";

/**
 * Cut 4.4 / 11.1 — Vite passphrase DeviceUnlockHandlers + identity bootstrap.
 * Reads/writes `obscur.identity.record::${profileId}` — same key convention as Next, no pwa import.
 * Does NOT invent PDK / open_database / storage-at-rest unlock (Cut 3 fence).
 */

export const VITE_IDENTITY_RECORD_STORAGE_BASE_KEY = "obscur.identity.record";

export type ViteIdentityRecord = Readonly<{
  encryptedPrivateKey: string;
  publicKeyHex: string;
  username?: string;
}>;

export const getViteIdentityRecordStorageKey = (profileId: string): string => (
  `${VITE_IDENTITY_RECORD_STORAGE_BASE_KEY}::${profileId}`
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null
);

export const parseViteIdentityRecord = (value: unknown): ViteIdentityRecord | null => {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.encryptedPrivateKey !== "string" || typeof value.publicKeyHex !== "string") {
    return null;
  }
  return {
    encryptedPrivateKey: value.encryptedPrivateKey,
    publicKeyHex: value.publicKeyHex,
    username: typeof value.username === "string" ? value.username : undefined,
  };
};

export const readViteIdentityRecord = (profileId: string): ViteIdentityRecord | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const keys = [
    getViteIdentityRecordStorageKey(profileId),
    `identity::${profileId}`,
  ];
  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      continue;
    }
    try {
      const parsed = parseViteIdentityRecord(JSON.parse(raw));
      if (parsed) {
        return parsed;
      }
    } catch {
      // continue
    }
  }
  return null;
};

export const writeViteIdentityRecord = (
  profileId: string,
  record: ViteIdentityRecord,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    getViteIdentityRecordStorageKey(profileId),
    JSON.stringify(record),
  );
};

/**
 * Cut 11.1 — create passphrase-protected identity for empty Vite device.
 * Plane 1–2 only — ≠ Continuity Pass.
 */
export const createVitePassphraseIdentity = async (params: Readonly<{
  profileId: string;
  passphrase: Passphrase;
  username?: string;
}>): Promise<ViteIdentityRecord> => {
  const passphrase = params.passphrase.trim();
  if (passphrase.length < 8) {
    throw new Error("Passphrase must be at least 8 characters");
  }
  const privateKeyHex = generatePrivateKeyHex();
  const publicKeyHex = derivePublicKeyHex(privateKeyHex);
  const encryptedPrivateKey = await encryptPrivateKeyHex({
    privateKeyHex,
    passphrase: passphrase as Passphrase,
  });
  const record: ViteIdentityRecord = {
    encryptedPrivateKey,
    publicKeyHex,
    username: params.username?.trim() || undefined,
  };
  writeViteIdentityRecord(params.profileId, record);
  return record;
};

export type CreateVitePassphraseDeviceUnlockHandlersParams = Readonly<{
  readIdentityRecord?: (profileId: string) => ViteIdentityRecord | null;
}>;

export const createVitePassphraseDeviceUnlockHandlers = (
  params: CreateVitePassphraseDeviceUnlockHandlersParams = {},
): DeviceUnlockHandlers => {
  const readIdentity = params.readIdentityRecord ?? readViteIdentityRecord;

  return {
    unlockWithPassphrase: async (request) => {
      const record = readIdentity(request.profileId);
      if (!record) {
        throw new Error("No device password unlock material for profile");
      }
      if (record.publicKeyHex.toLowerCase() !== request.expectedPublicKeyHex.toLowerCase()) {
        throw new Error("Identity does not match stored identity");
      }
      try {
        const privateKeyHex = await decryptPrivateKeyHex({
          payload: record.encryptedPrivateKey,
          passphrase: request.passphrase,
        });
        const derived = derivePublicKeyHex(privateKeyHex);
        if (derived.toLowerCase() !== request.expectedPublicKeyHex.toLowerCase()) {
          throw new Error("Incorrect password");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/incorrect|password|passphrase|authenticate|decrypt/i.test(message)) {
          throw new Error("Incorrect password");
        }
        throw error;
      }
      return {
        profileId: request.profileId,
        publicKeyHex: request.expectedPublicKeyHex as PublicKeyHex,
        staySignedInApplied: request.staySignedIn !== false,
      };
    },
    unlockWithPrivateKey: async () => {
      throw new Error("Unsupported: Vite native door is passphrase unlock only");
    },
    revokeDeviceUnlockMaterial: async () => undefined,
  };
};
