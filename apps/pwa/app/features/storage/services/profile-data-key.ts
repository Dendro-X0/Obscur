import type { Passphrase } from "@dweb/crypto/passphrase";
import { toArrayBuffer } from "@dweb/crypto/to-array-buffer";
import { toBase64 } from "@dweb/crypto/to-base64";
import {
  DEFAULT_ARGON2ID_KDF_PARAMS,
  deriveArgon2idKeyMaterial,
} from "@dweb/crypto/argon2id-kdf";

export const PROFILE_DATA_KEY_CONTEXT_V1 = "obscur.pdk.v1" as const;
export const PROFILE_DATA_KEY_CONTEXT_V2 = "obscur.pdk.v2" as const;
/** @deprecated Use explicit v1/v2 derivations. */
export const PROFILE_DATA_KEY_CONTEXT = PROFILE_DATA_KEY_CONTEXT_V1;
export const PROFILE_DATA_KEY_ITERATIONS = 200_000 as const;
export const PROFILE_DATA_KEY_BYTES = 32 as const;

const textEncoder = new TextEncoder();

const importPassphraseKey = async (passphrase: Passphrase): Promise<CryptoKey> => {
  const passphraseBytes = textEncoder.encode(passphrase);
  return crypto.subtle.importKey("raw", toArrayBuffer(passphraseBytes), "PBKDF2", false, ["deriveKey"]);
};

export const deriveProfileDataKeySalt = async (
  profileId: string,
  context: string = PROFILE_DATA_KEY_CONTEXT_V2,
): Promise<Uint8Array> => {
  const normalizedProfileId = profileId.trim();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(`${context}|${normalizedProfileId}`),
  );
  return new Uint8Array(digest).slice(0, 16);
};

export const deriveProfileDataKeyMaterialV1 = async (params: Readonly<{
  passphrase: Passphrase;
  profileId: string;
}>): Promise<Uint8Array> => {
  const salt = await deriveProfileDataKeySalt(params.profileId, PROFILE_DATA_KEY_CONTEXT_V1);
  const baseKey = await importPassphraseKey(params.passphrase);
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: PROFILE_DATA_KEY_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const raw = await crypto.subtle.exportKey("raw", derivedKey);
  return new Uint8Array(raw);
};

export const deriveProfileDataKeyMaterialV2 = async (params: Readonly<{
  passphrase: Passphrase;
  profileId: string;
}>): Promise<Uint8Array> => {
  const salt = await deriveProfileDataKeySalt(params.profileId, PROFILE_DATA_KEY_CONTEXT_V2);
  return deriveArgon2idKeyMaterial({
    passphrase: params.passphrase,
    salt,
    kdf: DEFAULT_ARGON2ID_KDF_PARAMS,
  });
};

/** New writes and unlock sessions use Argon2id v2. */
export const deriveProfileDataKeyMaterial = async (params: Readonly<{
  passphrase: Passphrase;
  profileId: string;
}>): Promise<Uint8Array> => deriveProfileDataKeyMaterialV2(params);

export const deriveProfileDataKeyReadCandidates = async (params: Readonly<{
  passphrase: Passphrase;
  profileId: string;
}>): Promise<ReadonlyArray<Uint8Array>> => {
  const v2 = await deriveProfileDataKeyMaterialV2(params);
  const v1 = await deriveProfileDataKeyMaterialV1(params);
  return [v2, v1];
};

export const importProfileDataKey = async (keyMaterial: Uint8Array): Promise<CryptoKey> => (
  crypto.subtle.importKey(
    "raw",
    toArrayBuffer(keyMaterial),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
);

export const profileDataKeyMaterialToBase64 = (keyMaterial: Uint8Array): string => toBase64(keyMaterial);
