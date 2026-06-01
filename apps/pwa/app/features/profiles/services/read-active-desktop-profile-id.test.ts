import { beforeEach, describe, expect, it } from "vitest";
import { readActiveDesktopProfileId } from "./read-active-desktop-profile-id";

describe("readActiveDesktopProfileId", () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as Window & { __OBSCUR_SYNC_PROFILE_SCOPE__?: string }).__OBSCUR_SYNC_PROFILE_SCOPE__;
    delete (window as Window & { __OBSCUR_WINDOW_BOOT__?: unknown }).__OBSCUR_WINDOW_BOOT__;
  });

  it("prefers sync-injected profile scope", () => {
    (window as Window & { __OBSCUR_SYNC_PROFILE_SCOPE__?: string }).__OBSCUR_SYNC_PROFILE_SCOPE__ = "profile-2";
    expect(readActiveDesktopProfileId()).toBe("profile-2");
  });

  it("falls back to boot payload window cache", () => {
    (window as Window & {
      __OBSCUR_WINDOW_BOOT__?: { windowLabel: string; profileId: string };
    }).__OBSCUR_WINDOW_BOOT__ = {
      windowLabel: "profile-profile-2-1700000000000",
      profileId: "profile-2",
    };
    localStorage.setItem(
      "obscur.desktop.window_profile.last_known.v1::profile-profile-2-1700000000000",
      "profile-2",
    );
    expect(readActiveDesktopProfileId()).toBe("profile-2");
  });
});
