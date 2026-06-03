"use client";

import { createSettingsTabPanelModelProvider } from "./create-settings-tab-panel-model-provider";
import { useAppearanceSettingsModel } from "./use-appearance-settings-model";

export const AppearanceSettingsTabPanelModelProvider = createSettingsTabPanelModelProvider(
  useAppearanceSettingsModel,
);
