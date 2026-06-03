"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { PrivacySettingsService, type PrivacySettings } from "@/app/features/settings/services/privacy-settings-service";
import { getV090RolloutPolicy, normalizeV090Flags } from "@/app/features/settings/services/v090-rollout-policy";
import { getRuntimeCapabilities } from "@/app/features/runtime/runtime-capabilities";
import type { SettingsTabPanelModel } from "../settings-tab-panel-model-context";
import type {
  CapabilityState,
  SecurityPosture,
} from "../settings-tab-panel-shared";

export function usePrivacySettingsModel(): SettingsTabPanelModel {
  const { t } = useTranslation();
  const core = usePrivacySettingsCore();
  return {
    t,
    handleSavePrivacy: core.handleSavePrivacy,
    privacySettings: core.privacySettings,
    rolloutPolicy: core.rolloutPolicy,
    setPrivacySettings: core.setPrivacySettings,
  };
}

export function usePrivacySettingsCore(): Readonly<{
  privacySettings: PrivacySettings;
  setPrivacySettings: Dispatch<SetStateAction<PrivacySettings>>;
  handleSavePrivacy: (newSettings: PrivacySettings) => void;
  rolloutPolicy: ReturnType<typeof getV090RolloutPolicy>;
  securityCapabilityStates: Readonly<{
    clipboard: CapabilityState;
    biometric: CapabilityState;
    tor: CapabilityState;
  }>;
  securityPosture: SecurityPosture;
}> {
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>(() =>
    normalizeV090Flags(PrivacySettingsService.getSettings()),
  );
  const rolloutPolicy = useMemo(() => getV090RolloutPolicy(privacySettings), [privacySettings]);

  const securityCapabilityStates = useMemo<Readonly<{
    clipboard: CapabilityState;
    biometric: CapabilityState;
    tor: CapabilityState;
  }>>(() => {
    const isTauriRuntime = getRuntimeCapabilities().isNativeRuntime;
    const clipboardSupported =
      typeof navigator !== "undefined"
      && !!navigator.clipboard
      && typeof navigator.clipboard.writeText === "function";
    return {
      clipboard: clipboardSupported ? "supported" : "unavailable",
      biometric: isTauriRuntime ? "supported" : "unavailable",
      tor: isTauriRuntime ? "supported" : "unavailable",
    };
  }, []);

  const securityPosture = useMemo<SecurityPosture>(() => {
    const score = [
      privacySettings.encryptStorageAtRest,
      privacySettings.clearClipboardOnLock && securityCapabilityStates.clipboard === "supported",
      privacySettings.autoLockTimeout > 0,
      privacySettings.biometricLockEnabled && securityCapabilityStates.biometric === "supported",
      privacySettings.enableTorProxy && securityCapabilityStates.tor === "supported",
    ].filter(Boolean).length;
    if (score >= 4) return "strong";
    if (score >= 2) return "moderate";
    return "weak";
  }, [privacySettings, securityCapabilityStates]);

  const handleSavePrivacy = (newSettings: PrivacySettings): void => {
    const normalized = normalizeV090Flags(newSettings);
    setPrivacySettings(normalized);
    PrivacySettingsService.saveSettings(normalized);
  };

  return {
    privacySettings,
    setPrivacySettings,
    handleSavePrivacy,
    rolloutPolicy,
    securityCapabilityStates,
    securityPosture,
  };
}
