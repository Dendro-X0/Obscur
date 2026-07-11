import { utils } from "@noble/secp256k1";

const HEX_PRIVATE_KEY_LENGTH = 64;

const hexToBytes = (hex: string): Uint8Array => {
  const normalized = hex.trim().toLowerCase();
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) {
    bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

/** True when `hex` is a valid secp256k1 private scalar (same length as nostr pubkeys). */
export const isValidPrivateKeyHex = (hex: string): boolean => {
  const normalized = hex.trim().toLowerCase();
  if (normalized.length !== HEX_PRIVATE_KEY_LENGTH || !/^[0-9a-f]{64}$/.test(normalized)) {
    return false;
  }
  return utils.isValidPrivateKey(hexToBytes(normalized));
};
