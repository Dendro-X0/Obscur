/**
 * Cut 8.1 — seal/unseal Continuity M1 with Continuity passphrase (PBKDF2 + AES-GCM).
 * Uses @dweb/crypto only — no pwa feature import · ≠ Continuity Pass.
 * @see specs/backend/cut8-native-continuity-m1-adapter-design-2026-11-10.md
 */

import type { Passphrase } from "@dweb/crypto/passphrase";
import { deriveAesGcmKey } from "@dweb/crypto/derive-aes-gcm-key";
import { fromBase64 } from "@dweb/crypto/from-base64";
import { toArrayBuffer } from "@dweb/crypto/to-array-buffer";
import { toBase64 } from "@dweb/crypto/to-base64";
import {
  CONTINUITY_M1_SEALED_FORMAT,
  parseContinuityM1SealedEnvelope,
  parseContinuityM1Snapshot,
  type ContinuityM1SealedEnvelope,
  type ContinuityM1Snapshot,
} from "./continuity-m1-snapshot";

/** Fixed iteration count for Continuity M1 v0 envelopes. */
export const CONTINUITY_M1_PBKDF2_ITERATIONS = 210_000;

const SALT_BYTES = 16;
const IV_BYTES = 12;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const createRandomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};

export const sealContinuityM1Snapshot = async (params: Readonly<{
  snapshot: ContinuityM1Snapshot;
  continuityPassphrase: Passphrase;
}>): Promise<ContinuityM1SealedEnvelope> => {
  const salt = createRandomBytes(SALT_BYTES);
  const iv = createRandomBytes(IV_BYTES);
  const key = await deriveAesGcmKey({
    passphrase: params.continuityPassphrase,
    salt,
    iterations: CONTINUITY_M1_PBKDF2_ITERATIONS,
  });
  const plaintext = textEncoder.encode(JSON.stringify(params.snapshot));
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(plaintext),
  );
  return {
    version: 1,
    format: CONTINUITY_M1_SEALED_FORMAT,
    alg: "pbkdf2-sha256-aes-gcm",
    iterations: CONTINUITY_M1_PBKDF2_ITERATIONS,
    saltB64: toBase64(salt),
    ivB64: toBase64(iv),
    ciphertextB64: toBase64(new Uint8Array(ciphertextBuffer)),
    publicKeyHexHint: params.snapshot.publicKeyHex,
  };
};

export const unsealContinuityM1Snapshot = async (params: Readonly<{
  envelope: ContinuityM1SealedEnvelope | string | unknown;
  continuityPassphrase: Passphrase;
}>): Promise<ContinuityM1Snapshot> => {
  let envelope: ContinuityM1SealedEnvelope | null = null;
  if (typeof params.envelope === "string") {
    try {
      envelope = parseContinuityM1SealedEnvelope(JSON.parse(params.envelope));
    } catch {
      envelope = null;
    }
  } else {
    envelope = parseContinuityM1SealedEnvelope(params.envelope);
  }
  if (!envelope) {
    throw new Error("Invalid Continuity M1 sealed envelope");
  }

  const salt = fromBase64(envelope.saltB64);
  const iv = fromBase64(envelope.ivB64);
  const ciphertext = fromBase64(envelope.ciphertextB64);
  const key = await deriveAesGcmKey({
    passphrase: params.continuityPassphrase,
    salt,
    iterations: envelope.iterations,
  });
  let plaintextBuffer: ArrayBuffer;
  try {
    plaintextBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ciphertext),
    );
  } catch {
    throw new Error("Incorrect Continuity passphrase or corrupt sealed file");
  }
  const parsedJson: unknown = JSON.parse(textDecoder.decode(plaintextBuffer));
  const snapshot = parseContinuityM1Snapshot(parsedJson);
  if (!snapshot) {
    throw new Error("Sealed Continuity M1 payload is invalid");
  }
  return snapshot;
};

export const serializeContinuityM1SealedEnvelope = (
  envelope: ContinuityM1SealedEnvelope,
): string => JSON.stringify(envelope, null, 2);
