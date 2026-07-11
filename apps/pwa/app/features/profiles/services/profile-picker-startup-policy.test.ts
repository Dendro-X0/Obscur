import { afterEach, describe, expect, it } from "vitest";
import {
  DESKTOP_PROFILE_PICKER_MIN_REGISTERED_PROFILES,
  hasMultipleDesktopProfileSlots,
  PROFILE_PICKER_SHOW_ON_STARTUP_STORAGE_KEY,
  readShowProfilePickerOnStartup,
  shouldShowDesktopProfilePickerOnColdStart,
  writeShowProfilePickerOnStartup,
} from "./profile-picker-startup-policy";

describe("profile-picker-startup-policy", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("defaults show-on-startup to true", () => {
    expect(readShowProfilePickerOnStartup()).toBe(true);
  });

  it("persists show-on-startup preference", () => {
    writeShowProfilePickerOnStartup(false);
    expect(localStorage.getItem(PROFILE_PICKER_SHOW_ON_STARTUP_STORAGE_KEY)).toBe("false");
    expect(readShowProfilePickerOnStartup()).toBe(false);
  });

  it("requires multiple profile slots before offering cold-start picker", () => {
    expect(DESKTOP_PROFILE_PICKER_MIN_REGISTERED_PROFILES).toBe(2);
    expect(hasMultipleDesktopProfileSlots(1)).toBe(false);
    expect(hasMultipleDesktopProfileSlots(2)).toBe(true);
    expect(shouldShowDesktopProfilePickerOnColdStart({
      registeredProfileCount: 1,
      showOnStartupPreference: true,
    })).toBe(false);
    expect(shouldShowDesktopProfilePickerOnColdStart({
      registeredProfileCount: 2,
      showOnStartupPreference: true,
    })).toBe(true);
    expect(shouldShowDesktopProfilePickerOnColdStart({
      registeredProfileCount: 2,
      showOnStartupPreference: false,
    })).toBe(false);
  });
});
