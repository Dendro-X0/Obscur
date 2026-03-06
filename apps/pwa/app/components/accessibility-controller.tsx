"use client";

import { useEffect } from "react";
import { useAccessibilityPreferences } from "@/app/features/settings/hooks/use-accessibility-preferences";

const AccessibilityController = (): React.JSX.Element | null => {
  const { preferences } = useAccessibilityPreferences();

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    root.style.setProperty("--app-text-scale", `${preferences.textScale}%`);
    root.classList.toggle("reduce-motion", preferences.reducedMotion);
    root.classList.toggle("contrast-assist", preferences.contrastAssist);
  }, [preferences.textScale, preferences.reducedMotion, preferences.contrastAssist]);

  return null;
};

export { AccessibilityController };
