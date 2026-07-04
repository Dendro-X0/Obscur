import { describe, expect, it } from "vitest";
import {
  isGenericProfileSlotLabel,
  resolveDesktopProfileCardDisplay,
} from "./desktop-profile-card-display";

describe("desktop-profile-card-display", () => {
  it("treats registry slot labels as generic", () => {
    expect(isGenericProfileSlotLabel("Default", "default")).toBe(true);
    expect(isGenericProfileSlotLabel("Profile 2", "profile-2")).toBe(true);
    expect(isGenericProfileSlotLabel("Tester1", "default")).toBe(false);
  });

  it("shows account identity when saved account presence exists without live identity", () => {
    expect(resolveDesktopProfileCardDisplay({
      profileId: "profile-2",
      label: "Profile 2",
      avatarName: "Tester2",
      avatarUrl: "https://example.com/t2.png",
      hasStoredIdentity: false,
      hasSavedAccountPresence: true,
    })).toMatchObject({
      showAccountIdentity: true,
      displayName: "Tester2",
    });
  });

  it("shows account identity only when stored and not a slot label", () => {
    expect(resolveDesktopProfileCardDisplay({
      profileId: "default",
      label: "Tester1",
      avatarName: "Tester1",
      avatarUrl: "https://example.com/a.png",
      hasStoredIdentity: true,
      hasSavedAccountPresence: true,
    })).toMatchObject({
      showAccountIdentity: true,
      displayName: "Tester1",
    });

    expect(resolveDesktopProfileCardDisplay({
      profileId: "profile-2",
      label: "Profile 2",
      avatarName: "Profile 2",
      avatarUrl: "",
      hasStoredIdentity: false,
      hasSavedAccountPresence: false,
    })).toMatchObject({
      showAccountIdentity: false,
      displayName: null,
    });

    expect(resolveDesktopProfileCardDisplay({
      profileId: "default",
      label: "Default",
      avatarName: "Default",
      avatarUrl: "",
      hasStoredIdentity: false,
      hasSavedAccountPresence: false,
    })).toMatchObject({
      showAccountIdentity: false,
      displayName: null,
    });
  });
});
