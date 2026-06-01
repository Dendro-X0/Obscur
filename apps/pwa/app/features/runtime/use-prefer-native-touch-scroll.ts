"use client";

import { useSyncExternalStore } from "react";
import { isMobileShellProduct } from "@/app/features/runtime/shell-contract";
import { getPreferNativeTouchScrollSnapshot } from "@/app/features/runtime/use-prefer-native-touch-scroll.snapshot";

const COARSE_POINTER_QUERY = "(pointer: coarse)";

const subscribePreferNativeTouchScroll = (onStoreChange: () => void): (() => void) => {
  if (typeof window === "undefined") {
    return (): void => {};
  }
  const mediaQuery = window.matchMedia(COARSE_POINTER_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);
  return (): void => {
    mediaQuery.removeEventListener("change", onStoreChange);
  };
};

const getServerSnapshot = (): boolean => isMobileShellProduct();

export { getPreferNativeTouchScrollSnapshot };

/**
 * True when vertical pan should use native overflow scrolling (mobile shell / touch devices).
 * Disables Framer drag-on-scroll-container patterns that block touch scroll in WebView.
 */
export function usePreferNativeTouchScroll(): boolean {
  return useSyncExternalStore(
    subscribePreferNativeTouchScroll,
    getPreferNativeTouchScrollSnapshot,
    getServerSnapshot,
  );
}
