import { getScopedStorageKey, getDefaultProfileId } from "@/app/features/profiles/services/profile-scope";
import { readActiveDesktopProfileId } from "@/app/features/profiles/services/read-active-desktop-profile-id";

export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_BASE_KEY = "dweb.nostr.pwa.ui.theme";
export const ACCESSIBILITY_STORAGE_BASE_KEY = "dweb.nostr.pwa.ui.accessibility.v1";
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
 *
 * Always prefer this over registry `activeProfileId` in multi-window desktop —
 * secondary windows bind to their own profile, not the global registry selection.
 */
export const resolveBootstrapProfileId = (): string => readActiveDesktopProfileId();

export const resolveUiPreferencesProfileId = resolveBootstrapProfileId;

export const getThemeStorageKey = (profileId: string): string => (
  getScopedStorageKey(THEME_STORAGE_BASE_KEY, profileId)
);

export const getAccessibilityStorageKey = (profileId: string): string => (
  getScopedStorageKey(ACCESSIBILITY_STORAGE_BASE_KEY, profileId)
);

export type AccessibilityPreferencesSnapshot = Readonly<{
  textScale: 90 | 100 | 110 | 120;
  reducedMotion: boolean;
  contrastAssist: boolean;
}>;

const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferencesSnapshot = {
  textScale: 100,
  reducedMotion: false,
  contrastAssist: false,
};

const isTextScale = (value: unknown): value is AccessibilityPreferencesSnapshot["textScale"] => (
  value === 90 || value === 100 || value === 110 || value === 120
);

const parseAccessibilityPreferences = (
  value: unknown,
): AccessibilityPreferencesSnapshot | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<AccessibilityPreferencesSnapshot>;
  return {
    textScale: isTextScale(candidate.textScale) ? candidate.textScale : DEFAULT_ACCESSIBILITY_PREFERENCES.textScale,
    reducedMotion: typeof candidate.reducedMotion === "boolean"
      ? candidate.reducedMotion
      : DEFAULT_ACCESSIBILITY_PREFERENCES.reducedMotion,
    contrastAssist: typeof candidate.contrastAssist === "boolean"
      ? candidate.contrastAssist
      : DEFAULT_ACCESSIBILITY_PREFERENCES.contrastAssist,
  };
};

export const loadAccessibilityPreferences = (
  profileId?: string,
): AccessibilityPreferencesSnapshot => {
  if (typeof window === "undefined") {
    return DEFAULT_ACCESSIBILITY_PREFERENCES;
  }
  const resolvedProfileId = profileId?.trim() || resolveBootstrapProfileId();
  try {
    const scopedRaw = window.localStorage.getItem(getAccessibilityStorageKey(resolvedProfileId));
    const legacyRaw = window.localStorage.getItem(ACCESSIBILITY_STORAGE_BASE_KEY);
    const raw = scopedRaw ?? legacyRaw;
    if (!raw) {
      return DEFAULT_ACCESSIBILITY_PREFERENCES;
    }
    return parseAccessibilityPreferences(JSON.parse(raw)) ?? DEFAULT_ACCESSIBILITY_PREFERENCES;
  } catch {
    return DEFAULT_ACCESSIBILITY_PREFERENCES;
  }
};

export const saveAccessibilityPreferences = (
  preferences: AccessibilityPreferencesSnapshot,
  profileId?: string,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  const resolvedProfileId = profileId?.trim() || resolveBootstrapProfileId();
  try {
    window.localStorage.setItem(
      getAccessibilityStorageKey(resolvedProfileId),
      JSON.stringify(preferences),
    );
  } catch {
    // Quota / private mode — best effort.
  }
};

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
    window.localStorage.setItem(
      THEME_LAST_KNOWN_STORAGE_KEY,
      JSON.stringify({ profileId: resolvedProfileId, preference }),
    );
    if (resolvedProfileId === getDefaultProfileId()) {
      window.localStorage.setItem(THEME_STORAGE_BASE_KEY, preference);
    }
  } catch {
    // Quota / private mode — best effort.
  }
};
