"use client";

import { useMemo, type ReactNode } from "react";
import {
  SettingsTabPanelModelContext,
  type SettingsTabPanelModel,
} from "../settings-tab-panel-model-context";
import { useSettingsSharedModel } from "./use-settings-shared-model";

export function createSettingsTabPanelModelProvider(
  useTabModel: () => SettingsTabPanelModel,
): (props: Readonly<{ children: ReactNode }>) => React.JSX.Element {
  return function SettingsTabPanelModelProvider(props: Readonly<{ children: ReactNode }>) {
    const shared = useSettingsSharedModel();
    const tab = useTabModel();
    const model = useMemo(
      (): SettingsTabPanelModel => ({ ...shared, ...tab }),
      [shared, tab],
    );

    return (
      <SettingsTabPanelModelContext.Provider value={model}>
        {props.children}
      </SettingsTabPanelModelContext.Provider>
    );
  };
}
