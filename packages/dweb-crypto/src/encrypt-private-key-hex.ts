import type { EncryptedString } from "./encrypted-string";
import type { Passphrase } from "./passphrase";
import type { PrivateKeyHex } from "./private-key-hex";
import { IDENTITY_ARGON2ID_ALG } from "./argon2id-kdf";
import { defaultIdentityEnvelopeWriteKdf } from "./identity-envelope-kdf";
import { deriveIdentityEnvelopeAesGcmKey } from "./identity-envelope-kdf";
import { toBase64 } from "./to-base64";
import { toArrayBuffer } from "./to-array-buffer";

type EncryptPrivateKeyHexParams = Readonly<{
  privateKeyHex: PrivateKeyHex;
  passphrase: Passphrase;
}>;

const SALT_BYTES = 16;
const IV_BYTES = 12;

const textEncoder = new TextEncoder();

const createRandomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};

export const encryptPrivateKeyHex = async (params: EncryptPrivateKeyHexParams): Promise<EncryptedString> => {
  const salt = createRandomBytes(SALT_BYTES);
  const iv = createRandomBytes(IV_BYTES);
  const kdf = defaultIdentityEnvelopeWriteKdf();
  const key = await deriveIdentityEnvelopeAesGcmKey({
    passphrase: params.passphrase,
    salt,
    kdf,
  });
  const plaintext = textEncoder.encode(params.privateKeyHex);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
    },
    key,
    toArrayBuffer(plaintext),
  );
  const ciphertext = new Uint8Array(ciphertextBuffer);
  const payload = {
    v: 2 as const,
    alg: IDENTITY_ARGON2ID_ALG,
    m: kdf.kdf.m,
    t: kdf.kdf.t,
    p: kdf.kdf.p,
    saltB64: toBase64(salt),
    ivB64: toBase64(iv),
    ciphertextB64: toBase64(ciphertext),
  };
  return JSON.stringify(payload);
};
