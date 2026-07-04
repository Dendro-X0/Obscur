import { describe, expect, it } from "vitest";
import { PROFILE_SIGN_IN_ROUTE } from "./auth-public-routes";

/** Mirrors profiles/page.tsx handleLaunchProfile routing for locked desktop picker. */
export const resolveProfilePickerPrimaryAction = (entry: Readonly<{
  isCurrentWindow: boolean;
  shouldFocusExistingWindow: boolean;
  focusTargetProfileId?: string;
}>): Readonly<{ kind: "sign_in_here" } | { kind: "focus_existing"; profileId: string } | { kind: "open_profile"; profileId: string }> => {
  if (entry.isCurrentWindow) {
    return { kind: "sign_in_here" };
  }
  if (entry.shouldFocusExistingWindow && entry.focusTargetProfileId) {
    return { kind: "focus_existing", profileId: entry.focusTargetProfileId };
  }
  return { kind: "open_profile", profileId: entry.focusTargetProfileId ?? "unknown" };
};

export const resolveSignInHereRoute = (): string => PROFILE_SIGN_IN_ROUTE;

describe("profile-picker launch routing", () => {
  it("routes current-window clicks to sign-in instead of home (avoids / → /profiles redirect loop)", () => {
    const action = resolveProfilePickerPrimaryAction({
      isCurrentWindow: true,
      shouldFocusExistingWindow: false,
    });
    expect(action).toEqual({ kind: "sign_in_here" });
    expect(resolveSignInHereRoute()).toBe("/sign-in");
    expect(resolveSignInHereRoute()).not.toBe("/");
  });

  it("focuses an existing window when the profile is open elsewhere", () => {
    expect(resolveProfilePickerPrimaryAction({
      isCurrentWindow: false,
      shouldFocusExistingWindow: true,
      focusTargetProfileId: "default",
    })).toEqual({ kind: "focus_existing", profileId: "default" });
  });

  it("opens a new profile window for unused slots", () => {
    expect(resolveProfilePickerPrimaryAction({
      isCurrentWindow: false,
      shouldFocusExistingWindow: false,
    }).kind).toBe("open_profile");
  });
});
