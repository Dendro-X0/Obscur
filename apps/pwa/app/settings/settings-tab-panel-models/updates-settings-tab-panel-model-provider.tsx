"use client";

import { createSettingsTabPanelModelProvider } from "./create-settings-tab-panel-model-provider";
import { useUpdatesSettingsModel } from "./use-updates-settings-model";

export const UpdatesSettingsTabPanelModelProvider = createSettingsTabPanelModelProvider(
  useUpdatesSettingsModel,
);
