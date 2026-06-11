import { describe, expect, it } from "vitest";
import {
  evaluateDmContinuityDigestGate,
  evaluateMembershipDigestGates,
  isDigestRiskLevelAcceptable,
} from "./dev-lab-digest-policy";

describe("dev-lab-digest-policy", () => {
  it("accepts watch-level risks when max is watch", () => {
    expect(isDigestRiskLevelAcceptable("watch", "watch")).toBe(true);
    expect(isDigestRiskLevelAcceptable("high", "watch")).toBe(false);
    expect(isDigestRiskLevelAcceptable(undefined, "watch")).toBe(true);
  });

  it("passes membership digest gates when both fields are watch or lower", () => {
    const result = evaluateMembershipDigestGates({
      membershipSendability: { riskLevel: "watch" },
      communityLifecycleConvergence: { riskLevel: "none" },
    });
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it("fails membership digest gates on high membershipSendability", () => {
    const result = evaluateMembershipDigestGates({
      membershipSendability: { riskLevel: "high" },
      communityLifecycleConvergence: { riskLevel: "watch" },
    });
    expect(result.passed).toBe(false);
    expect(result.failures).toEqual([{ key: "membershipSendability", riskLevel: "high" }]);
  });

  it("evaluates DM continuity digest gate", () => {
    expect(evaluateDmContinuityDigestGate({
      selfAuthoredDmContinuity: { riskLevel: "watch" },
    }).passed).toBe(true);
    expect(evaluateDmContinuityDigestGate({
      selfAuthoredDmContinuity: { riskLevel: "high" },
    }).passed).toBe(false);
  });
});
