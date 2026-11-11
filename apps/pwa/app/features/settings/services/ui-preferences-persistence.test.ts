import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DESKTOP_LAST_WINDOW_PROFILE_STORAGE_KEY,
  getAccessibilityStorageKey,
  loadAccessibilityPreferences,
  loadThemePreference,
  PROFILE_REGISTRY_STORAGE_KEY,
  saveAccessibilityPreferences,
  saveThemePreference,
  THEME_LAST_KNOWN_STORAGE_KEY,
  THEME_STORAGE_BASE_KEY,
  getThemeStorageKey,
} from "./ui-preferences-persistence";

describe("ui-preferences-persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as Window & { __OBSCUR_SYNC_PROFILE_SCOPE__?: string }).__OBSCUR_SYNC_PROFILE_SCOPE__;
    delete (window as Window & { __OBSCUR_WINDOW_BOOT__?: unknown }).__OBSCUR_WINDOW_BOOT__;
  });

  afterEach(() => {
    localStorage.clear();
    delete (window as Window & { __OBSCUR_SYNC_PROFILE_SCOPE__?: string }).__OBSCUR_SYNC_PROFILE_SCOPE__;
    delete (window as Window & { __OBSCUR_WINDOW_BOOT__?: unknown }).__OBSCUR_WINDOW_BOOT__;
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

  it("prefers window-label last-known over registry active profile", () => {
    localStorage.setItem(
      PROFILE_REGISTRY_STORAGE_KEY,
      JSON.stringify({ activeProfileId: "profile-a", profiles: [] }),
    );
    localStorage.setItem(getThemeStorageKey("profile-a"), "light");
    (window as Window & {
      __OBSCUR_WINDOW_BOOT__?: { windowLabel: string; profileId: string };
    }).__OBSCUR_WINDOW_BOOT__ = {
      windowLabel: "main",
      profileId: "profile-b",
    };
    localStorage.setItem(`${DESKTOP_LAST_WINDOW_PROFILE_STORAGE_KEY}::main`, "profile-b");
    localStorage.setItem(getThemeStorageKey("profile-b"), "dark");
    expect(loadThemePreference()).toBe("dark");
  });

  it("ignores legacy global desktop last-known key without window label", () => {
    localStorage.setItem(
      PROFILE_REGISTRY_STORAGE_KEY,
      JSON.stringify({ activeProfileId: "profile-a", profiles: [] }),
    );
    localStorage.setItem(getThemeStorageKey("profile-a"), "light");
    localStorage.setItem(DESKTOP_LAST_WINDOW_PROFILE_STORAGE_KEY, "profile-b");
    localStorage.setItem(getThemeStorageKey("profile-b"), "dark");
    expect(loadThemePreference()).toBe("light");
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

  it("loads accessibility for sync-injected desktop window profile", () => {
    (window as Window & { __OBSCUR_SYNC_PROFILE_SCOPE__?: string }).__OBSCUR_SYNC_PROFILE_SCOPE__ = "profile-b";
    saveAccessibilityPreferences({
      textScale: 110,
      reducedMotion: true,
      contrastAssist: false,
    }, "profile-b");
    expect(loadAccessibilityPreferences()).toEqual({
      textScale: 110,
      reducedMotion: true,
      contrastAssist: false,
    });
    expect(loadAccessibilityPreferences("profile-a")).toEqual({
      textScale: 100,
      reducedMotion: false,
      contrastAssist: false,
    });
  });

  it("persists accessibility to scoped storage key", () => {
    saveAccessibilityPreferences({
      textScale: 90,
      reducedMotion: false,
      contrastAssist: true,
    }, "profile-x");
    expect(localStorage.getItem(getAccessibilityStorageKey("profile-x"))).toBe(JSON.stringify({
      textScale: 90,
      reducedMotion: false,
      contrastAssist: true,
    }));
  });
});
