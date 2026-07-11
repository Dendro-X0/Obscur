/** @vitest-environment node */
import { webcrypto } from "node:crypto";
Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

import { describe, expect, it } from "vitest";
import { decryptPrivateKeyHex } from "@dweb/crypto/decrypt-private-key-hex";
import { encryptPrivateKeyHex } from "@dweb/crypto/encrypt-private-key-hex";
import { IDENTITY_ARGON2ID_ALG, IDENTITY_PBKDF2_ALG } from "@dweb/crypto/argon2id-kdf";
import { parseIdentityEnvelope } from "@dweb/crypto/parse-identity-envelope";
import { upgradeEncryptedPrivateKeyHexIfLegacy } from "@dweb/crypto/upgrade-encrypted-private-key-hex";

const PRIVATE_KEY_HEX = "f4a8f6e2e1b4c3d2a1f0e9d8c7b6a5948372615049384756f5e4d3c2b1a0f9e8" as const;
const PASSPHRASE = "Obscur-KDF-Phase2-Vector!" as const;

/** Captured v1 PBKDF2 blob — must keep decrypting after Argon2id default write migration. */
const LEGACY_V1_PAYLOAD = "{\"v\":1,\"alg\":\"PBKDF2-SHA256/AES-256-GCM\",\"iterations\":200000,\"saltB64\":\"qFvM8n2pR0eT3uW6xY9zAA==\",\"ivB64\":\"8J2kLmN4pQrS\",\"ciphertextB64\":\"placeholder\"}";

describe("KEY-MOAT Phase 2 — identity envelope KDF", () => {
  it("writes Argon2id v2 payloads on encrypt", async () => {
    const payload = await encryptPrivateKeyHex({
      privateKeyHex: PRIVATE_KEY_HEX,
      passphrase: PASSPHRASE,
    });
    const envelope = parseIdentityEnvelope(payload);
    expect(envelope.v).toBe(2);
    expect(envelope.kdf.alg).toBe(IDENTITY_ARGON2ID_ALG);
    if (envelope.kdf.alg === IDENTITY_ARGON2ID_ALG) {
      expect(envelope.kdf.kdf.m).toBe(65_536);
      expect(envelope.kdf.kdf.t).toBe(3);
      expect(envelope.kdf.kdf.p).toBe(4);
    }
  });

  it("round-trips v2 Argon2id encrypt/decrypt", async () => {
    const payload = await encryptPrivateKeyHex({
      privateKeyHex: PRIVATE_KEY_HEX,
      passphrase: PASSPHRASE,
    });
    const restored = await decryptPrivateKeyHex({ payload, passphrase: PASSPHRASE });
    expect(restored).toBe(PRIVATE_KEY_HEX);
  });

  it("rejects wrong passphrase on v2 payload", async () => {
    const payload = await encryptPrivateKeyHex({
      privateKeyHex: PRIVATE_KEY_HEX,
      passphrase: PASSPHRASE,
    });
    await expect(
      decryptPrivateKeyHex({ payload, passphrase: "wrong-passphrase" }),
    ).rejects.toThrow();
  });

  it("decrypts legacy v1 PBKDF2 fixture", async () => {
    const legacyPayload = await encryptPrivateKeyHexLegacyFixture({
      privateKeyHex: PRIVATE_KEY_HEX,
      passphrase: PASSPHRASE,
    });
    const envelope = parseIdentityEnvelope(legacyPayload);
    expect(envelope.kdf.alg).toBe(IDENTITY_PBKDF2_ALG);
    const restored = await decryptPrivateKeyHex({
      payload: legacyPayload,
      passphrase: PASSPHRASE,
    });
    expect(restored).toBe(PRIVATE_KEY_HEX);
  });

  it("upgrades legacy v1 payload to v2 on demand", async () => {
    const legacyPayload = await encryptPrivateKeyHexLegacyFixture({
      privateKeyHex: PRIVATE_KEY_HEX,
      passphrase: PASSPHRASE,
    });
    const upgraded = await upgradeEncryptedPrivateKeyHexIfLegacy({
      payload: legacyPayload,
      passphrase: PASSPHRASE,
    });
    expect(upgraded).not.toBeNull();
    const envelope = parseIdentityEnvelope(upgraded!);
    expect(envelope.kdf.alg).toBe(IDENTITY_ARGON2ID_ALG);
    const restored = await decryptPrivateKeyHex({
      payload: upgraded!,
      passphrase: PASSPHRASE,
    });
    expect(restored).toBe(PRIVATE_KEY_HEX);
  });

  it("returns null when payload is already v2", async () => {
    const payload = await encryptPrivateKeyHex({
      privateKeyHex: PRIVATE_KEY_HEX,
      passphrase: PASSPHRASE,
    });
    const upgraded = await upgradeEncryptedPrivateKeyHexIfLegacy({
      payload,
      passphrase: PASSPHRASE,
    });
    expect(upgraded).toBeNull();
  });

  it("ignores stale LEGACY_V1_PAYLOAD placeholder shape", () => {
    expect(LEGACY_V1_PAYLOAD).toContain(IDENTITY_PBKDF2_ALG);
  });
});

/** PBKDF2 v1 encrypt path retained only for migration tests — production write uses Argon2id. */
async function encryptPrivateKeyHexLegacyFixture(params: Readonly<{
  privateKeyHex: string;
  passphrase: string;
}>): Promise<string> {
  const { deriveAesGcmKey } = await import("@dweb/crypto/derive-aes-gcm-key");
  const { toBase64 } = await import("@dweb/crypto/to-base64");
  const { toArrayBuffer } = await import("@dweb/crypto/to-array-buffer");

  const salt = new Uint8Array(16);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(salt);
  crypto.getRandomValues(iv);
  const iterations = 200_000;
  const key = await deriveAesGcmKey({
    passphrase: params.passphrase,
    salt,
    iterations,
  });
  const plaintext = new TextEncoder().encode(params.privateKeyHex);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(plaintext),
  );
  return JSON.stringify({
    v: 1,
    alg: IDENTITY_PBKDF2_ALG,
    iterations,
    saltB64: toBase64(salt),
    ivB64: toBase64(iv),
    ciphertextB64: toBase64(new Uint8Array(ciphertextBuffer)),
  });
}
