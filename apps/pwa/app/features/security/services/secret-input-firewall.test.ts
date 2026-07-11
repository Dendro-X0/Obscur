import { describe, expect, it } from "vitest";
import {
  assertNoBlockedSecretMaterial,
  findSecretMaterialInText,
  isForbiddenSecretInput,
  textContainsBlockedSecretMaterial,
} from "./secret-input-firewall";

const SAMPLE_NSEC = "nsec1p578aq7jtr2ggep0s9kch0c60uvwd0kewa8v6w0gzuxy4dgt9paj0qut0mth";

describe("secret-input-firewall", () => {
  it("detects full nsec input", () => {
    expect(isForbiddenSecretInput(SAMPLE_NSEC)).toBe(true);
  });

  it("detects nsec embedded in chat text", () => {
    const text = `Here is my key: ${SAMPLE_NSEC} please add me`;
    const matches = findSecretMaterialInText(text);
    expect(matches.length).toBe(1);
    expect(matches[0]?.kind).toBe("nsec");
    expect(textContainsBlockedSecretMaterial(text)).toBe(true);
  });

  it("allows npub and hex pubkeys in messages", () => {
    const text = "My npub is npub1abc and pubkey 87cb2c2063308d194111eaa99643697dfa526af07516f09d4722258a94830125";
    expect(assertNoBlockedSecretMaterial(text, "message")).toEqual({ ok: true });
  });

  it("allows normal conversation without secrets", () => {
    expect(assertNoBlockedSecretMaterial("See you tomorrow!", "message")).toEqual({ ok: true });
  });

  it("blocks secret tokens in public profile fields", () => {
    const text = `Find me with code OBSCUR-ABCDE but never ${SAMPLE_NSEC}`;
    const result = assertNoBlockedSecretMaterial(text, "public_profile");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("nsec");
    }
  });
});
