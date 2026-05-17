import type { Passphrase } from "./passphrase";
import { toArrayBuffer } from "./to-array-buffer";

type DeriveAesGcmKeyParams = Readonly<{
  passphrase: Passphrase;
  salt: Uint8Array;
  iterations: number;
}>;

const textEncoder: TextEncoder = new TextEncoder();

const importPassphraseKey = async (passphrase: Passphrase): Promise<CryptoKey> => {
  const passphraseBytes: Uint8Array = textEncoder.encode(passphrase);
  return crypto.subtle.importKey("raw", toArrayBuffer(passphraseBytes), "PBKDF2", false, ["deriveKey"]);
};

export const deriveAesGcmKey = async (params: DeriveAesGcmKeyParams): Promise<CryptoKey> => {
  const baseKey: CryptoKey = await importPassphraseKey(params.passphrase);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(params.salt),
      iterations: params.iterations,
      hash: "SHA-256"
    },
    baseKey,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
};
