"use client";

import { useLayoutEffect } from "react";
import { useGlobalNavigationLoadingActions } from "./global-navigation-loading-provider";

/** Signals dynamic import / Suspense loading to the global top bar. */
export function GlobalNavigationChunkLoadingBoundary(): null {
  const { beginChunkLoad, endChunkLoad } = useGlobalNavigationLoadingActions();

  useLayoutEffect((): (() => void) => {
    beginChunkLoad();
    return endChunkLoad;
  }, [beginChunkLoad, endChunkLoad]);

  return null;
}
