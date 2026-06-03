"use client";

import { createSettingsTabPanelModelProvider } from "./create-settings-tab-panel-model-provider";
import { useNotificationsSettingsModel } from "./use-notifications-settings-model";

export const NotificationsSettingsTabPanelModelProvider = createSettingsTabPanelModelProvider(
  useNotificationsSettingsModel,
);
