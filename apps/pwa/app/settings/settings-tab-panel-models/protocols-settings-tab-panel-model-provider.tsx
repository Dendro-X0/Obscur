"use client";

import { createSettingsTabPanelModelProvider } from "./create-settings-tab-panel-model-provider";
import { useProtocolsSettingsModel } from "./use-protocols-settings-model";

export const ProtocolsSettingsTabPanelModelProvider = createSettingsTabPanelModelProvider(
  useProtocolsSettingsModel,
);
