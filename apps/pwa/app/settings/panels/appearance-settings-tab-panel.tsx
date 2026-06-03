"use client";

import type React from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { TextScale } from "@/app/features/settings/hooks/use-accessibility-preferences";
import { Card, Button, ConfirmDialog, Input, Label, Textarea, toast } from "@dweb/ui-kit";
import { cn } from "@/app/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { RelayDashboard } from "@/app/components/relay-dashboard";
import { AvatarUpload } from "@/app/components/avatar-upload";
import { DesktopUpdater } from "@/app/components/desktop-updater";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { LanguageSelector } from "@/app/components/language-selector";
import { ProfileCompletenessIndicator } from "@/app/features/profile/components/profile-completeness-indicator";
import { RelayReadinessSettingsBanner } from "@/app/features/relays/components/relay-readiness-settings-banner";
import { CommunityMembershipSyncSettingsPanel } from "@/app/features/settings/components/community-membership-sync-settings-panel";
import { TrustSettingsPanel } from "@/app/features/messaging/components/trust-settings-panel";
import { PasswordResetPanel } from "@/app/features/settings/components/password-reset-panel";
import { AutoLockSettingsPanel } from "@/app/features/settings/components/auto-lock-settings-panel";
import { SecuritySettingsPanel } from "@/app/features/settings/components/security-settings-panel";
import { SettingsActionStatus } from "@/app/features/settings/components/settings-action-status";
import { ProfileSwitcherCard } from "@/app/features/profiles/components/profile-switcher-card";
import {
  SettingsToggle,
  SettingsToggleCard,
  toSettingsActionPhase,
  validateProfileInput,
  formatBytes,
  formatRatioPercent,
} from "../settings-tab-panel-shared";
import { getApiBaseUrl } from "@/app/features/relays/utils/api-base-url";
import { deriveRelayNodeStatus, deriveRelayRuntimeStatus } from "@/app/features/relays/lib/relay-runtime-status";
import { checkStorageHealth, runStorageRecovery } from "@/app/features/messaging/services/storage-health-service";
import { Loader2, Activity, ShieldAlert, Shield, Lock, Database, Copy, ChevronDown, Plus, ArrowUp, ArrowDown, Eye, EyeOff, Building2, Wifi, RefreshCcw, Check, X } from "lucide-react";

import { SettingsCompactCard, SettingsCompactSection } from "@/app/features/settings/components/settings-compact-card";
import { useMobileCompactLayout } from "@/app/features/runtime/use-mobile-compact-layout";

import { useSettingsTabPanelModel } from "../settings-tab-panel-model-context";

