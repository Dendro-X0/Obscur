/**
 * Device-level preference: show profile picker on desktop cold start (Chrome "Show on startup").
 * Not profile-scoped — applies to all windows on this device.
 */

export const PROFILE_PICKER_SHOW_ON_STARTUP_STORAGE_KEY = "obscur.desktop.show_profile_picker_on_startup.v1";

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
