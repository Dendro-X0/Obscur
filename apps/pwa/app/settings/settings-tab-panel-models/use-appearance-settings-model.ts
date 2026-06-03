"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@dweb/ui-kit";
import { useTheme } from "@/app/features/settings/hooks/use-theme";
import { useAccessibilityPreferences } from "@/app/features/settings/hooks/use-accessibility-preferences";
import type { SettingsActionPhase } from "@/app/features/settings/components/settings-action-status";
import type { SettingsTabPanelModel } from "../settings-tab-panel-model-context";
import {
  APP_VERSION,
  DEFAULT_APP_LANGUAGE,
  DEFAULT_THEME_PREFERENCE,
  TEXT_SCALE_OPTIONS,
} from "../settings-tab-panel-shared";

export function useAppearanceSettingsModel(): SettingsTabPanelModel {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const accessibility = useAccessibilityPreferences();
  const [appearanceActionPhase, setAppearanceActionPhase] = useState<SettingsActionPhase>("idle");
  const [appearanceActionMessage, setAppearanceActionMessage] = useState<string>("");

  const handleResetLanguage = async (): Promise<void> => {
    if (i18n.language === DEFAULT_APP_LANGUAGE) {
      setAppearanceActionPhase("success");
      setAppearanceActionMessage("Language is already set to default.");
      return;
    }
    setAppearanceActionPhase("working");
    setAppearanceActionMessage("Resetting language...");
    await i18n.changeLanguage(DEFAULT_APP_LANGUAGE);
    setAppearanceActionPhase("success");
    setAppearanceActionMessage("Language reset to English.");
    toast.success("Language reset to default.");
  };

  const handleResetTheme = (): void => {
    if (theme.preference === DEFAULT_THEME_PREFERENCE) {
      setAppearanceActionPhase("success");
      setAppearanceActionMessage("Theme is already set to system default.");
      return;
    }
    setAppearanceActionPhase("working");
    setAppearanceActionMessage("Resetting theme...");
    theme.setPreference(DEFAULT_THEME_PREFERENCE);
    setAppearanceActionPhase("success");
    setAppearanceActionMessage("Theme reset to system default.");
    toast.success("Theme reset to default.");
  };

  const handleResetAccessibility = (): void => {
    accessibility.reset();
    setAppearanceActionPhase("success");
    setAppearanceActionMessage("Accessibility options reset to default.");
    toast.success("Accessibility options reset.");
  };

  return {
    APP_VERSION,
    TEXT_SCALE_OPTIONS,
    accessibility,
    appearanceActionMessage,
    appearanceActionPhase,
    handleResetAccessibility,
    handleResetLanguage,
    handleResetTheme,
    i18n,
    setAppearanceActionMessage,
    setAppearanceActionPhase,
    t,
    theme,
  };
}
