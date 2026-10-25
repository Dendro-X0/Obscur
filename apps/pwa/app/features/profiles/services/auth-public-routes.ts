/**
 * Routes reachable before account unlock (v1.9.6 profile picker).
 * Desktop-only — PWA/mobile keep auth-first flow.
 */

import type { ProfileLaunchMode } from "./profile-isolation-contracts";
import { shouldShowDesktopProfilePickerOnColdStart } from "./profile-picker-startup-policy";

export const PROFILE_SIGN_IN_ROUTE = "/sign-in";

/**
 * Set when the user picks a profile from the startup picker (session-scoped).
 * Prevents N1c unlock→`/`→`/profiles` bounce after intentional entry.
 */
export const PROFILE_PICKER_ENTRY_CONSUMED_SESSION_KEY = "obscur.desktop.profile_picker_entry_consumed.v1";

export const markDesktopProfilePickerEntryConsumed = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(PROFILE_PICKER_ENTRY_CONSUMED_SESSION_KEY, "1");
  } catch {
    // best-effort
  }
};

export const hasDesktopProfilePickerEntryBeenConsumed = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.sessionStorage.getItem(PROFILE_PICKER_ENTRY_CONSUMED_SESSION_KEY) === "1";
  } catch {
    return false;
  }
};

/** True when the current document load was triggered by a manual refresh (F5). */
export const isPageReloadNavigation = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  if (typeof performance.getEntriesByType !== "function") {
    return false;
  }
  const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return entry?.type === "reload";
};

/**
 * True on any full document load (reload, hardNavigate, external link).
 * SPA client navigations do not create a new navigation entry.
 */
export const isSessionRestoreDocumentNavigation = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  if (typeof performance.getEntriesByType !== "function") {
    return false;
  }
  const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return entry?.type === "reload" || entry?.type === "navigate";
};

const AUTH_PUBLIC_PROFILE_ROUTE_PREFIXES = [
  "/profiles",
] as const;

/** Dev/lab UI fixtures that must render without unlock (call chrome preview, etc.). */
const AUTH_PUBLIC_DEV_LAB_ROUTE_PREFIXES = [
  "/lab",
] as const;

export const isAuthPublicProfileRoute = (pathname: string): boolean => {
  const normalized = pathname.trim() || "/";
  return AUTH_PUBLIC_PROFILE_ROUTE_PREFIXES.some((prefix) => (
    normalized === prefix || normalized.startsWith(`${prefix}/`)
  ));
};

export const isAuthPublicDevLabRoute = (pathname: string): boolean => {
  const normalized = pathname.trim() || "/";
  return AUTH_PUBLIC_DEV_LAB_ROUTE_PREFIXES.some((prefix) => (
    normalized === prefix || normalized.startsWith(`${prefix}/`)
  ));
};

/** Any route that may render without unlocked messaging shell. */
export const isAuthPublicShellBypassRoute = (pathname: string): boolean => (
  isAuthPublicProfileRoute(pathname) || isAuthPublicDevLabRoute(pathname)
);

/** Resolve cold-start redirect for locked desktop windows. */
export const resolveLockedDesktopEntryRedirect = (params: Readonly<{
  pathname: string;
  isDesktopNative: boolean;
  isUnlocked: boolean;
  showProfilePickerOnStartup?: boolean;
  registeredProfileCount?: number;
  profileLaunchMode?: ProfileLaunchMode;
  isPageReload?: boolean;
}>): string | null => {
  if (!params.isDesktopNative || params.isUnlocked) {
    return null;
  }
  if (params.isPageReload) {
    return null;
  }
  if (isAuthPublicProfileRoute(params.pathname) || params.pathname === PROFILE_SIGN_IN_ROUTE) {
    return null;
  }
  if (params.pathname !== "/" && params.pathname !== "") {
    return null;
  }
  if (params.profileLaunchMode === "new_window") {
    return PROFILE_SIGN_IN_ROUTE;
  }
  const showPickerOnColdStart = shouldShowDesktopProfilePickerOnColdStart({
    registeredProfileCount: params.registeredProfileCount ?? 1,
    showOnStartupPreference: params.showProfilePickerOnStartup !== false,
  });
  if (!showPickerOnColdStart) {
    return null;
  }
  return "/profiles";
};

