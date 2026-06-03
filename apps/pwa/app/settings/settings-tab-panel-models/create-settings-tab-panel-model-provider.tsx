"use client";

import type { ReactNode } from "react";
import {
  SettingsTabPanelModelContext,
  type SettingsTabPanelModel,
} from "../settings-tab-panel-model-context";

export function createSettingsTabPanelModelProvider(
  useModel: () => SettingsTabPanelModel,
): (props: Readonly<{ children: ReactNode }>) => React.JSX.Element {
  return function SettingsTabPanelModelProvider(props: Readonly<{ children: ReactNode }>) {
    const model = useModel();
    return (
      <SettingsTabPanelModelContext.Provider value={model}>
        {props.children}
      </SettingsTabPanelModelContext.Provider>
    );
  };
}
