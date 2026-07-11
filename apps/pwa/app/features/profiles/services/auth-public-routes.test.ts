import { describe, expect, it, vi } from "vitest";
import {
  isAuthPublicProfileRoute,
  isPageReloadNavigation,
  isSessionRestoreDocumentNavigation,
  PROFILE_SIGN_IN_ROUTE,
  resolveLockedDesktopEntryRedirect,
  resolveLockedSingleProfilePublicRouteRedirect,
  resolveUnlockedDesktopRouteRedirect,
  shouldRedirectLockedDesktopToProfilePicker,
} from "./auth-public-routes";

const twoProfiles = [
  { profileId: "default", label: "Default", createdAtUnixMs: 1, lastUsedAtUnixMs: 1 },
  { profileId: "profile-2", label: "Profile 2", createdAtUnixMs: 2, lastUsedAtUnixMs: 2 },
] as const;

describe("auth-public-routes", () => {
  it("treats /profiles as public", () => {
    expect(isAuthPublicProfileRoute("/profiles")).toBe(true);
    expect(isAuthPublicProfileRoute("/profiles/")).toBe(true);
    expect(isAuthPublicProfileRoute("/settings")).toBe(false);
    expect(isAuthPublicProfileRoute(PROFILE_SIGN_IN_ROUTE)).toBe(false);
  });

  it("redirects locked desktop home to profile picker for existing windows with multiple profiles", () => {
    expect(shouldRedirectLockedDesktopToProfilePicker({
      pathname: "/",
      isDesktopNative: true,
      isUnlocked: false,
      registeredProfileCount: twoProfiles.length,
    })).toBe(true);
    expect(shouldRedirectLockedDesktopToProfilePicker({
      pathname: "/",
      isDesktopNative: true,
      isUnlocked: false,
      showProfilePickerOnStartup: false,
      registeredProfileCount: twoProfiles.length,
    })).toBe(false);
    expect(shouldRedirectLockedDesktopToProfilePicker({
      pathname: "/profiles",
      isDesktopNative: true,
      isUnlocked: false,
      registeredProfileCount: twoProfiles.length,
    })).toBe(false);
    expect(shouldRedirectLockedDesktopToProfilePicker({
      pathname: "/",
      isDesktopNative: true,
      isUnlocked: true,
      registeredProfileCount: twoProfiles.length,
    })).toBe(false);
  });

  it("keeps single-profile cold start on auth instead of the picker", () => {
    expect(shouldRedirectLockedDesktopToProfilePicker({
      pathname: "/",
      isDesktopNative: true,
      isUnlocked: false,
      registeredProfileCount: 1,
    })).toBe(false);
    expect(resolveLockedDesktopEntryRedirect({
      pathname: "/",
      isDesktopNative: true,
      isUnlocked: false,
      registeredProfileCount: 1,
      showProfilePickerOnStartup: true,
    })).toBeNull();
    expect(resolveLockedSingleProfilePublicRouteRedirect({
      pathname: "/profiles",
      isDesktopNative: true,
      isUnlocked: false,
      registeredProfileCount: 1,
    })).toBe("/");
  });

  it("routes new profile windows to sign-in instead of the picker grid", () => {
    expect(resolveLockedDesktopEntryRedirect({
      pathname: "/",
      isDesktopNative: true,
      isUnlocked: false,
      profileLaunchMode: "new_window",
      registeredProfileCount: twoProfiles.length,
    })).toBe(PROFILE_SIGN_IN_ROUTE);
    expect(resolveLockedDesktopEntryRedirect({
      pathname: "/",
      isDesktopNative: true,
      isUnlocked: false,
      profileLaunchMode: "existing",
      registeredProfileCount: twoProfiles.length,
    })).toBe("/profiles");
    expect(resolveLockedDesktopEntryRedirect({
      pathname: PROFILE_SIGN_IN_ROUTE,
      isDesktopNative: true,
      isUnlocked: false,
      profileLaunchMode: "existing",
      registeredProfileCount: twoProfiles.length,
    })).toBeNull();
  });

  it("skips locked desktop home redirect on manual page reload", () => {
    expect(resolveLockedDesktopEntryRedirect({
      pathname: "/",
      isDesktopNative: true,
      isUnlocked: false,
      isPageReload: true,
      showProfilePickerOnStartup: true,
      registeredProfileCount: twoProfiles.length,
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

  it("treats full document navigate loads as session-restore navigation", () => {
    const getEntriesByType = vi.fn(() => [{ type: "navigate" } as PerformanceNavigationTiming]);
    vi.stubGlobal("performance", {
      ...performance,
      getEntriesByType,
    });
    expect(isSessionRestoreDocumentNavigation()).toBe(true);
    expect(isPageReloadNavigation()).toBe(false);
    vi.unstubAllGlobals();
  });
});
