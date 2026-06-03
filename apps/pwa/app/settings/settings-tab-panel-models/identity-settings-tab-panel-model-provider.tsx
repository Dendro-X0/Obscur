"use client";

import { createSettingsTabPanelModelProvider } from "./create-settings-tab-panel-model-provider";
import { useIdentitySettingsModel } from "./use-identity-settings-model";

export const IdentitySettingsTabPanelModelProvider = createSettingsTabPanelModelProvider(
  useIdentitySettingsModel,
);
