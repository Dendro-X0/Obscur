"use client";

import { useEffect } from "react";
import { useIsDesktop } from "../../lib/desktop/use-tauri";

/**
 * Provider that adds desktop-mode class to body and manages desktop-specific behavior
 */
export function DesktopModeProvider({ children }: { children: React.ReactNode }) {
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (isDesktop) {
      document.body.classList.add("desktop-mode");
      
      // Hide PWA install prompts in desktop mode
      const style = document.createElement("style");
      style.id = "desktop-mode-styles";
      style.textContent = `
        .desktop-mode .pwa-install-prompt {
          display: none !important;
        }
        .desktop-mode {
          user-select: text;
        }
      `;
      document.head.appendChild(style);

      return () => {
        document.body.classList.remove("desktop-mode");
        const styleEl = document.getElementById("desktop-mode-styles");
        if (styleEl) {
          styleEl.remove();
        }
      };
    }
  }, [isDesktop]);

  return <>{children}</>;
}
