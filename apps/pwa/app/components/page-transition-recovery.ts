export type PageTransitionRecoveryState = Readonly<{
  timeoutCount: number;
  transitionsDisabled: boolean;
}>;

export type RouteSurface =
  | "chats"
  | "network"
  | "groups"
  | "search"
  | "requests"
  | "settings"
  | "vault"
  | "profile"
  | "invites"
  | "download"
  | "unknown";

export type RouteMountProbeSample = Readonly<{
  pathname: string;
  routeSurface: RouteSurface;
  startedAtUnixMs: number;
  settledAtUnixMs: number;
  elapsedMs: number;
  firstFrameDelayMs: number | null;
  secondFrameDelayMs: number | null;
  routeRequestElapsedMs: number | null;
  pageTransitionsEnabled: boolean;
  transitionWatchdogTimeoutCount: number;
}>;

export type RouteMountDiagnosticsState = Readonly<{
  recentSamples: ReadonlyArray<RouteMountProbeSample>;
  slowSampleCount: number;
  worstElapsedMs: number;
  lastSlowAtUnixMs: number | null;
}>;

export const PAGE_TRANSITION_WATCHDOG_MS = 1800;
export const PAGE_TRANSITION_TIMEOUT_DISABLE_THRESHOLD = 3;
export const ROUTE_NAVIGATION_STALL_HARD_FALLBACK_MS = 4_500;
export const ROUTE_MOUNT_PROBE_WARN_THRESHOLD_MS = 1_500;
export const ROUTE_MOUNT_PROBE_MAX_SAMPLES = 24;

const startsWithPathSegment = (pathname: string, prefix: string): boolean => (
  pathname === prefix || pathname.startsWith(`${prefix}/`)
);

export const createPageTransitionRecoveryState = (): PageTransitionRecoveryState => ({
  timeoutCount: 0,
  transitionsDisabled: false,
});

export const createRouteMountDiagnosticsState = (): RouteMountDiagnosticsState => ({
  recentSamples: [],
  slowSampleCount: 0,
  worstElapsedMs: 0,
  lastSlowAtUnixMs: null,
});

export const recordPageTransitionWatchdogTimeout = (
  currentState: PageTransitionRecoveryState,
  threshold = PAGE_TRANSITION_TIMEOUT_DISABLE_THRESHOLD,
): PageTransitionRecoveryState => {
  const normalizedThreshold = Number.isFinite(threshold) && threshold > 0
    ? Math.max(1, Math.floor(threshold))
    : PAGE_TRANSITION_TIMEOUT_DISABLE_THRESHOLD;
  const nextTimeoutCount = currentState.timeoutCount + 1;
  return {
    timeoutCount: nextTimeoutCount,
    transitionsDisabled: currentState.transitionsDisabled || nextTimeoutCount >= normalizedThreshold,
  };
};

export const recordRouteMountProbeSample = (
  currentState: RouteMountDiagnosticsState,
  sample: RouteMountProbeSample,
  warnThresholdMs = ROUTE_MOUNT_PROBE_WARN_THRESHOLD_MS,
  maxSamples = ROUTE_MOUNT_PROBE_MAX_SAMPLES,
): RouteMountDiagnosticsState => {
  const normalizedWarnThresholdMs = Number.isFinite(warnThresholdMs) && warnThresholdMs > 0
    ? Math.max(1, Math.floor(warnThresholdMs))
    : ROUTE_MOUNT_PROBE_WARN_THRESHOLD_MS;
  const normalizedMaxSamples = Number.isFinite(maxSamples) && maxSamples > 0
    ? Math.max(1, Math.floor(maxSamples))
    : ROUTE_MOUNT_PROBE_MAX_SAMPLES;
  const nextRecentSamples = currentState.recentSamples.concat(sample).slice(-normalizedMaxSamples);
  const isSlow = sample.elapsedMs >= normalizedWarnThresholdMs;
  return {
    recentSamples: nextRecentSamples,
    slowSampleCount: currentState.slowSampleCount + (isSlow ? 1 : 0),
    worstElapsedMs: Math.max(currentState.worstElapsedMs, sample.elapsedMs),
    lastSlowAtUnixMs: isSlow ? sample.settledAtUnixMs : currentState.lastSlowAtUnixMs,
  };
};

export const getRouteSurfaceFromPathname = (pathnameInput: string): RouteSurface => {
  const pathname = pathnameInput.trim() || "/";
  if (pathname === "/") {
    return "chats";
  }
  if (startsWithPathSegment(pathname, "/network")) {
    return "network";
  }
  if (startsWithPathSegment(pathname, "/groups")) {
    return "groups";
  }
  if (startsWithPathSegment(pathname, "/search")) {
    return "search";
  }
  if (startsWithPathSegment(pathname, "/requests")) {
    return "requests";
  }
  if (startsWithPathSegment(pathname, "/settings")) {
    return "settings";
  }
  if (startsWithPathSegment(pathname, "/vault")) {
    return "vault";
  }
  if (startsWithPathSegment(pathname, "/profile") || startsWithPathSegment(pathname, "/profiles")) {
    return "profile";
  }
  if (startsWithPathSegment(pathname, "/invites")) {
    return "invites";
  }
  if (startsWithPathSegment(pathname, "/download")) {
    return "download";
  }
  return "unknown";
};

export const hardNavigate = (href: string): void => {
  window.location.assign(href);
};
