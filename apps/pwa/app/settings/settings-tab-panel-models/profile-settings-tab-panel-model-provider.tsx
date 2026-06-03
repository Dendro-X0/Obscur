"use client";

import { createSettingsTabPanelModelProvider } from "./create-settings-tab-panel-model-provider";
import { useProfileSettingsModel } from "./use-profile-settings-model";

export const ProfileSettingsTabPanelModelProvider = createSettingsTabPanelModelProvider(
  useProfileSettingsModel,
);
