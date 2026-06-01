import { describe, expect, it } from "vitest";
import {
  isSecondaryProfileWindow,
  shouldScheduleSecondaryProfilePostLoginRefresh,
} from "./secondary-profile-post-login-refresh-policy";

describe("secondary-profile-post-login-refresh-policy", () => {
  it("treats non-default profile slots as secondary windows", () => {
    expect(isSecondaryProfileWindow("default")).toBe(false);
    expect(isSecondaryProfileWindow("profile-secondary")).toBe(true);
  });

  it("schedules refresh only for unlocked native secondary windows in ready/degraded phase", () => {
    expect(shouldScheduleSecondaryProfilePostLoginRefresh({
      isNativeRuntime: true,
      profileId: "profile-b",
      identityStatus: "unlocked",
      runtimePhase: "ready",
      alreadyRefreshed: false,
    })).toBe(true);

    expect(shouldScheduleSecondaryProfilePostLoginRefresh({
      isNativeRuntime: true,
      profileId: "default",
      identityStatus: "unlocked",
      runtimePhase: "ready",
      alreadyRefreshed: false,
    })).toBe(false);

    expect(shouldScheduleSecondaryProfilePostLoginRefresh({
      isNativeRuntime: true,
      profileId: "profile-b",
      identityStatus: "unlocked",
      runtimePhase: "ready",
      alreadyRefreshed: true,
    })).toBe(false);
  });
});
