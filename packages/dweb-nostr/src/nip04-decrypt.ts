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

const sha256 = async (bytes: Uint8Array): Promise<Uint8Array> => {
  const digest: ArrayBuffer = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
  return new Uint8Array(digest);
};

const pkcs7Unpad = (payload: Uint8Array): Uint8Array => {
  if (payload.length === 0) {
    throw new Error("Invalid ciphertext");
  }
  const lastByte: number | undefined = payload.at(-1);
  if (lastByte === undefined) {
    throw new Error("Invalid ciphertext");
  }
  const padLen: number = lastByte;
  if (padLen <= 0 || padLen > 16) {
    throw new Error("Invalid padding");
  }
  for (let i: number = payload.length - padLen; i < payload.length; i += 1) {
    if (payload[i] !== padLen) {
      throw new Error("Invalid padding");
    }
  }
  return payload.slice(0, payload.length - padLen);
};

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
  const secret: Uint8Array = getSharedSecret(params.recipientPrivateKeyHex, senderCompressedHex, true);
  const secretX: Uint8Array = secret.slice(1);
  return sha256(secretX);
};

export const nip04Decrypt = async (params: Nip04DecryptParams): Promise<string> => {
  const parsed: Readonly<{ ciphertext: Uint8Array; iv: Uint8Array }> = parsePayload(params.payload);
  const keyBytes: Uint8Array = await deriveNip04KeyBytes({ recipientPrivateKeyHex: params.recipientPrivateKeyHex, senderPublicKeyHex: params.senderPublicKeyHex });
  const key: CryptoKey = await crypto.subtle.importKey("raw", toArrayBuffer(keyBytes), { name: "AES-CBC" }, false, ["decrypt"]);
  const paddedBuffer: ArrayBuffer = await crypto.subtle.decrypt({ name: "AES-CBC", iv: toArrayBuffer(parsed.iv) }, key, toArrayBuffer(parsed.ciphertext));
  const paddedBytes: Uint8Array = new Uint8Array(paddedBuffer);
  const plaintextBytes: Uint8Array = pkcs7Unpad(paddedBytes);
  return new TextDecoder().decode(plaintextBytes);
};
