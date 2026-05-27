import type { SettingsTabId } from "./settings-search-index";

export const SETTINGS_SEARCH_PREPARE_EVENT = "obscur:settings-search-prepare";

export type SettingsSearchPrepareDetail = Readonly<{
  entryId: string;
  tab: SettingsTabId;
  elementId?: string;
}>;

export const dispatchSettingsSearchPrepare = (detail: SettingsSearchPrepareDetail): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent<SettingsSearchPrepareDetail>(SETTINGS_SEARCH_PREPARE_EVENT, { detail }));
};
