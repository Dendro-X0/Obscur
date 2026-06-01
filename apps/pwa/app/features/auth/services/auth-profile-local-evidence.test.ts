import { beforeEach, describe, expect, it } from "vitest";
import {
  markProfileWindowSessionEstablished,
  profileWindowHasEstablishedSession,
  profileWindowHasLocalAccountEvidence,
} from "./auth-profile-local-evidence";
import { getThemeStorageKey } from "@/app/features/settings/services/ui-preferences-persistence";

describe("profileWindowHasLocalAccountEvidence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("detects bound account markers without a loaded identity record", () => {
    localStorage.setItem("obscur.profile_window.last_bound_account::profile-b", "a".repeat(64));
    expect(profileWindowHasLocalAccountEvidence("profile-b")).toBe(true);
  });

  it("detects established profile window sessions", () => {
    markProfileWindowSessionEstablished("profile-b");
    expect(profileWindowHasEstablishedSession("profile-b")).toBe(true);
    expect(profileWindowHasLocalAccountEvidence("profile-b")).toBe(true);
  });

  it("detects saved appearance preferences for the profile window", () => {
    localStorage.setItem(getThemeStorageKey("profile-b"), "dark");
    expect(profileWindowHasLocalAccountEvidence("profile-b")).toBe(true);
  });

  it("returns false for an empty profile window", () => {
    expect(profileWindowHasLocalAccountEvidence("fresh-window")).toBe(false);
  });
});
