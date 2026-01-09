"use client";

import { useEffect } from "react";
import { useTheme } from "../lib/use-theme";

type ThemePreference = "system" | "light" | "dark";

const getSystemPrefersDark = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

const applyThemeClass = (params: Readonly<{ preference: ThemePreference }>): void => {
  if (typeof document === "undefined") {
    return;
  }
  const isDark: boolean = params.preference === "dark" || (params.preference === "system" && getSystemPrefersDark());
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
};

const ThemeController = (): React.JSX.Element | null => {
  const theme = useTheme();
  useEffect((): (() => void) => {
    applyThemeClass({ preference: theme.preference });
    if (typeof window === "undefined") {
      return (): void => {
        return;
      };
    }
    const mediaQuery: MediaQueryList = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (): void => {
      if (theme.preference !== "system") {
        return;
      }
      applyThemeClass({ preference: "system" });
    };
    mediaQuery.addEventListener("change", onChange);
    return (): void => {
      mediaQuery.removeEventListener("change", onChange);
    };
  }, [theme.preference]);
  return null;
};

export { ThemeController };
