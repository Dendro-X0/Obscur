"use client";

import { useTranslation } from "react-i18next";
import type { SettingsTabPanelModel } from "../settings-tab-panel-model-context";
import { APP_VERSION } from "../settings-tab-panel-shared";

export function useUpdatesSettingsModel(): SettingsTabPanelModel {
  const { t } = useTranslation();
  return { APP_VERSION, t };
}
