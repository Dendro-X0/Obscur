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

import { useSettingsTabPanelModel } from "../settings-tab-panel-model-context";
import { SettingsCompactCard, SettingsCompactSection } from "@/app/features/settings/components/settings-compact-card";
import { useMobileCompactLayout } from "@/app/features/runtime/use-mobile-compact-layout";

export default function PrivacySettingsTabPanel(): React.JSX.Element {
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
  const toggleRowClass = cn(
    "flex items-center justify-between gap-4",
    compact ? "py-1" : "rounded-2xl border border-black/5 bg-zinc-50/50 p-4 dark:border-white/10 dark:bg-zinc-900/40",
  );

  return (
    <>
          <div className={compact ? "space-y-4" : "space-y-6"}>
            <div id="privacy-trust-settings">
              <TrustSettingsPanel />
            </div>
            <SettingsCompactCard
              title={t("settings.privacy.global", "Global Privacy")}
              description={t("settings.privacy.globalDesc", "Control who can message you and how messages are wrapped.")}
              className="w-full"
            >
              <div className={compact ? "space-y-3" : "space-y-5"}>
                <SettingsCompactSection
                  title="Direct Message Policy"
                  hint={compact ? undefined : "Choose who can reach your inbox by default."}
                >
                  <div className={cn("grid gap-2", compact ? "grid-cols-2" : "sm:grid-cols-2")}>
                    <Button
                      type="button"
                      variant={privacySettings.dmPrivacy === "everyone" ? "secondary" : "outline"}
                      onClick={() => handleSavePrivacy({ ...privacySettings, dmPrivacy: "everyone" })}
                      className={cn("justify-start", compact && "h-9 text-xs")}
                    >
                      Everyone
                    </Button>
                    <Button
                      type="button"
                      variant={privacySettings.dmPrivacy === "contacts-only" ? "secondary" : "outline"}
                      onClick={() => handleSavePrivacy({ ...privacySettings, dmPrivacy: "contacts-only" })}
                      className={cn("justify-start", compact && "h-9 text-xs")}
                    >
                      Contacts Only
                    </Button>
                  </div>
                </SettingsCompactSection>

                <div className={toggleRowClass}>
                  <div className="min-w-0 flex-1">
                    <Label className="text-sm font-semibold tracking-wide">Enable Modern DMs (Gift Wraps)</Label>
                    {!compact ? (
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Adds stronger metadata privacy for compatible clients and relays.</p>
                    ) : null}
                  </div>
                  <SettingsToggle
                    checked={privacySettings.useModernDMs}
                    onChange={(checked) => handleSavePrivacy({ ...privacySettings, useModernDMs: checked })}
                  />
                </div>

                <SettingsCompactSection
                  title="Local Message Retention"
                  hint={compact ? undefined : "Limits chat history rendered on this device."}
                >
                  <div className={cn("grid gap-2", compact ? "grid-cols-3" : "sm:grid-cols-3")}>
                    {([
                      { label: "Off", days: 0 as const },
                      { label: compact ? "30d" : "30 Days", days: 30 as const },
                      { label: compact ? "90d" : "90 Days", days: 90 as const },
                    ]).map((option) => (
                      <Button
                        key={option.days}
                        type="button"
                        variant={privacySettings.localMessageRetentionDays === option.days ? "secondary" : "outline"}
                        onClick={() => handleSavePrivacy({
                          ...privacySettings,
                          localMessageRetentionDays: option.days,
                        })}
                        className={cn("justify-center", compact && "h-9 px-2 text-xs")}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </SettingsCompactSection>

                <div className={toggleRowClass}>
                  <div className="min-w-0 flex-1">
                    <Label className="text-sm font-semibold tracking-wide">Show Public Key Controls In Chat</Label>
                    {!compact ? (
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Keeps the chat header focused on usernames unless you explicitly enable Share ID controls.
                      </p>
                    ) : null}
                  </div>
                  <SettingsToggle
                    checked={privacySettings.showPublicKeyControlsInChat === true}
                    onChange={(checked) => handleSavePrivacy({ ...privacySettings, showPublicKeyControlsInChat: checked })}
                  />
                </div>

                {!compact ? (
                  <SettingsActionStatus
                    title="Privacy Summary"
                    phase="idle"
                    summary={`DM policy: ${privacySettings.dmPrivacy} · Modern DMs: ${privacySettings.useModernDMs ? "enabled" : "disabled"} · Retention: ${privacySettings.localMessageRetentionDays || 0}d · Public key controls: ${privacySettings.showPublicKeyControlsInChat ? "shown" : "hidden"}`}
                  />
                ) : null}
              </div>
            </SettingsCompactCard>
          </div>
    </>
  );
}
