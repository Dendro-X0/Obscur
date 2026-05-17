"use client";

import { useEffect } from "react";
import { useIsDesktop } from "@/app/features/desktop/hooks/use-tauri";

/**
 * Provider that adds desktop-mode class to body and manages desktop-specific behavior
 */
export function DesktopModeProvider({ children }: { children: React.ReactNode }) {
  const isDesktop = useIsDesktop();
  const forceDesktopShell = process.env.NEXT_PUBLIC_DESKTOP_SHELL === "1" || process.env.NEXT_PUBLIC_DESKTOP_SHELL === "true";
  const shouldEnableDesktopMode = forceDesktopShell || isDesktop;

  useEffect(() => {
    if (shouldEnableDesktopMode) {
      document.body.classList.add("desktop-mode");
      document.documentElement.classList.add("desktop-mode");
      
      // Hide PWA install prompts in desktop mode
      const style = document.createElement("style");
      style.id = "desktop-mode-styles";
      style.textContent = `
        .desktop-mode .pwa-install-prompt {
          display: none !important;
        }
      `;
      document.head.appendChild(style);

      return () => {
        document.body.classList.remove("desktop-mode");
        document.documentElement.classList.remove("desktop-mode");
        const styleEl = document.getElementById("desktop-mode-styles");
        if (styleEl) {
          styleEl.remove();
        }
      };
    }
  }, [shouldEnableDesktopMode]);

  return <>{children}</>;
}
