"use client";

import { createSettingsTabPanelModelProvider } from "./create-settings-tab-panel-model-provider";
import { usePrivacySettingsModel } from "./use-privacy-settings-model";

export const PrivacySettingsTabPanelModelProvider = createSettingsTabPanelModelProvider(
  usePrivacySettingsModel,
);