/** Locked single-profile windows use auth-first entry; public picker route is not offered. */
export const resolveLockedSingleProfilePublicRouteRedirect = (params: Readonly<{
  pathname: string;
  isDesktopNative: boolean;
  isUnlocked: boolean;
  registeredProfileCount?: number;
}>): string | null => {
  if (!params.isDesktopNative || params.isUnlocked) {
    return null;
  }
  if (!isAuthPublicProfileRoute(params.pathname)) {
    return null;
  }
  if (shouldShowDesktopProfilePickerOnColdStart({
    registeredProfileCount: params.registeredProfileCount ?? 1,
    showOnStartupPreference: true,
  })) {
    return null;
  }
  return "/";
};

/** Locked desktop cold start lands on profile picker instead of a bound-account login form. */
export const shouldRedirectLockedDesktopToProfilePicker = (params: Readonly<{
  pathname: string;
  isDesktopNative: boolean;
  isUnlocked: boolean;
  showProfilePickerOnStartup?: boolean;
  registeredProfileCount?: number;
}>): boolean => (
  resolveLockedDesktopEntryRedirect(params) === "/profiles"
);

/** After unlock, `/sign-in` has no chat shell — send users to home. */
export const resolveUnlockedDesktopRouteRedirect = (params: Readonly<{
  pathname: string;
  isDesktopNative: boolean;
  isUnlocked: boolean;
}>): string | null => {
  if (!params.isDesktopNative || !params.isUnlocked) {
    return null;
  }
  if (params.pathname === PROFILE_SIGN_IN_ROUTE) {
    return "/";
  }
  return null;
};

/**
 * N1c / E20: keychain rehydrate unlocks on `/` and mounted messaging before the picker.
 * When startup picker is preferred, send unlocked cold starts to `/profiles` first (PL1).
 * N1e: once the user picks a profile, do not bounce them back from `/`.
 */
export const resolveUnlockedDesktopStartupPickerRedirect = (params: Readonly<{
  pathname: string;
  isDesktopNative: boolean;
  isUnlocked: boolean;
  showProfilePickerOnStartup?: boolean;
  registeredProfileCount?: number;
  profileLaunchMode?: ProfileLaunchMode;
  isPageReload?: boolean;
  pickerEntryConsumed?: boolean;
}>): string | null => {
  if (!params.isDesktopNative || !params.isUnlocked) {
    return null;
  }
  if (params.pickerEntryConsumed) {
    return null;
  }
  if (params.isPageReload) {
    return null;
  }
  if (isAuthPublicProfileRoute(params.pathname) || params.pathname === PROFILE_SIGN_IN_ROUTE) {
    return null;
  }
  if (params.pathname !== "/" && params.pathname !== "") {
    return null;
  }
  if (params.profileLaunchMode === "new_window") {
    return null;
  }
  const showPickerOnColdStart = shouldShowDesktopProfilePickerOnColdStart({
    registeredProfileCount: params.registeredProfileCount ?? 1,
    showOnStartupPreference: params.showProfilePickerOnStartup !== false,
  });
  if (!showPickerOnColdStart) {
    return null;
  }
  return "/profiles";
};

/** True while unlocked home should not mount messaging (awaiting startup picker redirect). */
export const shouldDeferUnlockedMessagingShellForStartupPicker = (params: Readonly<{
  pathname: string;
  isDesktopNative: boolean;
  isUnlocked: boolean;
  showProfilePickerOnStartup?: boolean;
  registeredProfileCount?: number;
  profileLaunchMode?: ProfileLaunchMode;
  isPageReload?: boolean;
  pickerEntryConsumed?: boolean;
}>): boolean => (
  resolveUnlockedDesktopStartupPickerRedirect(params) === "/profiles"
);
