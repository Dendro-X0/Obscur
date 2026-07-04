import { describe, expect, it } from "vitest";
import { canRemoveDesktopProfileEntry } from "./can-remove-desktop-profile";

describe("canRemoveDesktopProfileEntry", () => {
  it("allows removing secondary slots not bound to this window", () => {
    expect(canRemoveDesktopProfileEntry({
      profileId: "profile-2",
      isCurrentWindow: false,
    })).toBe(true);
  });

  it("blocks the current window and the default slot", () => {
    expect(canRemoveDesktopProfileEntry({
      profileId: "profile-2",
      isCurrentWindow: true,
    })).toBe(false);
    expect(canRemoveDesktopProfileEntry({
      profileId: "default",
      isCurrentWindow: false,
    })).toBe(false);
  });
});
