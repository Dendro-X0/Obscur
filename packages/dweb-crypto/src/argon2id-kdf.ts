import { argon2id } from "@noble/hashes/argon2.js";
import type { Passphrase } from "./passphrase";
import { toArrayBuffer } from "./to-array-buffer";

export const IDENTITY_ARGON2ID_ALG = "Argon2id/AES-256-GCM" as const;
export const IDENTITY_PBKDF2_ALG = "PBKDF2-SHA256/AES-256-GCM" as const;

export type Argon2idKdfParams = Readonly<{
  m: number;
  t: number;
  p: number;
}>;

/** Default: 64 MiB, 3 passes, 4 lanes (KEY-MOAT-1 Phase 2). */
export const DEFAULT_ARGON2ID_KDF_PARAMS: Argon2idKdfParams = {
  m: 65_536,
  t: 3,
  p: 4,
};

/** Optional high-security profile flag at create time. */
export const HIGH_SECURITY_ARGON2ID_KDF_PARAMS: Argon2idKdfParams = {
  m: 131_072,
  t: 4,
  p: 4,
};

const ARGON2_DK_LEN = 32;
const ARGON2_MAX_MEM = 2 ** 32 - 1;

const textEncoder = new TextEncoder();

export const deriveArgon2idKeyMaterial = (params: Readonly<{
  passphrase: Passphrase;
  salt: Uint8Array;
  kdf: Argon2idKdfParams;
}>): Uint8Array => (
  argon2id(textEncoder.encode(params.passphrase), params.salt, {
    m: params.kdf.m,
    t: params.kdf.t,
    p: params.kdf.p,
    dkLen: ARGON2_DK_LEN,
    maxmem: ARGON2_MAX_MEM,
  })
);

export const importAesGcmKeyFromRaw = async (keyMaterial: Uint8Array): Promise<CryptoKey> => (
  crypto.subtle.importKey(
    "raw",
    toArrayBuffer(keyMaterial),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
);

export const deriveArgon2idAesGcmKey = async (params: Readonly<{
  passphrase: Passphrase;
  salt: Uint8Array;
  kdf?: Argon2idKdfParams;
}>): Promise<CryptoKey> => {
  const raw = deriveArgon2idKeyMaterial({
    passphrase: params.passphrase,
    salt: params.salt,
    kdf: params.kdf ?? DEFAULT_ARGON2ID_KDF_PARAMS,
  });
  return importAesGcmKeyFromRaw(raw);
};
