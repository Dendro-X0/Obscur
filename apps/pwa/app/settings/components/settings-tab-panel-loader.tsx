"use client";

import { useMemo } from "react";
import type React from "react";
import dynamic from "next/dynamic";
import type { SettingsTabId } from "@/app/features/settings/services/settings-search-index";
import { settingsTabPanelModelProviderLoaders } from "../settings-tab-panel-models/settings-tab-panel-model-provider-registry";
import { RouteLoadingFallback } from "@/app/components/experience";
import { SettingsTabPanelErrorBoundary } from "./settings-tab-panel-error-boundary";

const settingsTabPanelLoading = (): React.JSX.Element => (
  <RouteLoadingFallback
    title="Loading settings"
    detail="Preparing panel..."
    className="min-h-[12rem]"
  />
);

const panelLoaders = {
  profile: dynamic(() => import("../panels/profile-settings-tab-panel"), {
    loading: settingsTabPanelLoading,
  }),
  appearance: dynamic(() => import("../panels/appearance-settings-tab-panel"), {
    loading: settingsTabPanelLoading,
  }),
  notifications: dynamic(() => import("../panels/notifications-settings-tab-panel"), {
    loading: settingsTabPanelLoading,
  }),
  identity: dynamic(() => import("../panels/identity-settings-tab-panel"), {
    loading: settingsTabPanelLoading,
  }),
  security: dynamic(() => import("../panels/security-settings-tab-panel"), {
    loading: settingsTabPanelLoading,
  }),
  relays: dynamic(() => import("../panels/relays-settings-tab-panel"), {
    loading: settingsTabPanelLoading,
  }),
  storage: dynamic(() => import("../panels/storage-settings-tab-panel"), {
    loading: settingsTabPanelLoading,
  }),
  blocklist: dynamic(() => import("../panels/blocklist-settings-tab-panel"), {
    loading: settingsTabPanelLoading,
  }),
  privacy: dynamic(() => import("../panels/privacy-settings-tab-panel"), {
    loading: settingsTabPanelLoading,
  }),
  updates: dynamic(() => import("../panels/updates-settings-tab-panel"), {
    loading: settingsTabPanelLoading,
  }),
} as const satisfies Record<SettingsTabId, ReturnType<typeof dynamic>>;

export function SettingsTabPanel(props: Readonly<{ activeTab: SettingsTabId }>): React.JSX.Element {
  const ModelProvider = useMemo(
    () => dynamic(settingsTabPanelModelProviderLoaders[props.activeTab], {
      loading: settingsTabPanelLoading,
      ssr: false,
    }),
    [props.activeTab],
  );
  const Panel = panelLoaders[props.activeTab] as ReturnType<typeof dynamic>;
  return (
    <div id={`settings-tab-panel-${props.activeTab}`} data-testid={`settings-tab-panel-${props.activeTab}`}>
      <ModelProvider>
        <SettingsTabPanelErrorBoundary tabId={props.activeTab}>
          <Panel />
        </SettingsTabPanelErrorBoundary>
      </ModelProvider>
    </div>
  );
}
