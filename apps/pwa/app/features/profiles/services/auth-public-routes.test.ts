import { describe, expect, it } from "vitest";
import {
  isAuthPublicProfileRoute,
  PROFILE_SIGN_IN_ROUTE,
  resolveLockedDesktopEntryRedirect,
  resolveUnlockedDesktopRouteRedirect,
  shouldRedirectLockedDesktopToProfilePicker,
} from "./auth-public-routes";

describe("auth-public-routes", () => {
  it("treats /profiles as public", () => {
    expect(isAuthPublicProfileRoute("/profiles")).toBe(true);
    expect(isAuthPublicProfileRoute("/profiles/")).toBe(true);
    expect(isAuthPublicProfileRoute("/settings")).toBe(false);
    expect(isAuthPublicProfileRoute(PROFILE_SIGN_IN_ROUTE)).toBe(false);
  });

  it("redirects locked desktop home to profile picker for existing windows", () => {
    expect(shouldRedirectLockedDesktopToProfilePicker({
      pathname: "/",
      isDesktopNative: true,
      isUnlocked: false,
    })).toBe(true);
    expect(shouldRedirectLockedDesktopToProfilePicker({
      pathname: "/",
      isDesktopNative: true,
      isUnlocked: false,
      showProfilePickerOnStartup: false,
    })).toBe(false);
    expect(shouldRedirectLockedDesktopToProfilePicker({
      pathname: "/profiles",
      isDesktopNative: true,
      isUnlocked: false,
    })).toBe(false);
    expect(shouldRedirectLockedDesktopToProfilePicker({
      pathname: "/",
      isDesktopNative: true,
      isUnlocked: true,
    })).toBe(false);
  });

  it("routes new profile windows to sign-in instead of the picker grid", () => {
    expect(resolveLockedDesktopEntryRedirect({
      pathname: "/",
      isDesktopNative: true,
      isUnlocked: false,
      profileLaunchMode: "new_window",
    })).toBe(PROFILE_SIGN_IN_ROUTE);
    expect(resolveLockedDesktopEntryRedirect({
      pathname: "/",
      isDesktopNative: true,
      isUnlocked: false,
      profileLaunchMode: "existing",
    })).toBe("/profiles");
    expect(resolveLockedDesktopEntryRedirect({
      pathname: PROFILE_SIGN_IN_ROUTE,
      isDesktopNative: true,
      isUnlocked: false,
      profileLaunchMode: "existing",
    })).toBeNull();
  });

  it("skips locked desktop home redirect on manual page reload", () => {
    expect(resolveLockedDesktopEntryRedirect({
      pathname: "/",
      isDesktopNative: true,
      isUnlocked: false,
      isPageReload: true,
      showProfilePickerOnStartup: true,
    })).toBeNull();
  });

  it("routes unlocked sessions away from /sign-in to chat home", () => {
    expect(resolveUnlockedDesktopRouteRedirect({
      pathname: PROFILE_SIGN_IN_ROUTE,
      isDesktopNative: true,
      isUnlocked: true,
    })).toBe("/");
    expect(resolveUnlockedDesktopRouteRedirect({
      pathname: "/profiles",
      isDesktopNative: true,
      isUnlocked: true,
    })).toBeNull();
  });
});
