"use client";

import { useEffect, useState } from "react";
import { useTauri } from "./use-tauri";
import { useTheme } from "../../settings/hooks/use-theme";

/**
 * Hook to integrate desktop system theme with PWA theme system
 * Automatically syncs system theme when preference is set to "system"
 */
export function useDesktopTheme() {
  const { isDesktop, api } = useTauri();
  const { preference, setPreference } = useTheme();
  const [systemTheme, setSystemTheme] = useState<"light" | "dark" | null>(null);

  // Get initial system theme
  useEffect(() => {
    if (!isDesktop) return;

    const getInitialTheme = async () => {
      const theme = await api.theme.getTheme();
      setSystemTheme(theme);
    };

    getInitialTheme();
  }, [isDesktop, api]);

  // Listen for system theme changes
  useEffect(() => {
    if (!isDesktop || preference !== "system") return;

    let cleanup: (() => void) | null = null;

    const setupListener = async () => {
      cleanup = await api.theme.onThemeChanged((theme) => {
        setSystemTheme(theme);
      });
    };

    setupListener();

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [isDesktop, preference, api]);

  // Compute effective theme
  const effectiveTheme =
    preference === "system" ? systemTheme ?? "light" : preference === "dark" ? "dark" : "light";

  return {
    preference,
    setPreference,
    systemTheme,
    effectiveTheme,
    isDesktop,
  };
}
