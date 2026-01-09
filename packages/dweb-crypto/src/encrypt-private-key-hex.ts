import type { EncryptedString } from "./encrypted-string";
import type { Passphrase } from "./passphrase";
import type { PrivateKeyHex } from "./private-key-hex";
import { deriveAesGcmKey } from "./derive-aes-gcm-key";
import { toBase64 } from "./to-base64";
import { toArrayBuffer } from "./to-array-buffer";

type EncryptPrivateKeyHexParams = Readonly<{
  privateKeyHex: PrivateKeyHex;
  passphrase: Passphrase;
}>;

type EncryptedPayload = Readonly<{
  v: 1;
  alg: "PBKDF2-SHA256/AES-256-GCM";
  iterations: number;
  saltB64: string;
  ivB64: string;
  ciphertextB64: string;
}>;

const PBKDF2_ITERATIONS: number = 200_000;
const SALT_BYTES: number = 16;
const IV_BYTES: number = 12;

const textEncoder: TextEncoder = new TextEncoder();

const createRandomBytes = (length: number): Uint8Array => {
  const bytes: Uint8Array = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};

export const encryptPrivateKeyHex = async (params: EncryptPrivateKeyHexParams): Promise<EncryptedString> => {
  const salt: Uint8Array = createRandomBytes(SALT_BYTES);
  const iv: Uint8Array = createRandomBytes(IV_BYTES);
  const key: CryptoKey = await deriveAesGcmKey({
    passphrase: params.passphrase,
    salt,
    iterations: PBKDF2_ITERATIONS
  });
  const plaintext: Uint8Array = textEncoder.encode(params.privateKeyHex);
  const ciphertextBuffer: ArrayBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv)
    },
    key,
    toArrayBuffer(plaintext)
  );
  const ciphertext: Uint8Array = new Uint8Array(ciphertextBuffer);
  const payload: EncryptedPayload = {
    v: 1,
    alg: "PBKDF2-SHA256/AES-256-GCM",
    iterations: PBKDF2_ITERATIONS,
    saltB64: toBase64(salt),
    ivB64: toBase64(iv),
    ciphertextB64: toBase64(ciphertext)
  };
  return JSON.stringify(payload);
};
