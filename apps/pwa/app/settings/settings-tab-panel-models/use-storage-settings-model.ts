"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@dweb/ui-kit";
import type { Nip96Config } from "@/app/features/messaging/lib/nip96-upload-service";
import { getNip96StorageKey } from "@/app/features/messaging/lib/nip96-upload-service";
import {
  getLocalMediaStorageConfig,
  getLocalMediaStorageAbsolutePath,
  saveLocalMediaStorageConfig,
  DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG,
  type LocalMediaStorageConfig,
} from "@/app/features/vault/services/local-media-store";
import {
  checkStorageHealth,
  getLastStorageHealthState,
  runStorageRecovery,
  type StorageHealthState,
} from "@/app/features/messaging/services/storage-health-service";
import { getReliabilityMetricsSnapshot, getReliabilityRuntimeSnapshot } from "@/app/shared/reliability-observability";
import { scheduleIdleWork } from "@/app/shared/schedule-idle-work";
import { getRuntimeCapabilities } from "@/app/features/runtime/runtime-capabilities";
import { relayResilienceObservability } from "@/app/features/relays/services/relay-resilience-observability";
import type { SettingsActionPhase } from "@/app/features/settings/components/settings-action-status";
import type { SettingsTabPanelModel } from "../settings-tab-panel-model-context";
import {
  deriveStorageMode,
  deriveStorageStats,
  type StorageMode,
  type StorageStats,
} from "../settings-tab-panel-shared";
import { usePrivacySettingsCore } from "./use-privacy-settings-model";
import { useSettingsDestructiveActionsModel } from "./use-settings-destructive-actions-model";

