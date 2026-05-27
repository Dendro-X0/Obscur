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
} from "../settings-tab-panel-model";
import { getApiBaseUrl } from "@/app/features/relays/utils/api-base-url";
import { deriveRelayNodeStatus, deriveRelayRuntimeStatus } from "@/app/features/relays/lib/relay-runtime-status";
import { checkStorageHealth, runStorageRecovery } from "@/app/features/messaging/services/storage-health-service";
import { Loader2, Activity, ShieldAlert, Shield, Lock, Database, Copy, ChevronDown, Plus, ArrowUp, ArrowDown, Eye, EyeOff, Building2, Wifi, RefreshCcw, Check, X } from "lucide-react";

import { useSettingsTabPanelModel } from "../settings-tab-panel-model";

export default function NotificationsSettingsTabPanel(): React.JSX.Element {
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

  return (
    <>
        <Card title={t("settings.notifications.title")} description={t("settings.notifications.desc")} className="w-full">
          <div className="space-y-3">
            <div className="text-sm text-zinc-700 dark:text-zinc-300">
              {t("settings.notifications.backgroundDesc")}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {t("settings.notifications.perConversationDesc", "Tip: use the bell icon in each chat header to mute or unmute notifications for a specific user or group.")}
            </div>
            <div className="rounded-xl border border-black/5 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-900/50">
              <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                {t("settings.notifications.permission", "Permission")}: {translatePermissionState(notificationPreference.state.permission)}
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {notificationPreference.state.permission === "granted"
                  ? t("settings.notifications.permissionGrantedDesc", "Permission granted. Notifications can be delivered.")
                  : notificationPreference.state.permission === "denied"
                    ? t("settings.notifications.permissionDeniedDesc", "Permission denied. Enable notifications from system/browser settings.")
                    : notificationPreference.state.permission === "default"
                      ? t("settings.notifications.permissionDefaultDesc", "Permission not decided yet. Click Enable Notifications to request access.")
                      : t("settings.notifications.permissionUnsupportedDesc", "This runtime does not support notifications.")}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={handleEnableNotifications}
              >
                {t("settings.notifications.enable")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleDisableNotifications}
              >
                {t("settings.notifications.disable")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleSendTestNotification}
              >
                {t("settings.notifications.test", "Send Test Notification")}
              </Button>
            </div>
            <div className="rounded-xl border border-black/5 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-900/50 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                    {t("settings.notifications.channel.dm", "Direct messages")}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t("settings.notifications.channel.dmDesc", "Notify when you receive a new DM.")}
                  </div>
                </div>
                <SettingsToggle
                  checked={notificationPreference.state.channels.dmMessages}
                  onChange={(checked) => handleToggleNotificationChannel("dmMessages", checked)}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                    {t("settings.notifications.channel.mentions", "Mentions and replies")}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t("settings.notifications.channel.mentionsDesc", "Notify when someone mentions or replies to you.")}
                  </div>
                </div>
                <SettingsToggle
                  checked={notificationPreference.state.channels.mentionsReplies}
                  onChange={(checked) => handleToggleNotificationChannel("mentionsReplies", checked)}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                    {t("settings.notifications.channel.invites", "Invites and system alerts")}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t("settings.notifications.channel.invitesDesc", "Notify for invites and important system notices.")}
                  </div>
                </div>
                <SettingsToggle
                  checked={notificationPreference.state.channels.invitesSystem}
                  onChange={(checked) => handleToggleNotificationChannel("invitesSystem", checked)}
                />
              </div>
            </div>
            <SettingsActionStatus
              title={t("settings.notifications.statusTitle", "Notification Setup")}
              phase={notificationActionPhase}
              message={notificationActionMessage || undefined}
              summary={t("settings.notifications.statusSummary", {
                defaultValue: "Permission: {{permission}} · {{enabledState}}",
                permission: translatePermissionState(notificationPreference.state.permission),
                enabledState: notificationPreference.state.enabled
                  ? t("settings.notifications.enabled", "enabled")
                  : t("settings.notifications.disabled", "disabled"),
              })}
            />
          </div>
        </Card>

    </>
  );
}
