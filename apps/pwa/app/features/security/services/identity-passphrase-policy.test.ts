import { describe, expect, it, beforeEach } from "vitest";
import {
  assertIdentityPassphrasePolicy,
  evaluateIdentityPassphrasePolicy,
  IdentityPassphrasePolicyError,
  isIdentityPassphrasePolicyCompliant,
} from "./identity-passphrase-policy";

describe("identity-passphrase-policy", () => {
  it("accepts 12+ character passphrases", () => {
    const evaluation = evaluateIdentityPassphrasePolicy("Obscur-Safe-12");
    expect(evaluation.ok).toBe(true);
    if (evaluation.ok) {
      expect(evaluation.kind).toBe("long");
    }
  });

  it("accepts four-word passphrases", () => {
    const evaluation = evaluateIdentityPassphrasePolicy("correct horse battery staple");
    expect(evaluation.ok).toBe(true);
    if (evaluation.ok) {
      expect(evaluation.kind).toBe("word_passphrase");
    }
  });

  it("rejects short passphrases", () => {
    expect(evaluateIdentityPassphrasePolicy("short")).toEqual({ ok: false, reason: "too_short" });
    expect(isIdentityPassphrasePolicyCompliant("short")).toBe(false);
    expect(() => assertIdentityPassphrasePolicy("short")).toThrow(IdentityPassphrasePolicyError);
  });

  it("rejects common passwords even when long enough", () => {
    const evaluation = evaluateIdentityPassphrasePolicy("password123456");
    expect(evaluation).toEqual({ ok: false, reason: "common_password" });
  });
});
