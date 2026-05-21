import { getScopedStorageKey, getDefaultProfileId } from "@/app/features/profiles/services/profile-scope";

export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_BASE_KEY = "dweb.nostr.pwa.ui.theme";
export const PROFILE_REGISTRY_STORAGE_KEY = "obscur.profiles.registry.v1";
export const DESKTOP_LAST_WINDOW_PROFILE_STORAGE_KEY = "obscur.desktop.window_profile.last_known.v1";
/** Written on every theme save so cold boot can resolve preference before runtime scope injects. */
export const THEME_LAST_KNOWN_STORAGE_KEY = "obscur.ui.theme.last_known.v1";

export const isThemePreference = (value: unknown): value is ThemePreference => (
  value === "system" || value === "light" || value === "dark"
);

/**
 * Resolve which profile's scoped preferences should load at cold boot.
 * Order: desktop last-known window profile → registry active profile → default.
 */
export const resolveBootstrapProfileId = (): string => {
  if (typeof window === "undefined") {
    return getDefaultProfileId();
  }
  try {
    const lastWindowProfile = window.localStorage.getItem(DESKTOP_LAST_WINDOW_PROFILE_STORAGE_KEY)?.trim();
    if (lastWindowProfile && lastWindowProfile.length > 0) {
      return lastWindowProfile;
    }
    const registryRaw = window.localStorage.getItem(PROFILE_REGISTRY_STORAGE_KEY);
    if (registryRaw) {
      const registry = JSON.parse(registryRaw) as { activeProfileId?: unknown };
      if (typeof registry.activeProfileId === "string" && registry.activeProfileId.trim().length > 0) {
        return registry.activeProfileId.trim();
      }
    }
  } catch {
    // fall through
  }
  return getDefaultProfileId();
};

export const getThemeStorageKey = (profileId: string): string => (
  getScopedStorageKey(THEME_STORAGE_BASE_KEY, profileId)
);

export const loadThemePreference = (profileId?: string): ThemePreference => {
  if (typeof window === "undefined") {
    return "system";
  }
  const resolvedProfileId = profileId?.trim() || resolveBootstrapProfileId();
  try {
    const lastKnownRaw = window.localStorage.getItem(THEME_LAST_KNOWN_STORAGE_KEY);
    if (lastKnownRaw) {
      const lastKnown = JSON.parse(lastKnownRaw) as { profileId?: unknown; preference?: unknown };
      if (
        typeof lastKnown.profileId === "string"
        && lastKnown.profileId === resolvedProfileId
        && isThemePreference(lastKnown.preference)
      ) {
        return lastKnown.preference;
      }
    }
    const scopedRaw = window.localStorage.getItem(getThemeStorageKey(resolvedProfileId));
    if (scopedRaw && isThemePreference(scopedRaw)) {
      return scopedRaw;
    }
    const legacyRaw = window.localStorage.getItem(THEME_STORAGE_BASE_KEY);
    if (legacyRaw && isThemePreference(legacyRaw)) {
      return legacyRaw;
    }
  } catch {
    return "system";
  }
  return "system";
};

export const saveThemePreference = (
  preference: ThemePreference,
  profileId?: string,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  const resolvedProfileId = profileId?.trim() || resolveBootstrapProfileId();
  try {
    window.localStorage.setItem(getThemeStorageKey(resolvedProfileId), preference);
    window.localStorage.setItem(THEME_STORAGE_BASE_KEY, preference);
    window.localStorage.setItem(
      THEME_LAST_KNOWN_STORAGE_KEY,
      JSON.stringify({ profileId: resolvedProfileId, preference }),
    );
  } catch {
    // Quota / private mode — best effort.
  }
};
