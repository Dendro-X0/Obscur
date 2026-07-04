import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAuthKernelManualLock,
  isAuthKernelManualLockActive,
  markAuthKernelManualLock,
  resolveAuthKernelBootRestoreEligible,
} from "./auth-kernel-manual-lock-state";

describe("auth-kernel manual lock state", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("marks and clears profile-scoped manual lock in sessionStorage", () => {
    markAuthKernelManualLock("tester1");
    expect(isAuthKernelManualLockActive("tester1")).toBe(true);
    expect(isAuthKernelManualLockActive("tester2")).toBe(false);
    clearAuthKernelManualLock("tester1");
    expect(isAuthKernelManualLockActive("tester1")).toBe(false);
  });

  it("disables boot restore eligibility while manual lock is active", () => {
    markAuthKernelManualLock("tester1");
    expect(resolveAuthKernelBootRestoreEligible("tester1")).toBe(false);
    clearAuthKernelManualLock("tester1");
    expect(resolveAuthKernelBootRestoreEligible("tester1")).toBe(true);
  });
});
