import { beforeEach, describe, expect, it } from "vitest";
import { evaluateAuthRegistrationPolicy, resolveAuthSybilPolicyForTier } from "@dweb/auth";
import { AUTH_KERNEL_BAND, AUTH_KERNEL_KERN_GATES_COMPLETE } from "./auth-kernel-policy";
import { evaluateAuthKernelRegistrationGate } from "./auth-kernel-registration-gate";
import {
  resetAuthKernelRegistrationThrottleForTests,
} from "./auth-kernel-registration-throttle";
import { writeAuthKernelSybilTierOverride } from "./auth-kernel-sybil-policy-config";

describe("AUTH-KERN-5 PoW create + farm throttle", () => {
  beforeEach(() => {
    writeAuthKernelSybilTierOverride(null);
    resetAuthKernelRegistrationThrottleForTests();
  });

  it("tracks completed KERN gate matrix at authority band", () => {
    expect(AUTH_KERNEL_BAND).toBe("AUTH-K-AUTHORITY");
    expect(AUTH_KERNEL_KERN_GATES_COMPLETE).toBe(true);
  });

  it("requires medium PoW at tier C with configured difficulty", async () => {
    writeAuthKernelSybilTierOverride("C");
    const gate = await evaluateAuthKernelRegistrationGate("tester1");
    expect(gate.evaluation.powRequired).toBe(true);
    expect(gate.powDifficulty).toBe("medium");
    expect(gate.throttled).toBe(false);
  });

  it("maps pow_hard policy to hard difficulty", () => {
    const evaluation = evaluateAuthRegistrationPolicy({
      policy: resolveAuthSybilPolicyForTier("B"),
      registrationMode: "pow_hard",
    });
    expect(evaluation.powRequired).toBe(true);
    expect(evaluation.policy.powDifficultyLabel).toBe("hard");
  });

  it("throttles farm attempts after budget exhausted at tier C", async () => {
    writeAuthKernelSybilTierOverride("C");
    for (let index = 0; index < 5; index += 1) {
      const gate = await evaluateAuthKernelRegistrationGate("tester1");
      expect(gate.throttled).toBe(false);
    }
    const throttled = await evaluateAuthKernelRegistrationGate("tester1");
    expect(throttled.throttled).toBe(true);
    expect(throttled.retryAfterMs).toBeGreaterThan(0);
    expect(throttled.powDifficulty).toBe("medium");
  });
});
