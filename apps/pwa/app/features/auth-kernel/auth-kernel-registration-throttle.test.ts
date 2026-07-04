import { beforeEach, describe, expect, it } from "vitest";
import { evaluateAuthRegistrationPolicy, resolveAuthSybilPolicyForTier } from "@dweb/auth";
import {
  AUTH_KERNEL_REGISTRATION_THROTTLE_WINDOW_MS,
  checkAuthKernelRegistrationThrottle,
  recordAuthKernelRegistrationAttempt,
  resetAuthKernelRegistrationThrottleForTests,
  resolveAuthKernelRegistrationThrottleBudget,
} from "./auth-kernel-registration-throttle";

describe("auth-kernel registration throttle", () => {
  beforeEach(() => {
    resetAuthKernelRegistrationThrottleForTests();
  });

  it("applies budget only when PoW create is required", () => {
    const tierC = evaluateAuthRegistrationPolicy({ policy: resolveAuthSybilPolicyForTier("C") });
    const tierB = evaluateAuthRegistrationPolicy({ policy: resolveAuthSybilPolicyForTier("B") });
    expect(resolveAuthKernelRegistrationThrottleBudget(tierC)).toEqual({
      maxAttempts: 5,
      windowMs: AUTH_KERNEL_REGISTRATION_THROTTLE_WINDOW_MS,
    });
    expect(resolveAuthKernelRegistrationThrottleBudget(tierB)).toBeNull();
  });

  it("throttles repeated PoW create attempts within the window", () => {
    const budget = { maxAttempts: 3, windowMs: 60_000 };
    const now = 1_000_000;
    recordAuthKernelRegistrationAttempt("tester1", budget, now);
    recordAuthKernelRegistrationAttempt("tester1", budget, now + 1);
    recordAuthKernelRegistrationAttempt("tester1", budget, now + 2);
    const throttle = checkAuthKernelRegistrationThrottle("tester1", budget, now + 3);
    expect(throttle.throttled).toBe(true);
    expect(throttle.retryAfterMs).toBeGreaterThan(0);
  });

  it("scopes throttle state per profile", () => {
    const budget = { maxAttempts: 1, windowMs: 60_000 };
    recordAuthKernelRegistrationAttempt("alice", budget, 100);
    expect(checkAuthKernelRegistrationThrottle("alice", budget, 101).throttled).toBe(true);
    expect(checkAuthKernelRegistrationThrottle("bob", budget, 101).throttled).toBe(false);
  });
});
