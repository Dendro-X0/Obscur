export const GLOBAL_NAV_LOADING_MIN_VISIBLE_MS = 280;
export const GLOBAL_NAV_LOADING_MAX_ACTIVE_MS = 45_000;
export const GLOBAL_NAV_LOADING_COMPLETE_HOLD_MS = 220;

export type GlobalNavLoadingRenderState = Readonly<{
  visible: boolean;
  progress: number;
  completing: boolean;
}>;

export type GlobalNavLoadingControllerState = Readonly<{
  active: boolean;
  visible: boolean;
  progress: number;
  completing: boolean;
  chunkLoadCount: number;
  beganAtMs: number;
  targetPathname: string | null;
}>;

export const createGlobalNavLoadingControllerState = (): GlobalNavLoadingControllerState => ({
  active: false,
  visible: false,
  progress: 0,
  completing: false,
  chunkLoadCount: 0,
  beganAtMs: 0,
  targetPathname: null,
});

export const normalizeInternalNavigationHref = (
  href: string,
  origin: string,
): string | null => {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }
  if (
    trimmed.startsWith("mailto:")
    || trimmed.startsWith("tel:")
    || trimmed.startsWith("javascript:")
  ) {
    return null;
  }
  try {
    const url = new URL(trimmed, origin);
    if (url.origin !== origin) {
      return null;
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
};

const clampProgress = (value: number): number => Math.min(96, Math.max(0, value));

export const beginGlobalNavLoading = (
  state: GlobalNavLoadingControllerState,
  nowMs: number,
  targetPathname: string | null = null,
): GlobalNavLoadingControllerState => {
  const nextProgress = state.active
    ? clampProgress(Math.max(state.progress, 12))
    : 12;

  return {
    ...state,
    active: true,
    visible: true,
    completing: false,
    progress: nextProgress,
    beganAtMs: state.active ? state.beganAtMs : nowMs,
    targetPathname: targetPathname ?? state.targetPathname,
  };
};

export const incrementGlobalNavChunkLoad = (
  state: GlobalNavLoadingControllerState,
  nowMs: number,
): GlobalNavLoadingControllerState => beginGlobalNavLoading(
  {
    ...state,
    chunkLoadCount: state.chunkLoadCount + 1,
  },
  nowMs,
);

export const decrementGlobalNavChunkLoad = (
  state: GlobalNavLoadingControllerState,
): GlobalNavLoadingControllerState => ({
  ...state,
  chunkLoadCount: Math.max(0, state.chunkLoadCount - 1),
});

export const tickGlobalNavLoadingProgress = (
  state: GlobalNavLoadingControllerState,
): GlobalNavLoadingControllerState => {
  if (!state.active || state.completing) {
    return state;
  }
  const headroom = 96 - state.progress;
  if (headroom <= 0.5) {
    return state;
  }
  const delta = Math.max(0.6, headroom * 0.08);
  return {
    ...state,
    progress: clampProgress(state.progress + delta),
  };
};

export const canSettleGlobalNavLoading = (
  state: GlobalNavLoadingControllerState,
  nowMs: number,
): boolean => {
  if (!state.active || state.chunkLoadCount > 0) {
    return false;
  }
  const elapsedMs = Math.max(0, nowMs - state.beganAtMs);
  return elapsedMs >= GLOBAL_NAV_LOADING_MIN_VISIBLE_MS;
};

export const startGlobalNavLoadingComplete = (
  state: GlobalNavLoadingControllerState,
): GlobalNavLoadingControllerState => ({
  ...state,
  active: false,
  completing: true,
  progress: 100,
  targetPathname: null,
});

export const hideGlobalNavLoading = (
  state: GlobalNavLoadingControllerState,
): GlobalNavLoadingControllerState => ({
  ...createGlobalNavLoadingControllerState(),
});

export const shouldForceCompleteGlobalNavLoading = (
  state: GlobalNavLoadingControllerState,
  nowMs: number,
): boolean => {
  if (!state.active) {
    return false;
  }
  return Math.max(0, nowMs - state.beganAtMs) >= GLOBAL_NAV_LOADING_MAX_ACTIVE_MS;
};

export const toGlobalNavLoadingRenderState = (
  state: GlobalNavLoadingControllerState,
): GlobalNavLoadingRenderState => ({
  visible: state.visible,
  progress: state.progress,
  completing: state.completing,
});
