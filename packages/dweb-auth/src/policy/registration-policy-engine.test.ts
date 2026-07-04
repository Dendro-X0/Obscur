import { describe, expect, it } from "vitest";
import {
  AUTH_SYBIL_TIER_POLICIES,
  evaluateAuthRegistrationPolicy,
  resolveAuthSybilPolicyForTier,
} from "./registration-policy-engine";

describe("registration-policy-engine", () => {
  it("maps sybil tiers to registration modes", () => {
    expect(resolveAuthSybilPolicyForTier("C").registrationMode).toBe("pow_medium");
    expect(resolveAuthSybilPolicyForTier("D").registrationMode).toBe("invite_required");
    expect(AUTH_SYBIL_TIER_POLICIES.B.registrationMode).toBe("standard");
  });

  it("requires PoW for tier C policy", () => {
    const evaluation = evaluateAuthRegistrationPolicy({
      policy: resolveAuthSybilPolicyForTier("C"),
    });
    expect(evaluation.allowed).toBe(true);
    expect(evaluation.powRequired).toBe(true);
    expect(evaluation.inviteRequired).toBe(false);
  });

  it("blocks self-service create when invite is required", () => {
    const evaluation = evaluateAuthRegistrationPolicy({
      policy: resolveAuthSybilPolicyForTier("D"),
    });
    expect(evaluation.allowed).toBe(false);
    expect(evaluation.inviteRequired).toBe(true);
    expect(evaluation.powRequired).toBe(false);
  });

  it("maps pow_hard to hard difficulty label", () => {
    const evaluation = evaluateAuthRegistrationPolicy({
      policy: resolveAuthSybilPolicyForTier("B"),
      registrationMode: "pow_hard",
    });
    expect(evaluation.powRequired).toBe(true);
    expect(evaluation.policy.powDifficultyLabel).toBe("hard");
  });
});
