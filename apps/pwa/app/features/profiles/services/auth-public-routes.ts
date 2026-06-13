/**
 * Routes reachable before account unlock (v1.9.6 profile picker).
 * Desktop-only — PWA/mobile keep auth-first flow.
 */

import type { ProfileLaunchMode } from "./profile-isolation-contracts";

export const PROFILE_SIGN_IN_ROUTE = "/sign-in";

const AUTH_PUBLIC_PROFILE_ROUTE_PREFIXES = [
  "/profiles",
] as const;

export const isAuthPublicProfileRoute = (pathname: string): boolean => {
  const normalized = pathname.trim() || "/";
  return AUTH_PUBLIC_PROFILE_ROUTE_PREFIXES.some((prefix) => (
    normalized === prefix || normalized.startsWith(`${prefix}/`)
  ));
};

/** Resolve cold-start redirect for locked desktop windows. */
export const resolveLockedDesktopEntryRedirect = (params: Readonly<{
  pathname: string;
  isDesktopNative: boolean;
  isUnlocked: boolean;
  showProfilePickerOnStartup?: boolean;
  profileLaunchMode?: ProfileLaunchMode;
}>): string | null => {
  if (!params.isDesktopNative || params.isUnlocked) {
    return null;
  }
  if (params.showProfilePickerOnStartup === false) {
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
  return "/profiles";
};

/** Locked desktop cold start lands on profile picker instead of a bound-account login form. */
export const shouldRedirectLockedDesktopToProfilePicker = (params: Readonly<{
  pathname: string;
  isDesktopNative: boolean;
  isUnlocked: boolean;
  showProfilePickerOnStartup?: boolean;
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
