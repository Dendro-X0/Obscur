"use client";

import { useTranslation } from "react-i18next";
import { toast } from "@dweb/ui-kit";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import type { SettingsActionPhase } from "@/app/features/settings/components/settings-action-status";
import type { SettingsTabPanelModel } from "../settings-tab-panel-model-context";
import { usePrivacySettingsCore } from "./use-privacy-settings-model";
import { useSettingsDestructiveActionsModel } from "./use-settings-destructive-actions-model";

export function useSecuritySettingsModel(): SettingsTabPanelModel {
  const { t } = useTranslation();
  const identity = useIdentity();
  const privacy = usePrivacySettingsCore();
  const destructive = useSettingsDestructiveActionsModel();

  const handleLockNow = (): void => {
    identity.lockIdentity();
    (destructive.setSecurityActionPhase as (phase: SettingsActionPhase) => void)("success");
    (destructive.setSecurityActionMessage as (message: string) => void)("Session locked.");
    toast.success("Session locked.");
  };

  return {
    ...destructive,
    handleLockNow,
    securityCapabilityStates: privacy.securityCapabilityStates,
    securityPosture: privacy.securityPosture,
    t,
  };
}
