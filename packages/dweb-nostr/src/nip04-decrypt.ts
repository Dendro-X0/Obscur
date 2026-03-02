import { getSharedSecret } from "@noble/secp256k1";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { toArrayBuffer } from "@dweb/crypto/to-array-buffer";
import { fromBase64 } from "@dweb/crypto/from-base64";

type Nip04DecryptParams = Readonly<{
  recipientPrivateKeyHex: PrivateKeyHex;
  senderPublicKeyHex: PublicKeyHex;
  payload: string;
}>;



const parsePayload = (payload: string): Readonly<{ ciphertext: Uint8Array; iv: Uint8Array }> => {
  const parts: ReadonlyArray<string> = payload.split("?iv=");
  if (parts.length !== 2) {
    throw new Error("Invalid NIP-04 payload");
  }
  const ciphertextBase64: string | undefined = parts[0];
  const ivBase64: string | undefined = parts[1];
  if (!ciphertextBase64 || !ivBase64) {
    throw new Error("Invalid NIP-04 payload");
  }
  const ciphertext: Uint8Array = fromBase64(ciphertextBase64);
  const iv: Uint8Array = fromBase64(ivBase64);
  if (iv.length !== 16) {
    throw new Error("Invalid IV");
  }
  return { ciphertext, iv };
};

const deriveNip04KeyBytes = async (params: Readonly<{ recipientPrivateKeyHex: PrivateKeyHex; senderPublicKeyHex: PublicKeyHex }>): Promise<Uint8Array> => {
  const senderCompressedHex: string = `02${params.senderPublicKeyHex}`;
  const secret: Uint8Array = getSharedSecret(params.recipientPrivateKeyHex, senderCompressedHex);
  // NIP-04 shared secret is the X coordinate of the shared point (32 bytes).
  // With noble-secp256k1, the first byte is the prefix (02/03/04), so we take the next 32 bytes.
  return secret.slice(1, 33);
};

export const nip04Decrypt = async (params: Nip04DecryptParams): Promise<string> => {
  const parsed: Readonly<{ ciphertext: Uint8Array; iv: Uint8Array }> = parsePayload(params.payload);
  const keyBytes: Uint8Array = await deriveNip04KeyBytes({ recipientPrivateKeyHex: params.recipientPrivateKeyHex, senderPublicKeyHex: params.senderPublicKeyHex });
  const key: CryptoKey = await crypto.subtle.importKey("raw", toArrayBuffer(keyBytes), { name: "AES-CBC" }, false, ["decrypt"]);

  try {
    const plaintextBuffer: ArrayBuffer = await crypto.subtle.decrypt({ name: "AES-CBC", iv: toArrayBuffer(parsed.iv) }, key, toArrayBuffer(parsed.ciphertext));
    return new TextDecoder().decode(new Uint8Array(plaintextBuffer));
  } catch (error) {
    console.error("[nip04Decrypt] AES-CBC Decryption failed:", error);
    console.debug("[nip04Decrypt] Sender Pubkey:", params.senderPublicKeyHex);
    console.debug("[nip04Decrypt] Ciphertext Length:", parsed.ciphertext.length);
    console.debug("[nip04Decrypt] IV Length:", parsed.iv.length);
    throw error;
  }
};
