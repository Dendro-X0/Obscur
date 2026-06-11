import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateMembershipDigestGates, isDigestRiskLevelAcceptable } from "./dev-lab-digest-policy.mjs";

describe("dev-lab-digest-policy.mjs", () => {
  it("accepts watch-level membership risks", () => {
    assert.equal(isDigestRiskLevelAcceptable("watch", "watch"), true);
    assert.equal(isDigestRiskLevelAcceptable("high", "watch"), false);
  });

  it("evaluates membership digest gates", () => {
    const passed = evaluateMembershipDigestGates({
      membershipSendability: { riskLevel: "watch" },
      communityLifecycleConvergence: { riskLevel: "none" },
    });
    assert.equal(passed.passed, true);

    const failed = evaluateMembershipDigestGates({
      membershipSendability: { riskLevel: "high" },
      communityLifecycleConvergence: { riskLevel: "none" },
    });
    assert.equal(failed.passed, false);
    assert.deepEqual(failed.failures[0], { key: "membershipSendability", riskLevel: "high" });
  });
});
