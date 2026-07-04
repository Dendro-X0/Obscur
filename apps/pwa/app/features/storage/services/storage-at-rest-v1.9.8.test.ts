/** @vitest-environment node */
import { webcrypto } from "node:crypto";
Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

import { describe, expect, it } from "vitest";
import {
  deriveProfileDataKeyMaterial,
  deriveProfileDataKeySalt,
  PROFILE_DATA_KEY_ITERATIONS,
  profileDataKeyMaterialToBase64,
} from "./profile-data-key";
import {
  decryptStorageEnvelopeV1,
  encryptStorageEnvelopeV1,
  parseStorageEnvelopeV1,
  serializeStorageEnvelopeV1,
  STORAGE_ENVELOPE_SUITE,
} from "./storage-envelope-v1";

describe("profile-data-key v1.9.8 vectors", () => {
  it("uses deterministic profile-scoped salt", async () => {
    const salt = await deriveProfileDataKeySalt("default");
    expect(Array.from(salt)).toEqual([
      0x44, 0x61, 0x74, 0xed, 0xe0, 0xae, 0xfb, 0xba,
      0x43, 0xf7, 0xdc, 0x78, 0xb9, 0x95, 0xaf, 0x83,
    ]);
  });

  it("derives stable PDK material for fixture passphrase", async () => {
    const keyMaterial = await deriveProfileDataKeyMaterial({
      passphrase: "Obscur-Phase3-Test-Vector!",
      profileId: "default",
    });
    expect(keyMaterial.byteLength).toBe(32);
    expect(profileDataKeyMaterialToBase64(keyMaterial)).toBe("lnGC7LuCyiiM3KdFYsC5vXnZfGI9bCDbcfcy4MqXWdY=");
    expect(PROFILE_DATA_KEY_ITERATIONS).toBe(200_000);
  });
});

describe("storage-envelope-v1", () => {
  it("roundtrips vault payload with PDK", async () => {
    const keyMaterial = await deriveProfileDataKeyMaterial({
      passphrase: "Obscur-Phase3-Test-Vector!",
      profileId: "default",
    });
    const plaintext = new TextEncoder().encode("vault-bytes-not-plaintext");
    const envelope = await encryptStorageEnvelopeV1({
      plaintext,
      keyMaterial,
      purpose: "vault-media",
      profileId: "default",
    });
    expect(envelope.suite).toBe(STORAGE_ENVELOPE_SUITE);
    const restored = await decryptStorageEnvelopeV1({ envelope, keyMaterial });
    expect(new TextDecoder().decode(restored)).toBe("vault-bytes-not-plaintext");
    const parsed = parseStorageEnvelopeV1(serializeStorageEnvelopeV1(envelope));
    expect(parsed?.purpose).toBe("vault-media");
  });
});
