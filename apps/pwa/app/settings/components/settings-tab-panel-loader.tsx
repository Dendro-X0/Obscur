"use client";

import type React from "react";
import dynamic from "next/dynamic";
import type { SettingsTabId } from "@/app/features/settings/services/settings-search-index";
import { GlobalNavigationChunkLoadingBoundary } from "@/app/components/global-navigation-loading";
import { SettingsTabPanelModelProvider } from "../settings-tab-panel-model";

/** Top-level nav bar only — no in-panel loading block while tab chunks load. */
const settingsTabPanelLoading = (): React.JSX.Element => (
  <GlobalNavigationChunkLoadingBoundary />
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
  const Panel = panelLoaders[props.activeTab] as ReturnType<typeof dynamic>;
  return (
    <div id={`settings-tab-panel-${props.activeTab}`} data-testid={`settings-tab-panel-${props.activeTab}`}>
      <SettingsTabPanelModelProvider activeTab={props.activeTab}>
        <Panel />
      </SettingsTabPanelModelProvider>
    </div>
  );
}
