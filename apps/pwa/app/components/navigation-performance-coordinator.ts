"use client";

/** Idle window after the last pathname commit before background warm-up may run. */
export const NAVIGATION_QUIESCENCE_MS = 2_000;

/** Rolling window used to detect rapid sidebar switching. */
export const RAPID_NAVIGATION_WINDOW_MS = 900;

/** Navigation intents within the rolling window that enter rapid mode. */
export const RAPID_NAVIGATION_THRESHOLD = 2;

export type NavigationPerformanceSnapshot = Readonly<{
  generation: number;
  pathname: string | null;
  isQuiesced: boolean;
  isRapidNavigationMode: boolean;
  lastNavigationAtUnixMs: number;
}>;

type NavigationPerformanceListener = (snapshot: NavigationPerformanceSnapshot) => void;

type CoordinatorState = {
  generation: number;
  pathname: string | null;
  isQuiesced: boolean;
  isRapidNavigationMode: boolean;
  lastNavigationAtUnixMs: number;
  recentNavigationTimestamps: number[];
  quiescenceTimerId: number | null;
};

const listeners = new Set<NavigationPerformanceListener>();

let coordinatorState: CoordinatorState = {
  generation: 0,
  pathname: null,
  isQuiesced: true,
  isRapidNavigationMode: false,
  lastNavigationAtUnixMs: 0,
  recentNavigationTimestamps: [],
  quiescenceTimerId: null,
};

const toSnapshot = (state: CoordinatorState): NavigationPerformanceSnapshot => ({
  generation: state.generation,
  pathname: state.pathname,
  isQuiesced: state.isQuiesced,
  isRapidNavigationMode: state.isRapidNavigationMode,
  lastNavigationAtUnixMs: state.lastNavigationAtUnixMs,
});

const emit = (): void => {
  const snapshot = toSnapshot(coordinatorState);
  listeners.forEach((listener) => {
    listener(snapshot);
  });
};

const clearQuiescenceTimer = (): void => {
  const timerId = coordinatorState.quiescenceTimerId;
  if (typeof timerId === "number" && typeof window !== "undefined") {
    window.clearTimeout(timerId);
  }
  coordinatorState = {
    ...coordinatorState,
    quiescenceTimerId: null,
  };
};

const scheduleQuiescence = (): void => {
  clearQuiescenceTimer();
  if (typeof window === "undefined") {
    coordinatorState = {
      ...coordinatorState,
      isQuiesced: true,
      isRapidNavigationMode: false,
      recentNavigationTimestamps: [],
    };
    emit();
    return;
  }

  coordinatorState = {
    ...coordinatorState,
    isQuiesced: false,
  };
  emit();

  const timerId = window.setTimeout(() => {
    coordinatorState = {
      ...coordinatorState,
      quiescenceTimerId: null,
      isQuiesced: true,
      isRapidNavigationMode: false,
      recentNavigationTimestamps: [],
    };
    emit();
  }, NAVIGATION_QUIESCENCE_MS);

  coordinatorState = {
    ...coordinatorState,
    quiescenceTimerId: timerId,
  };
};

export const getNavigationPerformanceSnapshot = (): NavigationPerformanceSnapshot => (
  toSnapshot(coordinatorState)
);

export const recordNavigationIntent = (targetHref: string): void => {
  const now = Date.now();
  const trimmedTarget = targetHref.trim();
  if (!trimmedTarget) {
    return;
  }

  const recentNavigationTimestamps = [
    ...coordinatorState.recentNavigationTimestamps.filter(
      (timestamp) => now - timestamp < RAPID_NAVIGATION_WINDOW_MS,
    ),
    now,
  ];

  coordinatorState = {
    ...coordinatorState,
    generation: coordinatorState.generation + 1,
    isQuiesced: false,
    isRapidNavigationMode: recentNavigationTimestamps.length >= RAPID_NAVIGATION_THRESHOLD,
    lastNavigationAtUnixMs: now,
    recentNavigationTimestamps,
  };
  clearQuiescenceTimer();
  emit();
};

export const recordPathnameCommitted = (pathname: string): void => {
  coordinatorState = {
    ...coordinatorState,
    pathname: pathname.trim() || "/",
  };
  scheduleQuiescence();
};

export const shouldRunBackgroundNavigationWarmup = (): boolean => (
  coordinatorState.isQuiesced && !coordinatorState.isRapidNavigationMode
);

export const isRapidNavigationMode = (): boolean => coordinatorState.isRapidNavigationMode;

export const subscribeNavigationPerformance = (
  listener: NavigationPerformanceListener,
): (() => void) => {
  listeners.add(listener);
  listener(toSnapshot(coordinatorState));
  return (): void => {
    listeners.delete(listener);
  };
};

export const createNavigationGenerationGuard = (): Readonly<{
  generation: number;
  isStale: () => boolean;
}> => {
  const generation = coordinatorState.generation;
  return {
    generation,
    isStale: (): boolean => coordinatorState.generation !== generation,
  };
};

/** Test-only reset. */
export const resetNavigationPerformanceCoordinatorForTests = (): void => {
  clearQuiescenceTimer();
  coordinatorState = {
    generation: 0,
    pathname: null,
    isQuiesced: true,
    isRapidNavigationMode: false,
    lastNavigationAtUnixMs: 0,
    recentNavigationTimestamps: [],
    quiescenceTimerId: null,
  };
  listeners.clear();
};
