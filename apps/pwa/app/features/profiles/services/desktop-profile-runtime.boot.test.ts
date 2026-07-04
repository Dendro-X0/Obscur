import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyDesktopWindowBootPayload } from "./desktop-profile-runtime";

describe("applyDesktopWindowBootPayload", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    delete (window as Window & { __OBSCUR_WINDOW_BOOT__?: unknown }).__OBSCUR_WINDOW_BOOT__;
    delete (window as Window & { __OBSCUR_SYNC_PROFILE_SCOPE__?: unknown }).__OBSCUR_SYNC_PROFILE_SCOPE__;
  });

  it("preserves per-window last-known profile over stale init-script default on refresh", () => {
    window.localStorage.setItem(
      "obscur.desktop.window_profile.last_known.v1::main",
      "profile-tester1",
    );
    (window as Window & { __OBSCUR_WINDOW_BOOT__?: unknown }).__OBSCUR_WINDOW_BOOT__ = {
      windowLabel: "main",
      profileId: "default",
      launchMode: "existing",
    };

    expect(applyDesktopWindowBootPayload()).toBe(true);
    expect(window.localStorage.getItem("obscur.desktop.window_profile.last_known.v1::main")).toBe(
      "profile-tester1",
    );
    expect((window as Window & { __OBSCUR_SYNC_PROFILE_SCOPE__?: string }).__OBSCUR_SYNC_PROFILE_SCOPE__).toBe(
      "profile-tester1",
    );
  });
});
