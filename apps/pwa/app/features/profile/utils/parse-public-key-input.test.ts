import { describe, expect, it } from "vitest";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { parsePublicKeyInput } from "./parse-public-key-input";

describe("parsePublicKeyInput", () => {
  it("accepts hex pubkeys from a known keypair", () => {
    const privateKeyHex = "095648f20fc8f90d4a0e8c0f7737fd6e18a5d57e1af2c8100caa6954484c367d" as PrivateKeyHex;
    const publicKeyHex = derivePublicKeyHex(privateKeyHex);
    const result = parsePublicKeyInput(publicKeyHex);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.publicKeyHex).toBe(publicKeyHex);
      expect(result.format).toBe("hex");
    }
  });

  it("does not reject private key hex at parse time (resolved async in identity-resolver)", () => {
    const privateKeyHex = "095648f20fc8f90d4a0e8c0f7737fd6e18a5d57e1af2c8100caa6954484c367d";
    const result = parsePublicKeyInput(privateKeyHex);
    expect(result.ok).toBe(true);
  });

  it("rejects nsec bech32 secrets", () => {
    const result = parsePublicKeyInput(
      "nsec1p578aq7jtr2ggep0s9kch0c60uvwd0kewa8v6w0gzuxy4dgt9paj0qut0mth",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("private_key_forbidden");
    }
  });
});