export default function AppearanceSettingsTabPanel(): React.JSX.Element {
  const {
    APP_VERSION,
    DEFAULT_APP_LANGUAGE,
    DEFAULT_STABLE_PRESET,
    DEFAULT_THEME_PREFERENCE,
    DELETE_ACCOUNT_CONFIRM_TEXT,
    ENABLE_API_HEALTH_PROBE,
    INVITE_CODE_PREFIX,
    INVITE_CODE_SUFFIX_LENGTH,
    RELAY_PRESETS,
    TEXT_SCALE_OPTIONS,
    accessibility,
    accountSyncSnapshot,
    activeTab,
    apiHealth,
    appearanceActionMessage,
    appearanceActionPhase,
    applyRelayPreset,
    blocklist,
    blocklistInput,
    blocklistQuery,
    challangePassword,
    checkStorageHealth,
    clearIndexedDbDatabases,
    clearRuntimeCaches,
    copyPrivateKey,
    deleteAccountConfirmInput,
    deleteAccountCountdown,
    deriveRelayNodeStatus,
    deriveRelayRuntimeStatus,
    derivedPublicKeyHex,
    displayPublicKeyHex,
    exportPrivateKey,
    filteredBlockedKeys,
    getProfilePublishReportSnapshot,
    handleAddBlockedKey,
    handleAddRelay,
    handleArmDeleteAccount,
    handleCheckApi,
    handleCheckProviderReachability,
    handleClearData,
    handleDeleteAccount,
    handleDisableNotifications,
    handleEnableNotifications,
    handleExportPortableBundle,
    handleLockNow,
    handlePortableBundleFileSelected,
    handleProfileSwitchLock,
    handleRandomInviteCode,
    handleRefreshRelayStatus,
    handleRelayBulkCopyList,
    handleRelayBulkDisableAllConfirm,
    handleRelayBulkDisableAllRequest,
    handleRelayBulkEnableAll,
    handleRelayBulkRemoveDisabled,
    handleResetAccessibility,
    handleResetLanguage,
    handleResetLocalHistory,
    handleResetRelaySection,
    handleResetStorageSection,
    handleResetTheme,
    handleRevealToggle,
    handleSavePrivacy,
    handleSaveProfile,
    handleSendTestNotification,
    handleToggleNotificationChannel,
    handleUnblockAll,
    handleVerifyChallenge,
    handleVerifyNip05,
    i18n,
    identity,
    identityDiagnostics,
    identityIntegrityState,
    identityStorageMode,
    inviteCodeAvailabilityMessage,
    inviteCodeAvailabilityStatus,
    inviteCodeDraft,
    inviteCodeDraftSuffix,
    isChallenging,
    isCheckingProviderReachability,
    isCheckingStorageHealth,
    isClearDataDialogOpen,
    isDeleteAccountDialogOpen,
    isDisableAllRelaysDialogOpen,
    isInviteCodeDraftDirty,
    isPortableBundleExporting,
    isPortableBundleImporting,
    isPrivateKeyVisible,
    isPublishing,
    isResetLocalHistoryDialogOpen,
    isResolvingLocalPath,
    isVerifyingNip05,
    lastSyncLabel,
    leaveJoinedCommunitiesBeforeAccountDeletion,
    localMediaAbsolutePath,
    localMediaConfig,
    managedWorkspaceDefinition,
    moderationActionMessage,
    moderationActionPhase,
    newRelayUrl,
    nip96Config,
    notificationActionMessage,
    notificationActionPhase,
    notificationPreference,
    npubValue,
    nsecKey,
    persistedInviteCodeSuffix,
    pool,
    portableBundleFileInputRef,
    privacySettings,
    profile,
    profilePreflightError,
    profilePublishError,
    profilePublishPhase,
    profilePublishReport,
    profileSaveActionMessage,
    profileSaveActionPhase,
    profileValidation,
    providerReachabilityNote,
    providerValidation,
    publicKeyHex,
    publishProfile,
    publishScopedGroupEvent,
    refreshLocalMediaAbsolutePath,
    relayActionMessage,
    relayActionPhase,
    relayCapabilityAssessment,
    relayConnectionMap,
    relayHealthMetricsMap,
    relayList,
    relayQuickHealth,
    relayResilienceBetaGate,
    relayResiliencePerformanceGate,
    relayResilienceSnapshot,
    relayRuntime,
    relayRuntimeStatus,
    relaySelection,
    reliabilityMetrics,
    reliabilityRuntime,
    reliabilityTick,
    resolveActivePrivateKeyHex,
    revealExpiresAtMs,
    revealSecondsLeft,
    rolloutPolicy,
    runStorageRecovery,
    saveLocalMediaConfig,
    saveNip96Config,
    securityActionMessage,
    securityActionPhase,
    securityCapabilityStates,
    securityPosture,
    setApiHealth,
    setAppearanceActionMessage,
    setAppearanceActionPhase,
    setBlocklistInput,
    setBlocklistQuery,
    setChallengePassword,
    setDeleteAccountConfirmInput,
    setDeleteAccountCountdown,
    setInviteCodeAvailabilityMessage,
    setInviteCodeAvailabilityStatus,
    setInviteCodeDraftSuffix,
    setInviteCodeFromSuffix,
    setIsChallenging,
    setIsCheckingProviderReachability,
    setIsCheckingStorageHealth,
    setIsClearDataDialogOpen,
    setIsDeleteAccountDialogOpen,
    setIsDisableAllRelaysDialogOpen,
    setIsInviteCodeDraftDirty,
    setIsPortableBundleExporting,
    setIsPortableBundleImporting,
    setIsPrivateKeyVisible,
    setIsResetLocalHistoryDialogOpen,
    setIsResolvingLocalPath,
    setIsVerifyingNip05,
    setLocalMediaAbsolutePath,
    setLocalMediaConfig,
    setModerationActionMessage,
    setModerationActionPhase,
    setNewRelayUrl,
    setNip96Config,
    setNotificationActionMessage,
    setNotificationActionPhase,
    setNsecKey,
    setPrivacySettings,
    setProfilePreflightError,
    setProfileSaveActionMessage,
    setProfileSaveActionPhase,
    setProviderReachabilityNote,
    setRelayActionMessage,
    setRelayActionPhase,
    setReliabilityTick,
    setRevealExpiresAtMs,
    setRevealSecondsLeft,
    setSecurityActionMessage,
    setSecurityActionPhase,
    setShowAdvancedRelays,
    setStorageActionMessage,
    setStorageActionPhase,
    setStorageHealthState,
    setStorageStatsTick,
    showAdvancedRelays,
    sovereignRoomDefinition,
    startupState,
    storageActionMessage,
    storageActionPhase,
    storageHealthState,
    storageMode,
    storageStats,
    storageStatsTick,
    t,
    theme,
    translatePermissionState,
    translateRelayConfidenceLabel,
    translateRelayNodeBadge,
    translateRelayNodeDetail,
    translateRelayNodeRole,
    translateRelayPresetLabel,
    translateRelayRuntimeText,
    translateStorageMode,
    triggerRelayRecovery,
    userInviteCode,
    verifyInviteCodeAvailability,
    wipeLocalRuntimeData
  } = useSettingsTabPanelModel() as Record<string, any>;

  const compact = useMobileCompactLayout();
  const resetButtonClass = "h-8 px-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-primary transition-colors hover:bg-primary/5 dark:hover:text-primary dark:hover:bg-primary/10";

  return (
    <>
        <SettingsCompactCard
          title={t("settings.appearance.title")}
          description={t("settings.appearance.desc")}
          className="w-full"
        >
          <div className={compact ? "space-y-4" : "space-y-6"}>
            <SettingsCompactSection
              title={t("settings.language")}
              hint={compact ? undefined : `${t("settings.appearance.currentLanguage", "Current language")}: ${i18n.language}`}
              action={(
                <Button type="button" variant="ghost" size="sm" onClick={() => void handleResetLanguage()} className={resetButtonClass}>
                  {t("settings.appearance.resetLanguage", "Reset")}
                </Button>
              )}
            >
              <div className={compact ? undefined : "rounded-xl bg-white/50 p-2 dark:bg-black/20"}>
                <LanguageSelector />
              </div>
            </SettingsCompactSection>

            <SettingsCompactSection
              title={t("settings.appearance.theme")}
              hint={compact ? undefined : `${t("settings.appearance.currentTheme", "Current theme preference")}: ${theme.preference}`}
              action={(
                <Button type="button" variant="ghost" size="sm" onClick={handleResetTheme} className={resetButtonClass}>
                  {t("settings.appearance.resetTheme", "Reset")}
                </Button>
              )}
            >
              <div className={compact ? undefined : "rounded-xl bg-white/50 p-3 dark:bg-black/20"}>
                <ThemeToggle layout={compact ? "segmented" : "inline"} />
              </div>
            </SettingsCompactSection>

            <SettingsCompactSection
              title={t("settings.appearance.accessibility", "Accessibility")}
              hint={compact ? undefined : `${t("settings.appearance.textScale", "Text Scale")}: ${accessibility.preferences.textScale}%`}
              action={(
                <Button type="button" variant="ghost" size="sm" onClick={handleResetAccessibility} className={resetButtonClass}>
                  {t("settings.appearance.resetAccessibility", "Reset")}
                </Button>
              )}
            >
              <div className="space-y-4">
                <div className={cn(compact ? "grid grid-cols-4 gap-1.5" : "flex flex-wrap gap-2")}>
                  {TEXT_SCALE_OPTIONS.map((scale: TextScale) => (
                    <Button
                      key={scale}
                      type="button"
                      size="sm"
                      variant={accessibility.preferences.textScale === scale ? "primary" : "outline"}
                      className={cn(
                        "font-black transition-all",
                        compact ? "h-9 px-0 text-xs" : "h-10 px-4",
                        accessibility.preferences.textScale === scale
                          ? "shadow-md !border-none"
                          : "bg-white/50 text-zinc-500 border-black/5 hover:bg-white dark:bg-black/20 dark:text-zinc-400 dark:border-white/5 dark:hover:bg-black/40",
                      )}
                      onClick={() => {
                        accessibility.setTextScale(scale);
                        setAppearanceActionPhase("success");
                        setAppearanceActionMessage(t("settings.appearance.textScaleChanged", {
                          defaultValue: "Text scale set to {{scale}}%.",
                          scale,
                        }));
                      }}
                    >
                      {scale}%
                    </Button>
                  ))}
                </div>

                <div className={cn(
                  "flex items-center justify-between gap-4",
                  compact
                    ? "py-1"
                    : "rounded-xl border border-black/5 bg-black/5 p-4 dark:border-white/5 dark:bg-black/20",
                )}>
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {t("settings.appearance.reducedMotion", "Reduced Motion")}
                    </div>
                    {!compact ? (
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {t("settings.appearance.reducedMotionDesc", "Reduce animations and transitions across the app.")}
                      </div>
                    ) : null}
                  </div>
                  <SettingsToggle
                    checked={accessibility.preferences.reducedMotion}
                    onChange={(checked: boolean) => {
                      accessibility.setReducedMotion(checked);
                      setAppearanceActionPhase("success");
                      setAppearanceActionMessage(checked
                        ? t("settings.appearance.reducedMotionEnabled", "Reduced motion enabled.")
                        : t("settings.appearance.reducedMotionDisabled", "Reduced motion disabled."));
                    }}
                  />
                </div>
                <div className={cn(
                  "flex items-center justify-between gap-4",
                  compact
                    ? "py-1"
                    : "rounded-xl border border-black/5 bg-black/5 p-4 dark:border-white/5 dark:bg-black/20",
                )}>
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {t("settings.appearance.contrastAssist", "Contrast Assist")}
                    </div>
                    {!compact ? (
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {t("settings.appearance.contrastAssistDesc", "Increase visual contrast for text and UI surfaces.")}
                      </div>
                    ) : null}
                  </div>
                  <SettingsToggle
                    checked={accessibility.preferences.contrastAssist}
                    onChange={(checked: boolean) => {
                      accessibility.setContrastAssist(checked);
                      setAppearanceActionPhase("success");
                      setAppearanceActionMessage(checked
                        ? t("settings.appearance.contrastAssistEnabled", "Contrast assist enabled.")
                        : t("settings.appearance.contrastAssistDisabled", "Contrast assist disabled."));
                    }}
                  />
                </div>
              </div>
            </SettingsCompactSection>

            {(!compact || appearanceActionPhase !== "idle" || appearanceActionMessage) ? (
              <SettingsActionStatus
                title={t("settings.appearance.statusTitle", "Appearance")}
                phase={appearanceActionPhase}
                message={appearanceActionMessage || undefined}
                summary={t("settings.appearance.statusSummary", "Customize and reset appearance preferences.")}
              />
            ) : null}
          </div>
        </SettingsCompactCard>

    </>
  );
}