export function useStorageSettingsModel(): SettingsTabPanelModel {
  const { t } = useTranslation();
  const privacy = usePrivacySettingsCore();
  const destructive = useSettingsDestructiveActionsModel();

  const [nip96Config, setNip96Config] = useState<Nip96Config>(() => {
    const fallback: Nip96Config = { apiUrl: "", enabled: false };
    const rewriteLegacyNip96Url = (value: string): string => {
      if (value === "https://nostr.build/api/v2/upload/files") {
        return "https://nostr.build/api/v2/nip96/upload";
      }
      if (value === "https://sovbit.host/api/v2/upload/files") {
        return "https://api.sovbit.host/api/upload/files";
      }
      return value;
    };
    if (typeof window === "undefined") return fallback;
    try {
      const stored = localStorage.getItem(getNip96StorageKey());
      if (stored) {
        const parsed = JSON.parse(stored) as Nip96Config;
        const normalized: Nip96Config = {
          ...parsed,
          apiUrl: typeof parsed.apiUrl === "string" ? rewriteLegacyNip96Url(parsed.apiUrl) : parsed.apiUrl,
          apiUrls: Array.isArray(parsed.apiUrls)
            ? Array.from(new Set(parsed.apiUrls.map((url) => rewriteLegacyNip96Url(url))))
            : parsed.apiUrls,
        };
        localStorage.setItem(getNip96StorageKey(), JSON.stringify(normalized));
        return normalized;
      }
      if (window.location.hostname.includes("vercel.app") || getRuntimeCapabilities().isNativeRuntime) {
        return { apiUrl: "https://nostr.build/api/v2/nip96/upload", enabled: true };
      }
      return fallback;
    } catch {
      return fallback;
    }
  });
  const [localMediaConfig, setLocalMediaConfig] = useState<LocalMediaStorageConfig>(() => getLocalMediaStorageConfig());
  const [localMediaAbsolutePath, setLocalMediaAbsolutePath] = useState<string>("");
  const [isResolvingLocalPath, setIsResolvingLocalPath] = useState<boolean>(false);
  const [storageStatsTick, setStorageStatsTick] = useState<number>(0);
  const [reliabilityTick, setReliabilityTick] = useState<number>(0);
  const [storageHealthState, setStorageHealthState] = useState<StorageHealthState>(() => getLastStorageHealthState());
  const [isCheckingStorageHealth, setIsCheckingStorageHealth] = useState<boolean>(false);
  const [isCheckingProviderReachability, setIsCheckingProviderReachability] = useState<boolean>(false);
  const [providerReachabilityNote, setProviderReachabilityNote] = useState<string>("");
  const [storageActionPhase, setStorageActionPhase] = useState<SettingsActionPhase>("idle");
  const [storageActionMessage, setStorageActionMessage] = useState<string>("");

  const saveNip96Config = (newConfig: Nip96Config): void => {
    setNip96Config(newConfig);
    localStorage.setItem(getNip96StorageKey(), JSON.stringify(newConfig));
  };

  const saveLocalMediaConfig = (newConfig: LocalMediaStorageConfig): void => {
    const normalized = saveLocalMediaStorageConfig(newConfig);
    setLocalMediaConfig(normalized);
    setStorageStatsTick((prev) => prev + 1);
  };

  const refreshLocalMediaAbsolutePath = async (): Promise<void> => {
    setIsResolvingLocalPath(true);
    try {
      const resolved = await getLocalMediaStorageAbsolutePath();
      setLocalMediaAbsolutePath(resolved || "");
    } finally {
      setIsResolvingLocalPath(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const cancelIdle = scheduleIdleWork(() => {
      if (!cancelled) {
        void refreshLocalMediaAbsolutePath();
      }
    });
    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [localMediaConfig.subdir]);

  useEffect(() => {
    let cancelled = false;
    const cancelIdle = scheduleIdleWork(() => {
      if (cancelled) {
        return;
      }
      setStorageStatsTick((prev) => prev + 1);
      void (async () => {
        setIsCheckingStorageHealth(true);
        try {
          const health = await checkStorageHealth();
          if (!cancelled) {
            setStorageHealthState(health);
          }
        } finally {
          if (!cancelled) {
            setIsCheckingStorageHealth(false);
          }
        }
      })();
    });
    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const timer = window.setInterval(() => {
      setReliabilityTick((prev) => prev + 1);
    }, 3_000);
    return () => window.clearInterval(timer);
  }, []);

  const storageMode = useMemo<StorageMode>(
    () => deriveStorageMode(nip96Config.enabled, localMediaConfig.enabled),
    [localMediaConfig.enabled, nip96Config.enabled],
  );

  const storageStats = useMemo<StorageStats>(() => deriveStorageStats(), [storageStatsTick]);
  const reliabilityMetrics = useMemo(
    () => getReliabilityMetricsSnapshot(),
    [reliabilityTick, storageStatsTick, storageHealthState.checkedAtUnixMs],
  );
  const reliabilityRuntime = useMemo(() => getReliabilityRuntimeSnapshot(), [reliabilityTick]);
  const relayResilienceSnapshot = useMemo(() => relayResilienceObservability.getSnapshot(), [reliabilityTick]);
  const relayResilienceBetaGate = useMemo(
    () => relayResilienceObservability.evaluateBetaReadiness({ snapshot: relayResilienceSnapshot }),
    [relayResilienceSnapshot],
  );
  const relayResiliencePerformanceGate = useMemo(
    () => relayResilienceObservability.evaluateRuntimePerformanceGate({ snapshot: relayResilienceSnapshot }),
    [relayResilienceSnapshot],
  );
  const lastSyncLabel = reliabilityRuntime.lastSyncCompletedAtUnixMs > 0
    ? new Date(reliabilityRuntime.lastSyncCompletedAtUnixMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "n/a";

  const providerValidation = useMemo(() => {
    const raw = (nip96Config.apiUrl ?? "").trim();
    if (!nip96Config.enabled) {
      return { state: "idle" as const, message: "Provider disabled." };
    }
    if (!raw) {
      return { state: "error" as const, message: "Provider URL is required when NIP-96 is enabled." };
    }
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return { state: "error" as const, message: "Invalid URL format." };
    }
    if (parsed.protocol !== "https:") {
      return { state: "error" as const, message: "Use HTTPS for NIP-96 providers." };
    }
    return { state: "success" as const, message: "URL format looks valid." };
  }, [nip96Config.apiUrl, nip96Config.enabled]);

  const translateStorageMode = (mode: StorageMode): string => {
    if (mode === "hybrid") return t("settings.storage.mode.hybrid", "hybrid");
    if (mode === "nip96") return t("settings.storage.mode.nip96", "NIP-96");
    if (mode === "local_vault") return t("settings.storage.mode.localVault", "local vault");
    return t("settings.storage.mode.disabled", "disabled");
  };

  const handleResetStorageSection = async (): Promise<void> => {
    const defaultNip96: Nip96Config = { enabled: false, apiUrl: "" };
    saveNip96Config(defaultNip96);
    saveLocalMediaConfig(DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG);
    setProviderReachabilityNote("");
    await refreshLocalMediaAbsolutePath();
    setStorageStatsTick((prev) => prev + 1);
    setStorageActionPhase("success");
    setStorageActionMessage("Storage section reset to defaults.");
    toast.success("Storage section reset.");
  };

  const handleCheckProviderReachability = async (): Promise<void> => {
    const url = (nip96Config.apiUrl ?? "").trim();
    if (providerValidation.state !== "success") {
      setStorageActionPhase("error");
      setStorageActionMessage("Fix provider URL before reachability check.");
      return;
    }
    setIsCheckingProviderReachability(true);
    setStorageActionPhase("working");
    setStorageActionMessage("Checking provider reachability...");
    setProviderReachabilityNote("");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6_000);
    try {
      await fetch(url, { method: "GET", mode: "no-cors", signal: controller.signal });
      setStorageActionPhase("success");
      setStorageActionMessage("Provider responded to reachability check.");
      setProviderReachabilityNote(`Reachable: ${url}`);
    } catch {
      setStorageActionPhase("error");
      setStorageActionMessage("Provider reachability check failed. Save is still allowed.");
      setProviderReachabilityNote("Could not verify provider reachability.");
    } finally {
      clearTimeout(timeout);
      setIsCheckingProviderReachability(false);
    }
  };

  return {
    ...destructive,
    checkStorageHealth,
    handleCheckProviderReachability,
    handleResetStorageSection,
    handleSavePrivacy: privacy.handleSavePrivacy,
    isCheckingProviderReachability,
    isCheckingStorageHealth,
    isResolvingLocalPath,
    lastSyncLabel,
    localMediaAbsolutePath,
    localMediaConfig,
    nip96Config,
    privacySettings: privacy.privacySettings,
    providerReachabilityNote,
    providerValidation,
    refreshLocalMediaAbsolutePath,
    relayResilienceBetaGate,
    relayResiliencePerformanceGate,
    relayResilienceSnapshot,
    reliabilityMetrics,
    reliabilityRuntime,
    reliabilityTick,
    rolloutPolicy: privacy.rolloutPolicy,
    runStorageRecovery,
    saveLocalMediaConfig,
    saveNip96Config,
    setIsCheckingProviderReachability,
    setIsCheckingStorageHealth,
    setIsResolvingLocalPath,
    setLocalMediaAbsolutePath,
    setLocalMediaConfig,
    setNip96Config,
    setPrivacySettings: privacy.setPrivacySettings,
    setProviderReachabilityNote,
    setReliabilityTick,
    setStorageActionMessage,
    setStorageActionPhase,
    setStorageHealthState,
    setStorageStatsTick,
    storageActionMessage: destructive.storageActionMessage ?? storageActionMessage,
    storageActionPhase: destructive.storageActionPhase ?? storageActionPhase,
    storageHealthState,
    storageMode,
    storageStats,
    storageStatsTick,
    t,
    translateStorageMode,
  };
}
