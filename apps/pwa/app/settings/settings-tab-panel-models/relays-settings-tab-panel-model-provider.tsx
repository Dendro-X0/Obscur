"use client";

import { createSettingsTabPanelModelProvider } from "./create-settings-tab-panel-model-provider";
import { useRelaysSettingsModel } from "./use-relays-settings-model";

export const RelaysSettingsTabPanelModelProvider = createSettingsTabPanelModelProvider(
  useRelaysSettingsModel,
);
