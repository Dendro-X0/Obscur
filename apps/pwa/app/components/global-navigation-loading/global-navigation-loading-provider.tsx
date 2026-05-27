"use client";

import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { GlobalNavigationLoadingBar } from "./global-navigation-loading-bar";
import {
  beginGlobalNavLoading,
  canSettleGlobalNavLoading,
  createGlobalNavLoadingControllerState,
  decrementGlobalNavChunkLoad,
  GLOBAL_NAV_LOADING_COMPLETE_HOLD_MS,
  GLOBAL_NAV_LOADING_MAX_ACTIVE_MS,
  hideGlobalNavLoading,
  incrementGlobalNavChunkLoad,
  normalizeInternalNavigationHref,
  shouldForceCompleteGlobalNavLoading,
  startGlobalNavLoadingComplete,
  tickGlobalNavLoadingProgress,
  toGlobalNavLoadingRenderState,
  type GlobalNavLoadingControllerState,
  type GlobalNavLoadingRenderState,
} from "./global-navigation-loading-state";

type GlobalNavigationLoadingActions = Readonly<{
  beginNavigation: (targetHref?: string) => void;
  beginChunkLoad: () => void;
  endChunkLoad: () => void;
}>;

const GlobalNavigationLoadingActionsContext = createContext<GlobalNavigationLoadingActions | null>(null);

export function useGlobalNavigationLoadingActions(): GlobalNavigationLoadingActions {
  const context = useContext(GlobalNavigationLoadingActionsContext);
  if (!context) {
    throw new Error("useGlobalNavigationLoadingActions must be used within GlobalNavigationLoadingProvider");
  }
  return context;
}

