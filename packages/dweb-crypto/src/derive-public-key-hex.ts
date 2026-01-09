import { getPublicKey } from "@noble/secp256k1";
import type { PrivateKeyHex } from "./private-key-hex";
import type { PublicKeyHex } from "./public-key-hex";

const toHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("");
};

const fromHex = (hex: string): Uint8Array => {
  const normalized: string = hex.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error("Invalid private key hex");
  }
  const bytes: Uint8Array = new Uint8Array(32);
  for (let i: number = 0; i < 32; i += 1) {
    bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

export const derivePublicKeyHex = (privateKeyHex: PrivateKeyHex): PublicKeyHex => {
  const privateKeyBytes: Uint8Array = fromHex(privateKeyHex);
  const compressed: Uint8Array = getPublicKey(privateKeyBytes, true);
  const xOnly: Uint8Array = compressed.slice(1);
  return toHex(xOnly);
};
