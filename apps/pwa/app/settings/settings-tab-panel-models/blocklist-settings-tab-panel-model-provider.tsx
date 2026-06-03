"use client";

import { createSettingsTabPanelModelProvider } from "./create-settings-tab-panel-model-provider";
import { useBlocklistSettingsModel } from "./use-blocklist-settings-model";

export const BlocklistSettingsTabPanelModelProvider = createSettingsTabPanelModelProvider(
  useBlocklistSettingsModel,
);