export function GlobalNavigationLoadingProvider(
  props: Readonly<{ children: React.ReactNode }>,
): React.JSX.Element {
  const pathname = usePathname();
  const [renderState, setRenderState] = useState<GlobalNavLoadingRenderState>(() =>
    toGlobalNavLoadingRenderState(createGlobalNavLoadingControllerState()),
  );

  const controllerRef = useRef<GlobalNavLoadingControllerState>(createGlobalNavLoadingControllerState());
  const settleGenerationRef = useRef(0);
  const progressIntervalIdRef = useRef<number | null>(null);
  const completeTimeoutIdRef = useRef<number | null>(null);
  const maxActiveTimeoutIdRef = useRef<number | null>(null);
  const pathnameRef = useRef(pathname);
  const previousPathnameRef = useRef(pathname);

  const commitController = useCallback((next: GlobalNavLoadingControllerState): void => {
    controllerRef.current = next;
    setRenderState(toGlobalNavLoadingRenderState(next));
  }, []);

  const clearCompleteTimeout = useCallback((): void => {
    const timeoutId = completeTimeoutIdRef.current;
    if (typeof timeoutId === "number") {
      window.clearTimeout(timeoutId);
      completeTimeoutIdRef.current = null;
    }
  }, []);

  const clearMaxActiveTimeout = useCallback((): void => {
    const timeoutId = maxActiveTimeoutIdRef.current;
    if (typeof timeoutId === "number") {
      window.clearTimeout(timeoutId);
      maxActiveTimeoutIdRef.current = null;
    }
  }, []);

  const finishVisibleBar = useCallback((): void => {
    clearCompleteTimeout();
    completeTimeoutIdRef.current = window.setTimeout((): void => {
      commitController(hideGlobalNavLoading(controllerRef.current));
      completeTimeoutIdRef.current = null;
    }, GLOBAL_NAV_LOADING_COMPLETE_HOLD_MS);
  }, [clearCompleteTimeout, commitController]);

  const completeNavigationLoading = useCallback((): void => {
    const current = controllerRef.current;
    if (!current.visible && !current.active) {
      return;
    }
    commitController(startGlobalNavLoadingComplete(current));
    finishVisibleBar();
    clearMaxActiveTimeout();
  }, [clearMaxActiveTimeout, commitController, finishVisibleBar]);

  const scheduleSettle = useCallback((): void => {
    settleGenerationRef.current += 1;
    const generation = settleGenerationRef.current;

    const attemptSettle = (): void => {
      if (settleGenerationRef.current !== generation) {
        return;
      }
      const nowMs = Date.now();
      const current = controllerRef.current;
      if (shouldForceCompleteGlobalNavLoading(current, nowMs)) {
        completeNavigationLoading();
        return;
      }
      if (canSettleGlobalNavLoading(current, nowMs)) {
        completeNavigationLoading();
      } else {
        window.requestAnimationFrame(attemptSettle);
      }
    };

    window.requestAnimationFrame((): void => {
      window.requestAnimationFrame(attemptSettle);
    });
  }, [completeNavigationLoading]);

  const armMaxActiveTimeout = useCallback((): void => {
    clearMaxActiveTimeout();
    maxActiveTimeoutIdRef.current = window.setTimeout((): void => {
      if (controllerRef.current.active) {
        completeNavigationLoading();
      }
      maxActiveTimeoutIdRef.current = null;
    }, GLOBAL_NAV_LOADING_MAX_ACTIVE_MS);
  }, [clearMaxActiveTimeout, completeNavigationLoading]);

  const beginNavigation = useCallback((targetHref?: string): void => {
    const nowMs = Date.now();
    const normalized = typeof targetHref === "string" && typeof window !== "undefined"
      ? normalizeInternalNavigationHref(targetHref, window.location.origin)
      : null;
    if (normalized && normalized === pathnameRef.current) {
      return;
    }
    clearCompleteTimeout();
    commitController(beginGlobalNavLoading(controllerRef.current, nowMs, normalized));
    armMaxActiveTimeout();
    scheduleSettle();
  }, [armMaxActiveTimeout, clearCompleteTimeout, commitController, scheduleSettle]);

  const beginChunkLoad = useCallback((): void => {
    const nowMs = Date.now();
    clearCompleteTimeout();
    commitController(incrementGlobalNavChunkLoad(controllerRef.current, nowMs));
    armMaxActiveTimeout();
  }, [armMaxActiveTimeout, clearCompleteTimeout, commitController]);

  const endChunkLoad = useCallback((): void => {
    commitController(decrementGlobalNavChunkLoad(controllerRef.current));
    scheduleSettle();
  }, [commitController, scheduleSettle]);

  const actions = useMemo<GlobalNavigationLoadingActions>(() => ({
    beginNavigation,
    beginChunkLoad,
    endChunkLoad,
  }), [beginNavigation, beginChunkLoad, endChunkLoad]);

  useEffect((): void => {
    pathnameRef.current = pathname;
    const previousPathname = previousPathnameRef.current;
    if (previousPathname !== pathname) {
      previousPathnameRef.current = pathname;
      if (!controllerRef.current.active) {
        const nowMs = Date.now();
        commitController(beginGlobalNavLoading(controllerRef.current, nowMs, pathname));
        armMaxActiveTimeout();
      }
    }
    scheduleSettle();
  }, [armMaxActiveTimeout, commitController, pathname, scheduleSettle]);

  useEffect((): (() => void) => {
    const onDocumentClick = (event: MouseEvent): void => {
      if (event.defaultPrevented) {
        return;
      }
      if (event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }
      const normalized = normalizeInternalNavigationHref(anchor.href, window.location.origin);
      if (!normalized) {
        return;
      }
      beginNavigation(normalized);
    };

    document.addEventListener("click", onDocumentClick, true);
    return (): void => {
      document.removeEventListener("click", onDocumentClick, true);
    };
  }, [beginNavigation]);

  useEffect((): (() => void) => {
    const intervalId = window.setInterval((): void => {
      const current = controllerRef.current;
      if (!current.active) {
        return;
      }
      commitController(tickGlobalNavLoadingProgress(current));
    }, 180);
    progressIntervalIdRef.current = intervalId;
    return (): void => {
      window.clearInterval(intervalId);
      progressIntervalIdRef.current = null;
      clearCompleteTimeout();
      clearMaxActiveTimeout();
    };
  }, [clearCompleteTimeout, clearMaxActiveTimeout, commitController]);

  return (
    <GlobalNavigationLoadingActionsContext.Provider value={actions}>
      {props.children}
      <GlobalNavigationLoadingBar
        visible={renderState.visible}
        progress={renderState.progress}
        completing={renderState.completing}
      />
    </GlobalNavigationLoadingActionsContext.Provider>
  );
}
