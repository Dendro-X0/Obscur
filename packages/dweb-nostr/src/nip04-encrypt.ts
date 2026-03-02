import { getSharedSecret } from "@noble/secp256k1";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { toArrayBuffer } from "@dweb/crypto/to-array-buffer";
import { toBase64 } from "@dweb/crypto/to-base64";

type Nip04EncryptParams = Readonly<{
  senderPrivateKeyHex: PrivateKeyHex;
  recipientPublicKeyHex: PublicKeyHex;
  plaintext: string;
}>;



const deriveNip04KeyBytes = async (params: Readonly<{ senderPrivateKeyHex: PrivateKeyHex; recipientPublicKeyHex: PublicKeyHex }>): Promise<Uint8Array> => {
  const recipientCompressedHex: string = `02${params.recipientPublicKeyHex}`;
  const secret: Uint8Array = getSharedSecret(params.senderPrivateKeyHex, recipientCompressedHex);
  // NIP-04 shared secret is the X coordinate of the shared point (32 bytes).
  // With noble-secp256k1, the first byte is the prefix (02/03/04), so we take the next 32 bytes.
  return secret.slice(1, 33);
};

export const nip04Encrypt = async (params: Nip04EncryptParams): Promise<string> => {
  const iv: Uint8Array = new Uint8Array(16);
  crypto.getRandomValues(iv);
  const keyBytes: Uint8Array = await deriveNip04KeyBytes({ senderPrivateKeyHex: params.senderPrivateKeyHex, recipientPublicKeyHex: params.recipientPublicKeyHex });
  const key: CryptoKey = await crypto.subtle.importKey("raw", toArrayBuffer(keyBytes), { name: "AES-CBC" }, false, ["encrypt"]);
  const plaintextBytes: Uint8Array = new TextEncoder().encode(params.plaintext);
  const ciphertextBuffer: ArrayBuffer = await crypto.subtle.encrypt({ name: "AES-CBC", iv: toArrayBuffer(iv) }, key, toArrayBuffer(plaintextBytes));
  const ciphertextBytes: Uint8Array = new Uint8Array(ciphertextBuffer);
  const ciphertextB64: string = toBase64(ciphertextBytes);
  const ivB64: string = toBase64(iv);
  return `${ciphertextB64}?iv=${ivB64}`;
};
