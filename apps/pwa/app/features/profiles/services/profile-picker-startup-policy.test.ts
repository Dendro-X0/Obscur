import { afterEach, describe, expect, it } from "vitest";
import {
  PROFILE_PICKER_SHOW_ON_STARTUP_STORAGE_KEY,
  readShowProfilePickerOnStartup,
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
});
