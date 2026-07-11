/**
 * Device-level preference: show profile picker on desktop cold start (Chrome "Show on startup").
 * Not profile-scoped — applies to all windows on this device.
 *
 * Chrome parity: cold-start picker only after a second profile slot exists on the device.
 * Single-profile users land on auth directly.
 */

export const PROFILE_PICKER_SHOW_ON_STARTUP_STORAGE_KEY = "obscur.desktop.show_profile_picker_on_startup.v1";

/** Minimum registered profile slots before the public picker is offered on cold start. */
export const DESKTOP_PROFILE_PICKER_MIN_REGISTERED_PROFILES = 2;

export const hasMultipleDesktopProfileSlots = (registeredProfileCount: number): boolean => (
  registeredProfileCount >= DESKTOP_PROFILE_PICKER_MIN_REGISTERED_PROFILES
);

export const shouldShowDesktopProfilePickerOnColdStart = (params: Readonly<{
  registeredProfileCount: number;
  showOnStartupPreference: boolean;
}>): boolean => (
  hasMultipleDesktopProfileSlots(params.registeredProfileCount)
  && params.showOnStartupPreference
);

export const readShowProfilePickerOnStartup = (): boolean => {
  if (typeof window === "undefined") {
    return true;
  }
  const raw = window.localStorage.getItem(PROFILE_PICKER_SHOW_ON_STARTUP_STORAGE_KEY);
  if (raw === null) {
    return true;
  }
  return raw === "true";
};

export const writeShowProfilePickerOnStartup = (enabled: boolean): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    PROFILE_PICKER_SHOW_ON_STARTUP_STORAGE_KEY,
    enabled ? "true" : "false",
  );
};
