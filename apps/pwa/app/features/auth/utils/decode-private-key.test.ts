import { describe, expect, it } from "vitest";
import { nip19 } from "nostr-tools";
import { decodePrivateKey } from "./decode-private-key";

const hexToBytes = (value: string): Uint8Array => {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

describe("decodePrivateKey", () => {
  it("decodes valid hex private keys", () => {
    const keyHex = "a".repeat(64);
    expect(decodePrivateKey(keyHex)).toBe(keyHex);
  });

  it("decodes valid nsec private keys", () => {
    const keyHex = "b".repeat(64);
    const nsec = nip19.nsecEncode(hexToBytes(keyHex));
    expect(decodePrivateKey(nsec)).toBe(keyHex);
  });

  it("returns null for invalid nsec checksum input", () => {
    const invalidNsec = "nsec1gkv6kg9gyfvrg7h7q60usvaqtjq096dxevaw4vpk9y6krrlcglpqat96t";
    expect(decodePrivateKey(invalidNsec)).toBeNull();
  });
});

