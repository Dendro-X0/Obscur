"use client";

import { createSettingsTabPanelModelProvider } from "./create-settings-tab-panel-model-provider";
import { useSecuritySettingsModel } from "./use-security-settings-model";

export const SecuritySettingsTabPanelModelProvider = createSettingsTabPanelModelProvider(
  useSecuritySettingsModel,
);
