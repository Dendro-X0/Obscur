import {
  DEFAULT_ARGON2ID_KDF_PARAMS,
  deriveArgon2idAesGcmKey,
  IDENTITY_ARGON2ID_ALG,
  IDENTITY_PBKDF2_ALG,
  type Argon2idKdfParams,
} from "./argon2id-kdf";
import { deriveAesGcmKey } from "./derive-aes-gcm-key";
import type { Passphrase } from "./passphrase";

export type IdentityEnvelopeKdf =
  | Readonly<{
      alg: typeof IDENTITY_PBKDF2_ALG;
      iterations: number;
    }>
  | Readonly<{
      alg: typeof IDENTITY_ARGON2ID_ALG;
      kdf: Argon2idKdfParams;
    }>;

export type IdentityEnvelopeWriteKdf = Readonly<{
  alg: typeof IDENTITY_ARGON2ID_ALG;
  kdf: Argon2idKdfParams;
}>;

export const deriveIdentityEnvelopeAesGcmKey = async (params: Readonly<{
  passphrase: Passphrase;
  salt: Uint8Array;
  kdf: IdentityEnvelopeKdf;
}>): Promise<CryptoKey> => {
  if (params.kdf.alg === IDENTITY_ARGON2ID_ALG) {
    return deriveArgon2idAesGcmKey({
      passphrase: params.passphrase,
      salt: params.salt,
      kdf: params.kdf.kdf,
    });
  }
  return deriveAesGcmKey({
    passphrase: params.passphrase,
    salt: params.salt,
    iterations: params.kdf.iterations,
  });
};

export const defaultIdentityEnvelopeWriteKdf = (): IdentityEnvelopeWriteKdf => ({
  alg: IDENTITY_ARGON2ID_ALG,
  kdf: DEFAULT_ARGON2ID_KDF_PARAMS,
});

export const isLegacyPbkdf2IdentityEnvelope = (alg: string): boolean => (
  alg === IDENTITY_PBKDF2_ALG
);
