"use client";

import { useEffect, useState } from "react";
import { useIsDesktop } from "./use-tauri";

/**
 * Hook to manage desktop-specific layout adaptations
 */
export function useDesktopLayout() {
  const isDesktop = useIsDesktop();
  const [windowSize, setWindowSize] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateSize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  return {
    isDesktop,
    windowSize,
    isCompact: windowSize.width < 1024,
    isWide: windowSize.width >= 1400,
  };
}

/**
 * Hook to detect if PWA-specific UI should be hidden
 */
export function useHidePWAUI(): boolean {
  const isDesktop = useIsDesktop();
  return isDesktop;
}
