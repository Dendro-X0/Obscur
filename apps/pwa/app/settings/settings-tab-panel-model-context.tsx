"use client";

import { createContext, useContext, type ReactNode } from "react";

export type SettingsTabPanelModel = Record<string, unknown>;

const SettingsTabPanelModelContext = createContext<SettingsTabPanelModel | null>(null);

export { SettingsTabPanelModelContext };

export function useSettingsTabPanelModel(): SettingsTabPanelModel {
  const model = useContext(SettingsTabPanelModelContext);
  if (!model) {
    throw new Error("useSettingsTabPanelModel must be used within SettingsTabPanelModelProvider");
  }
  return model;
}
