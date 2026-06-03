import type { ComponentType, ReactNode } from "react";
import type { SettingsTabId } from "@/app/features/settings/services/settings-search-index";

type SettingsTabPanelModelProviderComponent = ComponentType<Readonly<{ children: ReactNode }>>;

export const settingsTabPanelModelProviderLoaders: Record<
  SettingsTabId,
  () => Promise<{ default: SettingsTabPanelModelProviderComponent }>
> = {
  profile: () => import("./profile-settings-tab-panel-model-provider").then((module) => ({
    default: module.ProfileSettingsTabPanelModelProvider,
  })),
  identity: () => import("./identity-settings-tab-panel-model-provider").then((module) => ({
    default: module.IdentitySettingsTabPanelModelProvider,
  })),
  security: () => import("./security-settings-tab-panel-model-provider").then((module) => ({
    default: module.SecuritySettingsTabPanelModelProvider,
  })),
  relays: () => import("./relays-settings-tab-panel-model-provider").then((module) => ({
    default: module.RelaysSettingsTabPanelModelProvider,
  })),
  storage: () => import("./storage-settings-tab-panel-model-provider").then((module) => ({
    default: module.StorageSettingsTabPanelModelProvider,
  })),
  appearance: () => import("./appearance-settings-tab-panel-model-provider").then((module) => ({
    default: module.AppearanceSettingsTabPanelModelProvider,
  })),
  notifications: () => import("./notifications-settings-tab-panel-model-provider").then((module) => ({
    default: module.NotificationsSettingsTabPanelModelProvider,
  })),
  blocklist: () => import("./blocklist-settings-tab-panel-model-provider").then((module) => ({
    default: module.BlocklistSettingsTabPanelModelProvider,
  })),
  privacy: () => import("./privacy-settings-tab-panel-model-provider").then((module) => ({
    default: module.PrivacySettingsTabPanelModelProvider,
  })),
  updates: () => import("./updates-settings-tab-panel-model-provider").then((module) => ({
    default: module.UpdatesSettingsTabPanelModelProvider,
  })),
};

export type { SettingsTabPanelModelProviderComponent };
