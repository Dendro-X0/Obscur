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

export default function BlocklistSettingsTabPanel(): React.JSX.Element {
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

  return (
    <>
        <SettingsCompactCard
          title={t("settings.tabs.blocklist")}
          description={t("settings.blocklist.desc")}
          className="w-full"
        >
          <div className={compact ? "space-y-4" : "space-y-6"}>
            {!compact ? (
            <div className="group relative overflow-hidden rounded-[2rem] border border-black/10 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6 shadow-sm transition-all hover:shadow-md dark:border-white/10 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950">
              <div className="pointer-events-none absolute -right-4 -top-4 h-40 w-40 rounded-full bg-gradient-primary opacity-5 blur-3xl dark:opacity-10" />
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 dark:bg-purple-500/20">
                      <ShieldAlert className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-purple-600/60 dark:text-purple-400/60">Moderation System</span>
                  </div>
                  <h4 className="text-xl font-black text-zinc-950 dark:text-zinc-100 tracking-tight">Blocklist Control Center</h4>
                  <p className="max-w-md text-xs font-bold leading-relaxed text-zinc-500 dark:text-zinc-400">
                    Maintain your privacy. Blocked users are restricted from sending messages or invites to your account.
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 text-right">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-black/5 bg-white/80 shadow-sm dark:border-white/10 dark:bg-black/40">
                    <Database className="h-6 w-6 text-zinc-400 dark:text-zinc-600" />
                  </div>
                </div>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 rounded-2xl bg-white/80 px-4 py-2 shadow-sm border border-black/5 dark:bg-black/40 dark:border-white/5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Blocked</span>
                  <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">{blocklist.state.blockedPublicKeys.length}</span>
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-white/80 px-4 py-2 shadow-sm border border-black/5 dark:bg-black/40 dark:border-white/5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Session Filter</span>
                  <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">{filteredBlockedKeys.length}</span>
                </div>
              </div>
            </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center justify-between rounded-xl border border-black/5 bg-zinc-50/80 px-3 py-2 text-xs dark:border-white/10 dark:bg-zinc-900/50">
                  <span className="font-semibold text-zinc-500">Blocked</span>
                  <span className="font-black text-zinc-900 dark:text-zinc-100">{blocklist.state.blockedPublicKeys.length}</span>
                </div>
                <div className="flex flex-1 items-center justify-between rounded-xl border border-black/5 bg-zinc-50/80 px-3 py-2 text-xs dark:border-white/10 dark:bg-zinc-900/50">
                  <span className="font-semibold text-zinc-500">Filtered</span>
                  <span className="font-black text-zinc-900 dark:text-zinc-100">{filteredBlockedKeys.length}</span>
                </div>
              </div>
            )}

            <SettingsCompactSection title="Block by Public Key">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={blocklistInput}
                  onChange={(e) => setBlocklistInput(e.target.value)}
                  placeholder="hex public key (64 chars)"
                  className="h-10 border-black/10 bg-white/80 font-mono text-xs dark:border-white/10 dark:bg-black/20"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddBlockedKey();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={handleAddBlockedKey}
                  className={cn(
                    "h-10 font-bold text-white bg-gradient-primary border-none shadow-sm hover:shadow-md transition-all",
                    compact ? "w-full sm:w-auto sm:px-6" : "px-8",
                  )}
                >
                  Block
                </Button>
              </div>
            </SettingsCompactSection>

            <SettingsCompactSection
              title={`${t("settings.blocklist.blockedUsers", "Blocked Users")} (${filteredBlockedKeys.length})`}
              action={(
                <Button type="button" variant="ghost" size="sm" onClick={handleUnblockAll} className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20">
                  Unblock All
                </Button>
              )}
            >
              <Input
                value={blocklistQuery}
                onChange={(e) => setBlocklistQuery(e.target.value)}
                placeholder="Search blocked keys..."
                className={cn(
                  "h-9 border-black/10 bg-white/90 text-xs dark:border-white/10 dark:bg-black/20",
                  compact ? "w-full" : "mb-3 h-8 w-[180px]",
                )}
              />
              {filteredBlockedKeys.length === 0 ? (
                <p className="rounded-xl border border-dashed border-black/10 p-4 text-center text-xs italic text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                  {t("settings.blocklist.empty", "No users blocked yet.")}
                </p>
              ) : (
                <div className="max-h-[320px] space-y-2 overflow-y-auto pr-2 custom-scrollbar">
                  {filteredBlockedKeys.map((pubkey: string) => (
                    <div key={pubkey} className="group flex items-center justify-between gap-2 rounded-xl border border-black/5 bg-zinc-50/80 p-2.5 shadow-sm transition-all hover:border-zinc-300 hover:bg-white dark:border-white/10 dark:bg-zinc-900/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900">
                      <span className="flex-1 truncate font-mono text-[10px]">{pubkey}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(pubkey);
                              setModerationActionPhase("success");
                              setModerationActionMessage("Public key copied.");
                            } catch {
                              setModerationActionPhase("error");
                              setModerationActionMessage("Clipboard unavailable in this environment.");
                            }
                          }}
                        >
                          Copy
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => {
                            blocklist.removeBlocked({ publicKeyHex: pubkey as PublicKeyHex });
                            setModerationActionPhase("success");
                            setModerationActionMessage("User unblocked.");
                          }}
                        >
                          Unblock
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SettingsCompactSection>
            {!compact ? (
            <SettingsActionStatus
              title="Moderation Actions"
              phase={moderationActionPhase}
              message={moderationActionMessage || undefined}
              summary={`Blocked: ${blocklist.state.blockedPublicKeys.length} · Filtered: ${filteredBlockedKeys.length}`}
            />
            ) : null}
          </div>
        </SettingsCompactCard>
    </>
  );
}
