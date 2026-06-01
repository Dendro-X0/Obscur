import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DESKTOP_LAST_WINDOW_PROFILE_STORAGE_KEY,
  loadThemePreference,
  PROFILE_REGISTRY_STORAGE_KEY,
  saveThemePreference,
  THEME_LAST_KNOWN_STORAGE_KEY,
  THEME_STORAGE_BASE_KEY,
  getThemeStorageKey,
} from "./ui-preferences-persistence";

describe("ui-preferences-persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("loads scoped theme for bootstrap profile from registry", () => {
    localStorage.setItem(
      PROFILE_REGISTRY_STORAGE_KEY,
      JSON.stringify({ activeProfileId: "profile-a", profiles: [] }),
    );
    localStorage.setItem(getThemeStorageKey("profile-a"), "dark");
    expect(loadThemePreference()).toBe("dark");
  });

  it("prefers sync-injected profile scope for bootstrap theme", () => {
    (window as Window & { __OBSCUR_SYNC_PROFILE_SCOPE__?: string }).__OBSCUR_SYNC_PROFILE_SCOPE__ = "profile-b";
    localStorage.setItem(getThemeStorageKey("profile-b"), "dark");
    expect(loadThemePreference()).toBe("dark");
  });

  it("prefers desktop last-known window profile over registry active profile", () => {
    localStorage.setItem(
      PROFILE_REGISTRY_STORAGE_KEY,
      JSON.stringify({ activeProfileId: "profile-a", profiles: [] }),
    );
    localStorage.setItem(getThemeStorageKey("profile-a"), "light");
    localStorage.setItem(DESKTOP_LAST_WINDOW_PROFILE_STORAGE_KEY, "profile-b");
    localStorage.setItem(getThemeStorageKey("profile-b"), "dark");
    expect(loadThemePreference()).toBe("dark");
  });

  it("persists theme to scoped and last-known keys without polluting legacy key for secondary profiles", () => {
    saveThemePreference("system", "profile-x");
    expect(localStorage.getItem(getThemeStorageKey("profile-x"))).toBe("system");
    expect(localStorage.getItem(THEME_STORAGE_BASE_KEY)).toBeNull();
    const lastKnown = JSON.parse(localStorage.getItem(THEME_LAST_KNOWN_STORAGE_KEY) ?? "{}") as {
      profileId: string;
      preference: string;
    };
    expect(lastKnown).toEqual({ profileId: "profile-x", preference: "system" });
  });

  it("writes legacy theme key only for the default profile", () => {
    saveThemePreference("dark", "default");
    expect(localStorage.getItem(THEME_STORAGE_BASE_KEY)).toBe("dark");
  });

  it("keeps per-profile scoped theme when saving for another profile", () => {
    localStorage.setItem(getThemeStorageKey("profile-a"), "light");
    saveThemePreference("dark", "profile-b");
    expect(loadThemePreference("profile-b")).toBe("dark");
    expect(loadThemePreference("profile-a")).toBe("light");
  });
});
