import type { Passphrase } from "@dweb/crypto/passphrase";

export type PassphrasePolicyFailureReason = "too_short" | "common_password";

export type PassphrasePolicyEvaluation = Readonly<
  | { ok: true; kind: "long" | "word_passphrase" }
  | { ok: false; reason: PassphrasePolicyFailureReason }
>;

export class IdentityPassphrasePolicyError extends Error {
  readonly reason: PassphrasePolicyFailureReason;

  constructor(reason: PassphrasePolicyFailureReason) {
    super(reason);
    this.name = "IdentityPassphrasePolicyError";
    this.reason = reason;
  }
}

const MIN_SINGLE_PASSPHRASE_LENGTH = 12;
const MIN_WORD_PASSPHRASE_WORDS = 4;
const MIN_WORD_LENGTH = 2;

/** Small embedded denylist — blocks obvious offline-dictionary targets (KEY-MOAT Phase 4). */
const BLOCKED_COMMON_PASSPHRASES = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "password1234",
  "password12345",
  "password123456",
  "qwertyuiop12",
  "qwerty123456",
  "letmein12345",
  "welcome12345",
  "admin1234567",
  "iloveyou1234",
  "sunshine1234",
  "princess1234",
  "football1234",
  "baseball1234",
  "dragon123456",
  "master123456",
  "monkey123456",
  "shadow123456",
  "superman1234",
  "trustno11234",
  "obscur123456",
  "123456789012",
  "abcdefghijkl",
  "aaaaaaaaaaaa",
]);

const normalizePassphrase = (passphrase: Passphrase): string => passphrase.trim();

const isWordPassphrase = (passphrase: string): boolean => {
  const words = passphrase.split(/\s+/).filter((word) => word.length >= MIN_WORD_LENGTH);
  return words.length >= MIN_WORD_PASSPHRASE_WORDS;
};

const isBlockedCommonPassphrase = (passphrase: string): boolean => {
  const normalized = passphrase.trim().toLowerCase();
  if (BLOCKED_COMMON_PASSPHRASES.has(normalized)) {
    return true;
  }
  if (/^password\d{2,}$/i.test(normalized)) {
    return true;
  }
  if (/^123456789\d*$/.test(normalized)) {
    return true;
  }
  return false;
};

export const evaluateIdentityPassphrasePolicy = (passphrase: Passphrase): PassphrasePolicyEvaluation => {
  const normalized = normalizePassphrase(passphrase);
  if (!normalized) {
    return { ok: false, reason: "too_short" };
  }
  if (isBlockedCommonPassphrase(normalized)) {
    return { ok: false, reason: "common_password" };
  }
  if (isWordPassphrase(normalized)) {
    return { ok: true, kind: "word_passphrase" };
  }
  if (normalized.length >= MIN_SINGLE_PASSPHRASE_LENGTH) {
    return { ok: true, kind: "long" };
  }
  return { ok: false, reason: "too_short" };
};

export const isIdentityPassphrasePolicyCompliant = (passphrase: Passphrase): boolean => (
  evaluateIdentityPassphrasePolicy(passphrase).ok
);

export const assertIdentityPassphrasePolicy = (passphrase: Passphrase): void => {
  const evaluation = evaluateIdentityPassphrasePolicy(passphrase);
  if (!evaluation.ok) {
    throw new IdentityPassphrasePolicyError(evaluation.reason);
  }
};
