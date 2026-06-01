import { afterEach, describe, expect, it } from "vitest";
import {
  mirrorDesktopWindowBootPayloadToSyncScope,
  readDesktopWindowBootPayload,
} from "./desktop-window-boot-payload";

describe("desktop-window-boot-payload", () => {
  afterEach(() => {
    delete (window as Window & { __OBSCUR_WINDOW_BOOT__?: unknown }).__OBSCUR_WINDOW_BOOT__;
    delete (window as Window & { __OBSCUR_SYNC_PROFILE_SCOPE__?: unknown }).__OBSCUR_SYNC_PROFILE_SCOPE__;
  });

  it("reads init-script payload from window global", () => {
    (window as Window & { __OBSCUR_WINDOW_BOOT__?: unknown }).__OBSCUR_WINDOW_BOOT__ = {
      windowLabel: "profile-profile-2-1700000000000",
      profileId: "profile-2",
    };
    expect(readDesktopWindowBootPayload()).toEqual({
      windowLabel: "profile-profile-2-1700000000000",
      profileId: "profile-2",
    });
  });

  it("mirrors payload into sync profile scope and per-window cache key", () => {
    (window as Window & { __OBSCUR_WINDOW_BOOT__?: unknown }).__OBSCUR_WINDOW_BOOT__ = {
      windowLabel: "profile-profile-2-1700000000000",
      profileId: "profile-2",
    };
    expect(mirrorDesktopWindowBootPayloadToSyncScope()).toBe(true);
    expect((window as Window & { __OBSCUR_SYNC_PROFILE_SCOPE__?: string }).__OBSCUR_SYNC_PROFILE_SCOPE__).toBe("profile-2");
    expect(window.localStorage.getItem("obscur.desktop.window_profile.last_known.v1::profile-profile-2-1700000000000")).toBe("profile-2");
  });
});
