import { describe, expect, it, vi } from "vitest";
import { isRuntimeTransportOwnerEnabled } from "./runtime-transport-owner-policy";

const policyMocks = vi.hoisted(() => ({
  phase: "auth_required",
  identityStatus: "locked" as "locked" | "unlocked",
}));

vi.mock("./services/window-runtime-supervisor", () => ({
  windowRuntimeSupervisor: {
    getSnapshot: () => ({ phase: policyMocks.phase }),
  },
}));

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  getIdentitySnapshot: () => ({ status: policyMocks.identityStatus }),
}));

describe("isRuntimeTransportOwnerEnabled", () => {
  it("returns true for activating_runtime, ready, or degraded", () => {
    policyMocks.identityStatus = "locked";
    policyMocks.phase = "activating_runtime";
    expect(isRuntimeTransportOwnerEnabled()).toBe(true);

    policyMocks.phase = "ready";
    expect(isRuntimeTransportOwnerEnabled()).toBe(true);

    policyMocks.phase = "degraded";
    expect(isRuntimeTransportOwnerEnabled()).toBe(true);
  });

  it("returns true when identity is unlocked even if window phase lags", () => {
    policyMocks.phase = "auth_required";
    policyMocks.identityStatus = "unlocked";
    expect(isRuntimeTransportOwnerEnabled()).toBe(true);
  });

  it("returns false when locked and window phase is not active", () => {
    policyMocks.phase = "booting";
    policyMocks.identityStatus = "locked";
    expect(isRuntimeTransportOwnerEnabled()).toBe(false);
  });
});
