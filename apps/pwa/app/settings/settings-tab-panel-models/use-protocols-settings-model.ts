"use client";

import { useTranslation } from "react-i18next";
import type { SettingsTabPanelModel } from "../settings-tab-panel-model-context";

export function useProtocolsSettingsModel(): SettingsTabPanelModel {
  const { t } = useTranslation();
  return { t };
}
