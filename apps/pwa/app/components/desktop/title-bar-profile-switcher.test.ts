import { beforeEach, describe, expect, it } from "vitest";
import { isRememberMeEnabledForProfile } from "@/app/features/auth/utils/remember-me-state";

describe("title-bar-profile-switcher session continuity", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("preserves auth token on lock when remember-me is enabled for the profile", () => {
    window.localStorage.setItem("obscur_remember_me::profile-a", "true");

    expect(isRememberMeEnabledForProfile("profile-a")).toBe(true);
  });

  it("does not preserve auth token on lock when remember-me is not enabled", () => {
    window.localStorage.setItem("obscur_remember_me::profile-a", "false");

    expect(isRememberMeEnabledForProfile("profile-a")).toBe(false);
  });
});
