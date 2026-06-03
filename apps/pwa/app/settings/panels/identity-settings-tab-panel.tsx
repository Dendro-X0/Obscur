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
import { ProfileArchiveResultDialog } from "@/app/features/profiles/components/profile-archive-result-dialog";
import { PortabilityQuickActionsPanel } from "@/app/features/profiles/components/portability-quick-actions-panel";
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

import { SettingsCompactCard } from "@/app/features/settings/components/settings-compact-card";
import { useMobileCompactLayout } from "@/app/features/runtime/use-mobile-compact-layout";
import { useSettingsTabPanelModel } from "../settings-tab-panel-model-context";

export default function IdentitySettingsTabPanel(): React.JSX.Element {
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
    handleProfileArchiveDialogClose,
    isProfileArchiveDialogOpen,
    profileArchiveDialogMode,
    profileArchiveResult,
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
        <div className={compact ? "space-y-4" : "space-y-6"}>
          <ProfileSwitcherCard onBeforeSwitch={handleProfileSwitchLock} />
          <SettingsCompactCard title={t("identity.title")} description={t("identity.description")} className="w-full">
            <div className={compact ? "space-y-4" : "space-y-6"}>
              <div className={cn(
                "relative overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-br from-zinc-50 to-white shadow-sm dark:border-white/10 dark:from-zinc-900/40 dark:to-zinc-950/20",
                compact ? "p-4" : "p-5",
              )}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-black tracking-tight text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Account Identity</span>
                    <p className={cn("text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none", compact && "sr-only")}>Global Identification State</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em]",
                      identityStorageMode === "native" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
                      identityStorageMode === "encrypted_local" && "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
                      identityStorageMode === "session_only" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
                      identityStorageMode === "unknown" && "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20",
                    )}>
                      {identityStorageMode.replace("_", " ")}
                    </span>
                    <span className={cn(
                      "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em]",
                      identityIntegrityState === "ok" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
                      identityIntegrityState === "mismatch" && "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
                      identityIntegrityState === "unknown" && "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20",
                    )}>
                      integrity {identityIntegrityState}
                    </span>
                  </div>
                </div>
                
                <div className={cn("mt-6 grid gap-4", compact ? "grid-cols-1" : "md:grid-cols-2")}>
                  <div className="space-y-2.5 rounded-xl bg-white/50 p-4 border border-black/5 dark:bg-black/20 dark:border-white/5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="profile-pubkey" className="text-[11px] font-black uppercase tracking-widest text-zinc-500">{t("identity.publicKeyHex")}</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] font-bold uppercase transition-colors hover:text-purple-600"
                        onClick={(): void => {
                          void navigator.clipboard.writeText(displayPublicKeyHex);
                          toast.success(t("common.copied"));
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1.5" />
                        {t("common.copy")}
                      </Button>
                    </div>
                    <Input id="profile-pubkey" value={displayPublicKeyHex} readOnly className="h-10 font-mono text-[11px] bg-transparent border-none p-0 focus-visible:ring-0 select-all truncate" />
                  </div>

                  <div className="space-y-2.5 rounded-xl bg-white/50 p-4 border border-black/5 dark:bg-black/20 dark:border-white/5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-black uppercase tracking-widest text-zinc-500">Public Key (npub)</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] font-bold uppercase transition-colors hover:text-purple-600"
                        onClick={(): void => {
                          void navigator.clipboard.writeText(npubValue);
                          toast.success(t("common.copied"));
                        }}
                        disabled={!npubValue}
                      >
                        <Copy className="h-3 w-3 mr-1.5" />
                        {t("common.copy")}
                      </Button>
                    </div>
                    <Input value={npubValue} readOnly className="h-10 font-mono text-[11px] bg-transparent border-none p-0 focus-visible:ring-0 select-all truncate" />
                  </div>
                </div>
              </div>

              <details className="group overflow-hidden rounded-2xl border border-black/10 bg-zinc-100/30 dark:border-white/10 dark:bg-zinc-900/40">
                <summary className="flex cursor-pointer list-none items-center justify-between p-4 transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-100">Identity Diagnostics</span>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none">Advanced Key State Details</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-black/5 p-4 space-y-3 dark:border-white/5">
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between text-[11px] font-mono leading-none">
                      <span className="text-zinc-400 uppercase font-black">Stored</span>
                      <span className="text-zinc-600 dark:text-zinc-300 truncate ml-4">{identity.state.stored?.publicKeyHex || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono leading-none">
                      <span className="text-zinc-400 uppercase font-black">Derived</span>
                      <span className="text-zinc-600 dark:text-zinc-300 truncate ml-4">{derivedPublicKeyHex || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono leading-none">
                      <span className="text-zinc-400 uppercase font-black">Native</span>
                      <span className="text-zinc-600 dark:text-zinc-300 truncate ml-4">{identityDiagnostics?.nativeSessionPublicKeyHex || "-"}</span>
                    </div>
                  </div>
                  {identityDiagnostics?.message ? (
                    <div className="mt-2 rounded-lg bg-rose-500/10 p-2 text-[10px] font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20">{identityDiagnostics.message}</div>
                  ) : null}
                </div>
              </details>

              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="profile-nsec" className="text-xs font-black uppercase tracking-widest text-zinc-500">{t("identity.privateKey")}</Label>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Secret Cryptographic Key</p>
                </div>

                <AnimatePresence mode="wait">
                  {!isPrivateKeyVisible && !isChallenging ? (
                    <motion.div
                      key="locked"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full rounded-2xl border-2 border-dashed border-black/10 bg-transparent hover:bg-purple-500/5 hover:border-purple-500/40 group transition-all dark:border-white/10 dark:hover:bg-purple-500/10",
                          compact ? "h-12" : "h-16",
                        )}
                        onClick={handleRevealToggle}
                        disabled={identityIntegrityState === "mismatch"}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 transition-colors group-hover:bg-purple-500/20 dark:bg-zinc-800">
                            <Lock className="h-5 w-5 text-zinc-400 group-hover:text-purple-500" />
                          </div>
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">Reveal Private Key</span>
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Secure Access Required • 20s Window</span>
                          </div>
                        </div>
                      </Button>
                    </motion.div>
                  ) : isChallenging ? (
                    <motion.div
                      key="challenging"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="p-6 rounded-2xl bg-gradient-to-br from-zinc-50 to-white border border-black/10 shadow-sm dark:from-zinc-900 dark:to-zinc-950 dark:border-white/10 space-y-5"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 dark:bg-purple-500/20">
                          <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">Security Challenge</span>
                          <p className="text-xs font-bold text-zinc-500 leading-tight">Enter your master password to unlock secure export.</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Input
                          type="password"
                          placeholder="Master Password"
                          value={challangePassword}
                          onChange={(e) => setChallengePassword(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleVerifyChallenge()}
                          autoFocus
                          className="h-12 text-sm bg-white/50 border-black/10 dark:bg-black/20 dark:border-white/10"
                        />
                        <Button className="h-12 px-6 font-black bg-gradient-primary border-none shadow-md" onClick={handleVerifyChallenge}>Unlock</Button>
                        <Button variant="ghost" className="h-12 px-4 font-bold text-zinc-400" onClick={() => setIsChallenging(false)}>Cancel</Button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="revealed"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="space-y-4"
                    >
                      <div className="flex gap-3">
                        <div className="relative flex-1">
                          <Input
                            id="profile-nsec"
                            type="text"
                            value={nsecKey || "Loading..."}
                            readOnly
                            className="font-mono text-[11px] pr-12 h-14 bg-white border-2 border-purple-500/30 shadow-sm dark:bg-black/40"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                            onClick={handleRevealToggle}
                          >
                            <EyeOff className="h-4 w-4" />
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-12"
                          onClick={copyPrivateKey}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          {t("common.copy")}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-12"
                          onClick={() => void exportPrivateKey()}
                        >
                          {t("common.download")}
                        </Button>
                      </div>
                      <div className="text-xs text-amber-600 dark:text-amber-400">
                        Auto-hide in {revealSecondsLeft}s.
                      </div>
                      <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex gap-4">
                        <ShieldAlert className="h-6 w-6 text-red-500 shrink-0" />
                        <div className="space-y-1">
                          <p className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-widest">Extreme Caution Required</p>
                          <p className="text-[11px] text-red-700/80 dark:text-red-300/80 leading-relaxed font-medium">
                            This key is the only way to recover your account. If you lose it or someone steals it, your identity and messages cannot be recovered. Store it in a safe, offline place.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <PortabilityQuickActionsPanel
              compact
              className="mt-6"
              publicKeyHex={(publicKeyHex as PublicKeyHex | null) ?? null}
              profileLabel={profile.state.profile.username}
              resolveActivePrivateKeyHex={resolveActivePrivateKeyHex}
            />

            <div id="local-data-management" className={cn(
              "mt-8 rounded-xl border border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-950/10 space-y-3",
              compact ? "p-3" : "p-4",
            )}>
              <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">Local data management</h3>
              <p className="mt-1 text-xs text-red-700 dark:text-red-300 font-medium">
                Remove data stored in this profile window on this device. Signing out does not delete local files.
              </p>
              <p className="mt-2 text-[10px] text-red-600/80 dark:text-red-400/80 leading-relaxed italic">
                Your private key cannot be destroyed by deleting local files. These actions save a workspace archive to profile-archives first, then remove selected local data.
              </p>
              <div className="space-y-2">
                <Label htmlFor="delete-confirm-input" className="text-xs text-red-900 dark:text-red-200">Type &quot;{DELETE_ACCOUNT_CONFIRM_TEXT}&quot; to remove all local profile data</Label>
                <Input
                  id="delete-confirm-input"
                  value={deleteAccountConfirmInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeleteAccountConfirmInput(e.target.value)}
                  placeholder={DELETE_ACCOUNT_CONFIRM_TEXT}
                  className="font-mono"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsClearDataDialogOpen(true)}
                    className="border-red-300 text-red-700 dark:border-red-900/40 dark:text-red-300"
                  >
                    {t("settings.actions.clearData", "Clear local caches (keep sign-in)")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleArmDeleteAccount}
                    disabled={deleteAccountCountdown > 0}
                  >
                    {deleteAccountCountdown > 0 ? `Armed in ${deleteAccountCountdown}s` : "Arm local data removal"}
                  </Button>
                </div>
              </div>
              <Button
                type="button"
                variant="danger"
                className="mt-4"
                disabled={isPublishing || deleteAccountConfirmInput.trim() !== DELETE_ACCOUNT_CONFIRM_TEXT || deleteAccountCountdown > 0}
                onClick={() => setIsDeleteAccountDialogOpen(true)}
              >
                {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isPublishing ? "Removing local profile data..." : t("settings.deleteAccount", "Remove local profile data")}
              </Button>
            </div>
          </SettingsCompactCard>
        </div>
      <ConfirmDialog
        isOpen={isDisableAllRelaysDialogOpen}
        onClose={() => setIsDisableAllRelaysDialogOpen(false)}
        onConfirm={handleRelayBulkDisableAllConfirm}
        title={t("settings.relays.disableAllDialogTitle", "Disable all relays?")}
        description={t(
          "settings.relays.disableAllDialogDesc",
          "This turns off every relay in your list. Publishing and relay-backed sync stop until you enable at least one relay again.",
        )}
        confirmLabel={t("settings.relays.disableAllConfirm", "Disable all")}
        cancelLabel={t("common.cancel", "Cancel")}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={isClearDataDialogOpen}
        onClose={() => setIsClearDataDialogOpen(false)}
        onConfirm={handleClearData}
        title={t("settings.dialogs.clearDataTitle", "Clear local caches")}
        description="Export a workspace archive to profile-archives, then clear chat history, sync checkpoints, and cached media for this profile window. Your sign-in and identity on this device are kept."
        confirmLabel={t("settings.actions.clear", "Clear Data")}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={isResetLocalHistoryDialogOpen}
        onClose={() => setIsResetLocalHistoryDialogOpen(false)}
        onConfirm={handleResetLocalHistory}
        title="Reset Local History (Keep Identity)"
        description="This clears local chat history, sync checkpoints, and cached media on this device, but keeps your identity/session and remember-me credentials."
        confirmLabel="Reset Local History"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={isDeleteAccountDialogOpen}
        onClose={() => setIsDeleteAccountDialogOpen(false)}
        onConfirm={handleDeleteAccount}
        title={t("settings.dialogs.deleteAccountTitle", "Remove local profile data")}
        description="Export a workspace archive, publish a deleted-account marker on relays, leave communities, remove sign-in from this device, and wipe this profile window's local data. Your private key still exists mathematically and can be used on another device."
        confirmLabel={t("settings.actions.delete", "Remove local data")}
        variant="danger"
      />

      <ProfileArchiveResultDialog
        result={profileArchiveResult}
        isOpen={isProfileArchiveDialogOpen}
        profileLabel={profile.state.profile.username}
        showExportsFolder
        title={profileArchiveDialogMode === "delete_account" ? "Local profile data removed" : "Local caches cleared"}
        description={
          profileArchiveDialogMode === "delete_account"
            ? "A workspace archive was saved before local data was removed from this profile window."
            : "A workspace archive was saved before caches and history were cleared. Your account remains signed in on this device."
        }
        onClose={handleProfileArchiveDialogClose}
      />
    </>
  );
}
