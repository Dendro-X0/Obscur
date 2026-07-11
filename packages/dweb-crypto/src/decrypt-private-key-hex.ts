import type { EncryptedString } from "./encrypted-string";
import type { Passphrase } from "./passphrase";
import type { PrivateKeyHex } from "./private-key-hex";
import { deriveIdentityEnvelopeAesGcmKey } from "./identity-envelope-kdf";
import { fromBase64 } from "./from-base64";
import { parseIdentityEnvelope } from "./parse-identity-envelope";
import { toArrayBuffer } from "./to-array-buffer";

const textDecoder = new TextDecoder();

export const decryptPrivateKeyHex = async (params: Readonly<{
  payload: EncryptedString;
  passphrase: Passphrase;
}>): Promise<PrivateKeyHex> => {
  const envelope = parseIdentityEnvelope(params.payload);
  const salt = fromBase64(envelope.saltB64);
  const iv = fromBase64(envelope.ivB64);
  const ciphertext = fromBase64(envelope.ciphertextB64);
  const key = await deriveIdentityEnvelopeAesGcmKey({
    passphrase: params.passphrase,
    salt,
    kdf: envelope.kdf,
  });
  const plaintextBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
    },
    key,
    toArrayBuffer(ciphertext),
  );
  return textDecoder.decode(new Uint8Array(plaintextBuffer));
};
