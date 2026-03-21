export type PageTransitionRecoveryState = Readonly<{
  timeoutCount: number;
  transitionsDisabled: boolean;
}>;

export const PAGE_TRANSITION_WATCHDOG_MS = 1800;
export const PAGE_TRANSITION_TIMEOUT_DISABLE_THRESHOLD = 3;

export const createPageTransitionRecoveryState = (): PageTransitionRecoveryState => ({
  timeoutCount: 0,
  transitionsDisabled: false,
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

export const hardNavigate = (href: string): void => {
  window.location.assign(href);
};
