import { describe, expect, it } from "vitest";
import {
  PROFILE_SIGN_IN_ROUTE,
  resolveLockedDesktopEntryRedirect,
  shouldRedirectLockedDesktopToProfilePicker,
} from "./services/auth-public-routes";
import { readShowProfilePickerOnStartup } from "./services/profile-picker-startup-policy";

describe("profile-picker contract", () => {
  it("keeps public profile routes and startup preference aligned", () => {
    expect(readShowProfilePickerOnStartup()).toBe(true);
    expect(shouldRedirectLockedDesktopToProfilePicker({
      pathname: "/profiles",
      isDesktopNative: true,
      isUnlocked: false,
      showProfilePickerOnStartup: true,
    })).toBe(false);
    expect(shouldRedirectLockedDesktopToProfilePicker({
      pathname: "/",
      isDesktopNative: true,
      isUnlocked: false,
      showProfilePickerOnStartup: false,
    })).toBe(false);
    expect(resolveLockedDesktopEntryRedirect({
      pathname: PROFILE_SIGN_IN_ROUTE,
      isDesktopNative: true,
      isUnlocked: false,
      showProfilePickerOnStartup: true,
    })).toBeNull();
  });
});
