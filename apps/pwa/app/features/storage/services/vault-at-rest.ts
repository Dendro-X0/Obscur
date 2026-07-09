import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { getProfileStorageKeyMaterial } from "@/app/features/storage/services/profile-storage-key-session";
import {
  decryptStorageEnvelopeV1,
  encryptStorageEnvelopeV1,
  isStorageEnvelopeV1Payload,
  parseStorageEnvelopeV1,
  serializeStorageEnvelopeV1,
  sha256Hex,
} from "@/app/features/storage/services/storage-envelope-v1";

export const VAULT_ENCRYPTED_FILE_EXTENSION = ".obscurvault" as const;

export class VaultWriteEncryptionRequiredError extends Error {
  readonly code = "VAULT_WRITE_ENCRYPTION_REQUIRED" as const;

  constructor() {
    super("Unlock this profile to save encrypted vault files.");
    this.name = "VaultWriteEncryptionRequiredError";
  }
}

export const isVaultWriteEncryptionReady = (profileId?: string): boolean => {
  const resolvedProfileId = (profileId ?? getResolvedProfileId()).trim() || "default";
  return Boolean(getProfileStorageKeyMaterial(resolvedProfileId));
};

export const buildOpaqueVaultFileName = async (remoteUrl: string, profileId?: string): Promise<string> => {
  const resolvedProfileId = (profileId ?? getResolvedProfileId()).trim() || "default";
  const digest = await sha256Hex(`${resolvedProfileId}|${remoteUrl.trim()}`);
  return `${digest.slice(0, 24)}${VAULT_ENCRYPTED_FILE_EXTENSION}`;
};

/** @deprecated Prefer {@link encryptVaultBytesForWrite} for vault writes — no plaintext fallback. */
export const encryptVaultBytesIfAvailable = async (params: Readonly<{
  plaintext: Uint8Array;
  profileId?: string;
}>): Promise<Readonly<{ bytes: Uint8Array; encrypted: boolean; fileNameSuffix: string }>> => {
  try {
    const encrypted = await encryptVaultBytesForWrite(params);
    return encrypted;
  } catch (error) {
    if (error instanceof VaultWriteEncryptionRequiredError) {
      return { bytes: params.plaintext, encrypted: false, fileNameSuffix: "" };
    }
    throw error;
  }
};

export const encryptVaultBytesForWrite = async (params: Readonly<{
  plaintext: Uint8Array;
  profileId?: string;
}>): Promise<Readonly<{ bytes: Uint8Array; encrypted: true; fileNameSuffix: string }>> => {
  const profileId = (params.profileId ?? getResolvedProfileId()).trim() || "default";
  const keyMaterial = getProfileStorageKeyMaterial(profileId);
  if (!keyMaterial) {
    throw new VaultWriteEncryptionRequiredError();
  }
  const envelope = await encryptStorageEnvelopeV1({
    plaintext: params.plaintext,
    keyMaterial,
    purpose: "vault-media",
    profileId,
  });
  return {
    bytes: new TextEncoder().encode(serializeStorageEnvelopeV1(envelope)),
    encrypted: true,
    fileNameSuffix: VAULT_ENCRYPTED_FILE_EXTENSION,
  };
};

export const decryptVaultFileBytesIfNeeded = async (params: Readonly<{
  fileBytes: Uint8Array;
  profileId?: string;
}>): Promise<Uint8Array> => {
  const raw = new TextDecoder().decode(params.fileBytes);
  if (!isStorageEnvelopeV1Payload(raw)) {
    return params.fileBytes;
  }
  const envelope = parseStorageEnvelopeV1(raw);
  if (!envelope) {
    return params.fileBytes;
  }
  const profileId = (params.profileId ?? getResolvedProfileId()).trim();
  const keyMaterial = getProfileStorageKeyMaterial(profileId);
  if (!keyMaterial) {
    throw new Error("Vault media is encrypted. Unlock this profile to view it.");
  }
  return decryptStorageEnvelopeV1({ envelope, keyMaterial });
};

export const isEncryptedVaultRelativePath = (relativePath: string): boolean =>
  relativePath.toLowerCase().endsWith(VAULT_ENCRYPTED_FILE_EXTENSION);
