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

  return (
    <>
          <div className="space-y-6">
            <div id="privacy-trust-settings">
              <TrustSettingsPanel />
            </div>
            <Card title={t("settings.privacy.global", "Global Privacy")} description={t("settings.privacy.globalDesc", "Control who can message you and how messages are wrapped.")} className="w-full">
              <div className="space-y-5">
                <div className="relative overflow-hidden rounded-2xl border border-black/5 bg-gradient-to-br from-cyan-50/50 via-white to-blue-50/30 p-5 shadow-sm dark:border-white/10 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950">
                  <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-500/10 blur-2xl dark:bg-cyan-400/10" />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-600/60 dark:text-cyan-400/60">Privacy Policy</div>
                      <h4 className="mt-2 text-base font-bold text-zinc-900 dark:text-zinc-100 italic tracking-tight">Direct Message Policy</h4>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300 font-medium">
                        Choose who can reach your inbox by default.
                      </p>
                    </div>
                    <div className="rounded-xl border border-black/5 bg-white/70 p-2 dark:border-white/10 dark:bg-black/20">
                      <Lock className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant={privacySettings.dmPrivacy === "everyone" ? "secondary" : "outline"}
                      onClick={() => handleSavePrivacy({ ...privacySettings, dmPrivacy: "everyone" })}
                      className="justify-start"
                    >
                      Everyone
                    </Button>
                    <Button
                      type="button"
                      variant={privacySettings.dmPrivacy === "contacts-only" ? "secondary" : "outline"}
                      onClick={() => handleSavePrivacy({ ...privacySettings, dmPrivacy: "contacts-only" })}
                      className="justify-start"
                    >
                      Contacts Only
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-2xl border border-black/5 bg-zinc-50/50 p-4 dark:border-white/10 dark:bg-zinc-900/40">
                  <div className="flex-1">
                    <Label className="text-sm font-semibold tracking-wide">Enable Modern DMs (Gift Wraps)</Label>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Adds stronger metadata privacy for compatible clients and relays.</p>
                  </div>
                  <SettingsToggle
                    checked={privacySettings.useModernDMs}
                    onChange={(checked) => handleSavePrivacy({ ...privacySettings, useModernDMs: checked })}
                  />
                </div>
                <div className="rounded-2xl border border-black/5 bg-zinc-50/50 p-4 dark:border-white/10 dark:bg-zinc-900/40">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <Label className="text-sm font-semibold tracking-wide">Local Message Retention</Label>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Limits chat history rendered on this device. Relay history remains recoverable if re-synced.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {([
                      { label: "Off", days: 0 as const },
                      { label: "30 Days", days: 30 as const },
                      { label: "90 Days", days: 90 as const },
                    ]).map((option) => (
                      <Button
                        key={option.days}
                        type="button"
                        variant={privacySettings.localMessageRetentionDays === option.days ? "secondary" : "outline"}
                        onClick={() => handleSavePrivacy({
                          ...privacySettings,
                          localMessageRetentionDays: option.days,
                        })}
                        className="justify-start"
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-black/5 bg-zinc-50/50 p-4 dark:border-white/10 dark:bg-zinc-900/40">
                  <div className="flex-1">
                    <Label className="text-sm font-semibold tracking-wide">Show Public Key Controls In Chat</Label>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Keeps the chat header focused on usernames unless you explicitly enable Share ID controls.
                    </p>
                  </div>
                  <SettingsToggle
                    checked={privacySettings.showPublicKeyControlsInChat === true}
                    onChange={(checked) => handleSavePrivacy({ ...privacySettings, showPublicKeyControlsInChat: checked })}
                  />
                </div>
                <SettingsActionStatus
                  title="Privacy Summary"
                  phase="idle"
                  summary={`DM policy: ${privacySettings.dmPrivacy} · Modern DMs: ${privacySettings.useModernDMs ? "enabled" : "disabled"} · Retention: ${privacySettings.localMessageRetentionDays || 0}d · Public key controls: ${privacySettings.showPublicKeyControlsInChat ? "shown" : "hidden"}`}
                />
              </div>
            </Card>
          </div>
    </>
  );
}
