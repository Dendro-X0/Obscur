import type { EncryptedString } from "./encrypted-string";
import type { Passphrase } from "./passphrase";
import type { PrivateKeyHex } from "./private-key-hex";
import { deriveAesGcmKey } from "./derive-aes-gcm-key";
import { fromBase64 } from "./from-base64";
import { toArrayBuffer } from "./to-array-buffer";

type EncryptedPayload = Readonly<{
  v: number;
  alg: string;
  iterations: number;
  saltB64: string;
  ivB64: string;
  ciphertextB64: string;
}>;

const textDecoder: TextDecoder = new TextDecoder();

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const parsePayload = (value: EncryptedString): EncryptedPayload => {
  const parsed: unknown = JSON.parse(value);
  if (!isRecord(parsed)) {
    throw new Error("Invalid encrypted payload");
  }
  const iterations: unknown = parsed.iterations;
  const saltB64: unknown = parsed.saltB64;
  const ivB64: unknown = parsed.ivB64;
  const ciphertextB64: unknown = parsed.ciphertextB64;
  if (typeof iterations !== "number") {
    throw new Error("Invalid encrypted payload iterations");
  }
  if (typeof saltB64 !== "string" || typeof ivB64 !== "string" || typeof ciphertextB64 !== "string") {
    throw new Error("Invalid encrypted payload encoding");
  }
  return {
    v: typeof parsed.v === "number" ? parsed.v : 0,
    alg: typeof parsed.alg === "string" ? parsed.alg : "",
    iterations,
    saltB64,
    ivB64,
    ciphertextB64
  };
};

export const decryptPrivateKeyHex = async (params: Readonly<{ payload: EncryptedString; passphrase: Passphrase }>): Promise<PrivateKeyHex> => {
  const payload: EncryptedPayload = parsePayload(params.payload);
  const salt: Uint8Array = fromBase64(payload.saltB64);
  const iv: Uint8Array = fromBase64(payload.ivB64);
  const ciphertext: Uint8Array = fromBase64(payload.ciphertextB64);
  const key: CryptoKey = await deriveAesGcmKey({
    passphrase: params.passphrase,
    salt,
    iterations: payload.iterations
  });
  const plaintextBuffer: ArrayBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv)
    },
    key,
    toArrayBuffer(ciphertext)
  );
  const plaintext: string = textDecoder.decode(new Uint8Array(plaintextBuffer));
  return plaintext;
};
