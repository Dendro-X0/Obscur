/** @vitest-environment node */
import { webcrypto } from "node:crypto";
Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

import { describe, expect, it } from "vitest";
import type { IdentityRecord } from "@dweb/core/identity-record";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { encryptPrivateKeyHex } from "@dweb/crypto/encrypt-private-key-hex";
import { parseIdentityEnvelope } from "@dweb/crypto/parse-identity-envelope";
import { IDENTITY_ARGON2ID_ALG } from "@dweb/crypto/argon2id-kdf";
import { maybeUpgradeUnlockedIdentityRecord } from "./identity-envelope-upgrade";

const PRIVATE_KEY = "f4a8f6e2e1b4c3d2a1f0e9d8c7b6a5948372615049384756f5e4d3c2b1a0f9e8";
const PASSPHRASE = "Obscur-KDF-Phase2-Vector!";
const PUBLIC_KEY = "e07f67dcb8a58f53b13fd15ae549c31fb3817a3a6cf0e8bd6903bae3c191ea56" as PublicKeyHex;

describe("identity-envelope-upgrade", () => {
  it("returns null when identity blob is already Argon2id v2", async () => {
    const payload = await encryptPrivateKeyHex({
      privateKeyHex: PRIVATE_KEY,
      passphrase: PASSPHRASE,
    });
    const record: IdentityRecord = {
      encryptedPrivateKey: payload,
      publicKeyHex: PUBLIC_KEY,
      username: "Tester",
    };
    const upgraded = await maybeUpgradeUnlockedIdentityRecord({
      record,
      passphrase: PASSPHRASE,
    });
    expect(upgraded).toBeNull();
  });

  it("upgrades legacy PBKDF2 record to Argon2id v2", async () => {
    const { deriveAesGcmKey } = await import("@dweb/crypto/derive-aes-gcm-key");
    const { toBase64 } = await import("@dweb/crypto/to-base64");
    const { toArrayBuffer } = await import("@dweb/crypto/to-array-buffer");
    const { IDENTITY_PBKDF2_ALG } = await import("@dweb/crypto/argon2id-kdf");

    const salt = new Uint8Array(16);
    const iv = new Uint8Array(12);
    crypto.getRandomValues(salt);
    crypto.getRandomValues(iv);
    const iterations = 200_000;
    const key = await deriveAesGcmKey({ passphrase: PASSPHRASE, salt, iterations });
    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(new TextEncoder().encode(PRIVATE_KEY)),
    );
    const legacyPayload = JSON.stringify({
      v: 1,
      alg: IDENTITY_PBKDF2_ALG,
      iterations,
      saltB64: toBase64(salt),
      ivB64: toBase64(iv),
      ciphertextB64: toBase64(new Uint8Array(ciphertextBuffer)),
    });
    const record: IdentityRecord = {
      encryptedPrivateKey: legacyPayload,
      publicKeyHex: PUBLIC_KEY,
      username: "Tester",
    };

    const upgraded = await maybeUpgradeUnlockedIdentityRecord({
      record,
      passphrase: PASSPHRASE,
    });
    expect(upgraded).not.toBeNull();
    const envelope = parseIdentityEnvelope(upgraded!.encryptedPrivateKey);
    expect(envelope.kdf.alg).toBe(IDENTITY_ARGON2ID_ALG);
    expect(upgraded!.publicKeyHex).toBe(PUBLIC_KEY);
    expect(upgraded!.username).toBe("Tester");
  });
});
