"use client";

import { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import { isMobileShellProduct } from "@/app/features/runtime/shell-contract";
import { getRuntimeCapabilities } from "@/app/features/runtime/runtime-capabilities";

/**
 * Applies mobile-shell body classes and motion defaults for Tauri Android/iOS bundles.
 */
export function MobileModeProvider({ children }: { children: React.ReactNode }) {
  const mobileShellBuild = isMobileShellProduct();
  const nativeMobile = getRuntimeCapabilities().isMobile;
  const shouldEnableMobileMode = mobileShellBuild || nativeMobile;

  useEffect(() => {
    if (!shouldEnableMobileMode) {
      return;
    }
    document.body.classList.add("mobile-mode");
    document.documentElement.classList.add("mobile-mode");
    return () => {
      document.body.classList.remove("mobile-mode");
      document.documentElement.classList.remove("mobile-mode");
    };
  }, [shouldEnableMobileMode]);

  return (
    <MotionConfig reducedMotion={shouldEnableMobileMode ? "user" : "user"}>
      {children}
    </MotionConfig>
  );
}
