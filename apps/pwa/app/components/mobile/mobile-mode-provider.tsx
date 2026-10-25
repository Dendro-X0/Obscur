"use client";

import { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import {
  isMobilePreviewBuild,
  isMobileShellProduct,
} from "@/app/features/runtime/shell-contract";
import { getRuntimeCapabilities } from "@/app/features/runtime/runtime-capabilities";

/**
 * Applies mobile-shell body classes and motion defaults for Tauri Android/iOS bundles
 * and the desktop phone-preview harness.
 */
export function MobileModeProvider({ children }: { children: React.ReactNode }) {
  const mobileShellBuild = isMobileShellProduct();
  const mobilePreview = isMobilePreviewBuild();
  const nativeMobile = getRuntimeCapabilities().isMobile;
  const shouldEnableMobileMode = mobileShellBuild || nativeMobile;

  useEffect(() => {
    if (!shouldEnableMobileMode) {
      return;
    }
    document.body.classList.add("mobile-mode");
    document.documentElement.classList.add("mobile-mode");
    if (mobilePreview) {
      const root = document.documentElement;
      root.setAttribute("data-obscur-mobile-preview", "1");
      // Match desktop phone-preview init script; bottom stays 0 (no home-indicator bezel).
      root.style.setProperty("--obscur-safe-area-inset-top", "24px");
      root.style.setProperty("--obscur-safe-area-inset-bottom", "0px");
      root.style.setProperty("--obscur-safe-area-inset-left", "0px");
      root.style.setProperty("--obscur-safe-area-inset-right", "0px");
    }
    return () => {
      document.body.classList.remove("mobile-mode");
      document.documentElement.classList.remove("mobile-mode");
      if (mobilePreview) {
        const root = document.documentElement;
        root.removeAttribute("data-obscur-mobile-preview");
        root.style.removeProperty("--obscur-safe-area-inset-top");
        root.style.removeProperty("--obscur-safe-area-inset-bottom");
        root.style.removeProperty("--obscur-safe-area-inset-left");
        root.style.removeProperty("--obscur-safe-area-inset-right");
      }
    };
  }, [shouldEnableMobileMode, mobilePreview]);

  return (
    <MotionConfig reducedMotion={shouldEnableMobileMode ? "user" : "user"}>
      {children}
    </MotionConfig>
  );
}
