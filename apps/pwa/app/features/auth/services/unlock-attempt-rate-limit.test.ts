/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetUnlockRateLimitForTests,
  assertUnlockRateLimit,
  checkUnlockRateLimit,
  clearUnlockRateLimit,
  computeUnlockBackoffMs,
  recordUnlockFailure,
  UnlockRateLimitError,
} from "./unlock-attempt-rate-limit";

describe("unlock-attempt-rate-limit", () => {
  beforeEach(() => {
    __resetUnlockRateLimitForTests();
  });

  it("allows first failures without backoff", () => {
    expect(computeUnlockBackoffMs(1)).toBe(0);
    expect(computeUnlockBackoffMs(2)).toBe(0);
    recordUnlockFailure("default", 1_000);
    recordUnlockFailure("default", 2_000);
    expect(checkUnlockRateLimit("default", 2_500).allowed).toBe(true);
  });

  it("applies exponential backoff after third failure", () => {
    recordUnlockFailure("default", 10_000);
    recordUnlockFailure("default", 10_100);
    recordUnlockFailure("default", 10_200);
    const gate = checkUnlockRateLimit("default", 10_250);
    expect(gate.allowed).toBe(false);
    expect(gate.retryAfterMs).toBeGreaterThan(0);
    expect(() => assertUnlockRateLimit("default", 10_250)).toThrow(UnlockRateLimitError);
  });

  it("clears limit after successful unlock", () => {
    recordUnlockFailure("default", 10_000);
    recordUnlockFailure("default", 10_100);
    recordUnlockFailure("default", 10_200);
    clearUnlockRateLimit("default");
    expect(checkUnlockRateLimit("default", 10_250).allowed).toBe(true);
  });

  it("caps backoff at five minutes", () => {
    expect(computeUnlockBackoffMs(20)).toBe(300_000);
  });
});
