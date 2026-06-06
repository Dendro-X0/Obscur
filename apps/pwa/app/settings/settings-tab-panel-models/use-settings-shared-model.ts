"use client";

import { useMemo } from "react";
import {
  deriveRelayNodeStatus,
  deriveRelayRuntimeStatus,
} from "@/app/features/relays/lib/relay-runtime-status";
import type { SettingsTabPanelModel } from "../settings-tab-panel-model-context";
import { useSettingsRelayRuntimeStatus } from "./use-settings-relay-runtime-status";

/**
 * Cross-tab settings fields — one owner, merged into every tab model provider.
 * Prevents per-tab whack-a-mole when panels read relay runtime helpers/status.
 */
export function useSettingsSharedModel(): SettingsTabPanelModel {
  const relayRuntimeStatus = useSettingsRelayRuntimeStatus();

  return useMemo((): SettingsTabPanelModel => ({
    deriveRelayNodeStatus,
    deriveRelayRuntimeStatus,
    relayRuntimeStatus,
  }), [relayRuntimeStatus]);
}
