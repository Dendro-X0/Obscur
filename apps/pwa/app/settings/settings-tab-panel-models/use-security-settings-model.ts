"use client";

import { useTranslation } from "react-i18next";
import { useAppLockAction } from "@/app/features/auth/hooks/use-app-lock-action";
import type { SettingsActionPhase } from "@/app/features/settings/components/settings-action-status";
import type { SettingsTabPanelModel } from "../settings-tab-panel-model-context";
import { usePrivacySettingsCore } from "./use-privacy-settings-model";
import { useSettingsDestructiveActionsModel } from "./use-settings-destructive-actions-model";

export function useSecuritySettingsModel(): SettingsTabPanelModel {
  const { t } = useTranslation();
  const { lockApp } = useAppLockAction();
  const privacy = usePrivacySettingsCore();
  const destructive = useSettingsDestructiveActionsModel();

  const handleLockNow = (): void => {
    void lockApp().then(() => {
      (destructive.setSecurityActionPhase as (phase: SettingsActionPhase) => void)("success");
      (destructive.setSecurityActionMessage as (message: string) => void)(t("settings.security.lockedToast"));
    });
  };

  return {
    ...destructive,
    handleLockNow,
    securityCapabilityStates: privacy.securityCapabilityStates,
    securityPosture: privacy.securityPosture,
    t,
  };
}
