"use client";

import { createSettingsTabPanelModelProvider } from "./create-settings-tab-panel-model-provider";
import { useStorageSettingsModel } from "./use-storage-settings-model";

export const StorageSettingsTabPanelModelProvider = createSettingsTabPanelModelProvider(
  useStorageSettingsModel,
);
