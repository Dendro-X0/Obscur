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

export default function ProfileSettingsTabPanel(): React.JSX.Element {
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
        <div className="space-y-4">
          <Card title={t("profile.title")} description={t("profile.description")} className="w-full">
            <div id="profile" className="space-y-6">
              <div className="space-y-6 rounded-2xl border border-black/10 bg-gradient-to-br from-white/90 to-zinc-50/50 p-6 backdrop-blur-md shadow-sm dark:border-white/10 dark:from-zinc-900/40 dark:to-zinc-950/20">
                <ProfileCompletenessIndicator
                  hasAvatar={(profile.state.profile.avatarUrl || "").trim().length > 0}
                  hasUsername={profile.state.profile.username.trim().length >= 3}
                  hasDescription={(profile.state.profile.about || "").trim().length > 0}
                  hasNip05={(profile.state.profile.nip05 || "").trim().length > 0}
                />

                <div className="flex flex-col items-center justify-center space-y-4 pt-2">
                  <AvatarUpload
                    currentAvatarUrl={profile.state.profile.avatarUrl}
                    onUploadSuccess={(url) => profile.setAvatarUrl({ avatarUrl: url })}
                    onClear={() => profile.setAvatarUrl({ avatarUrl: "" })}
                    className="w-full"
                  />
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 text-center">{t("profile.avatarHelp")}</div>
                  {profileValidation.avatarUrlError ? (
                    <div className="text-xs text-rose-600 dark:text-rose-400 text-center">{profileValidation.avatarUrlError}</div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-username">{t("profile.usernameLabel")}</Label>
                  <Input
                    id="profile-username"
                    value={profile.state.profile.username}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => profile.setUsername({ username: e.target.value })}
                    placeholder={t("profile.usernamePlaceholder")}
                    aria-invalid={!!profileValidation.usernameError}
                    className={cn(profileValidation.usernameError ? "border-rose-500/50 focus-visible:ring-rose-500" : "")}
                  />
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("profile.usernameHelp")}</div>
                  {profileValidation.usernameError ? (
                    <div className="text-xs text-rose-600 dark:text-rose-400">{profileValidation.usernameError}</div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-about">{t("profile.aboutLabel", "Description")}</Label>
                  <Textarea
                    id="profile-about"
                    value={profile.state.profile.about || ""}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => profile.setAbout({ about: e.target.value })}
                    placeholder={t("profile.aboutPlaceholder", "Briefly introduce yourself so your friends can get to know you.")}
                    rows={4}
                    aria-invalid={!!profileValidation.aboutError}
                    className={cn(
                      "resize-y border-black/10 bg-white/70 text-zinc-900 placeholder:text-zinc-500",
                      "dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500",
                      profileValidation.aboutError ? "border-rose-500/50 focus-visible:ring-rose-500" : ""
                    )}
                  />
                  <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
                    <span>{t("profile.aboutHelp", "Public profile bio shown in discovery previews.")}</span>
                    <span>{(profile.state.profile.about || "").trim().length}/280</span>
                  </div>
                  {profileValidation.aboutError ? (
                    <div className="text-xs text-rose-600 dark:text-rose-400">{profileValidation.aboutError}</div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-nip05">{t("profile.nip05Label")}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="profile-nip05"
                      value={profile.state.profile.nip05 || ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => profile.setNip05({ nip05: e.target.value })}
                      placeholder={t("profile.nip05Placeholder")}
                      aria-invalid={!!profileValidation.nip05Error}
                      className={cn(profileValidation.nip05Error ? "border-rose-500/50 focus-visible:ring-rose-500" : "")}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleVerifyNip05}
                      disabled={isVerifyingNip05 || !!profileValidation.nip05Error}
                    >
                      {isVerifyingNip05 ? <Loader2 className="h-4 w-4 animate-spin" /> : t("profile.verifyNip05")}
                    </Button>
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("profile.nip05Help")}</div>
                  {profileValidation.nip05Error ? (
                    <div className="text-xs text-rose-600 dark:text-rose-400">{profileValidation.nip05Error}</div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-invite-code">Friend Code</Label>
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-2 py-1.5",
                      "border-black/10 bg-gradient-card dark:border-white/10",
                      profileValidation.inviteCodeError ? "border-rose-500/50" : ""
                    )}
                  >
                    <div className="rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-xs font-semibold tracking-wide text-zinc-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300">
                      {INVITE_CODE_PREFIX}-
                    </div>
                    <Input
                      id="profile-invite-code"
                      value={inviteCodeDraftSuffix}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteCodeFromSuffix(e.target.value)}
                      placeholder="XXXXXX"
                      maxLength={INVITE_CODE_SUFFIX_LENGTH}
                      aria-invalid={!!profileValidation.inviteCodeError}
                      className={cn(
                        "h-9 flex-1 border-0 bg-transparent px-1 py-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
                        profileValidation.inviteCodeError ? "text-rose-700 dark:text-rose-300" : ""
                      )}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="shrink-0"
                      disabled={isPublishing}
                      onClick={() => {
                        void handleRandomInviteCode();
                      }}
                    >
                      Random
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      disabled={!inviteCodeDraft.trim()}
                      onClick={async () => {
                        const code = inviteCodeDraft.trim().toUpperCase();
                        if (!code) return;
                        try {
                          await navigator.clipboard.writeText(code);
                          toast.success("Copied friend code.");
                        } catch {
                          toast.error("Unable to copy friend code.");
                        }
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                    <span>Use this friend code for quick account discovery.</span>
                    <span>Prefix is fixed by app identity; edit only the 6-character suffix.</span>
                    {userInviteCode.nprofile ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto px-0 py-0 text-xs font-semibold"
                        onClick={async () => {
                          await navigator.clipboard.writeText(userInviteCode.nprofile!);
                          toast.success("Copied shareable identity link.");
                        }}
                      >
                        Copy identity link
                      </Button>
                    ) : null}
                  </div>
                  {inviteCodeAvailabilityMessage ? (
                    <div
                      className={cn(
                        "flex items-center gap-2 text-xs",
                        inviteCodeAvailabilityStatus === "available" && "text-emerald-600 dark:text-emerald-400",
                        inviteCodeAvailabilityStatus === "claimed_by_other" && "text-rose-600 dark:text-rose-400",
                        inviteCodeAvailabilityStatus === "unverified" && "text-amber-600 dark:text-amber-400",
                        (inviteCodeAvailabilityStatus === "checking" || inviteCodeAvailabilityStatus === "idle") && "text-zinc-600 dark:text-zinc-400",
                      )}
                    >
                      {inviteCodeAvailabilityStatus === "checking" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      <span>{inviteCodeAvailabilityMessage}</span>
                    </div>
                  ) : null}
                  {profileValidation.inviteCodeError ? (
                    <div className="text-xs text-rose-600 dark:text-rose-400">{profileValidation.inviteCodeError}</div>
                  ) : null}
                </div>

              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  type="button"
                  disabled={isPublishing || !profileValidation.isValid || inviteCodeAvailabilityStatus === "checking"}
                  className="h-11 px-8 font-bold text-white bg-gradient-primary border-none shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
                  onClick={handleSaveProfile}
                >
                  {isPublishing ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </div>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
              <SettingsActionStatus
                title="Profile Save Status"
                phase={isPublishing ? toSettingsActionPhase(profilePublishPhase) : profileSaveActionPhase}
                message={
                  profilePreflightError
                    ? profilePreflightError
                    : profileSaveActionMessage
                      ? profileSaveActionMessage
                    : profilePublishReport?.message
                    ? profilePublishReport.message
                    : profilePublishError
                      ? profilePublishError
                      : undefined
                }
                summary={
                  accountSyncSnapshot.portabilityStatus === "portable"
                    ? "Account is portable across devices. Profile publish and encrypted backup both have relay evidence."
                    : accountSyncSnapshot.portabilityStatus === "profile_only"
                      ? "Profile publish has relay evidence, but encrypted backup is not proven yet. Cross-device restore is not guaranteed."
                      : accountSyncSnapshot.portabilityStatus === "local_only"
                        ? "Profile is saved locally, but network sync proof is incomplete. Another device may not restore this account yet."
                        : "Profile save and account sync are separate proof steps. Portability is only claimed after both relay-backed proofs succeed."
                }
              />
              <div
                id="account-sync-backup"
                className="rounded-2xl border border-black/10 bg-white/70 p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-100">Account Sync</div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      Private key = account. This device restores and refreshes account state from relays.
                    </div>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest",
                      accountSyncSnapshot.portabilityStatus === "portable" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                      accountSyncSnapshot.portabilityStatus === "profile_only" && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                      accountSyncSnapshot.portabilityStatus === "local_only" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                      accountSyncSnapshot.portabilityStatus === "degraded" && "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                      accountSyncSnapshot.portabilityStatus === "unknown" && "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
                    )}
                  >
                    {accountSyncSnapshot.portabilityStatus.replace("_", " ")}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-zinc-50 p-3 text-xs dark:bg-zinc-950/60">
                    <div className="font-bold uppercase tracking-wider text-zinc-500">Portability</div>
                    <div className="mt-1 text-zinc-900 dark:text-zinc-100">
                      {accountSyncSnapshot.portabilityStatus === "portable"
                        ? "Portable across devices"
                        : accountSyncSnapshot.portabilityStatus === "profile_only"
                          ? "Public profile synced, private backup missing"
                          : accountSyncSnapshot.portabilityStatus === "local_only"
                            ? "Only local device save is proven"
                            : accountSyncSnapshot.portabilityStatus === "degraded"
                              ? "Relay sync degraded"
                              : "Not proven yet"}
                    </div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-3 text-xs dark:bg-zinc-950/60">
                    <div className="font-bold uppercase tracking-wider text-zinc-500">Restore phase</div>
                    <div className="mt-1 text-zinc-900 dark:text-zinc-100">{accountSyncSnapshot.message}</div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-3 text-xs dark:bg-zinc-950/60">
                    <div className="font-bold uppercase tracking-wider text-zinc-500">Encrypted backup</div>
                    <div className="mt-1 text-zinc-900 dark:text-zinc-100">
                      {accountSyncSnapshot.hasEncryptedBackup ? "Available on relays" : "Not found yet"}
                    </div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-3 text-xs dark:bg-zinc-950/60">
                    <div className="font-bold uppercase tracking-wider text-zinc-500">Last public profile fetch</div>
                    <div className="mt-1 text-zinc-900 dark:text-zinc-100">
                      {accountSyncSnapshot.lastPublicProfileFetchAtUnixMs
                        ? new Date(accountSyncSnapshot.lastPublicProfileFetchAtUnixMs).toLocaleString()
                        : "Not fetched yet"}
                    </div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-3 text-xs dark:bg-zinc-950/60">
                    <div className="font-bold uppercase tracking-wider text-zinc-500">Last encrypted backup publish</div>
                    <div className="mt-1 text-zinc-900 dark:text-zinc-100">
                      {accountSyncSnapshot.lastEncryptedBackupPublishAtUnixMs
                        ? new Date(accountSyncSnapshot.lastEncryptedBackupPublishAtUnixMs).toLocaleString()
                        : "Not published yet"}
                    </div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-3 text-xs dark:bg-zinc-950/60">
                    <div className="font-bold uppercase tracking-wider text-zinc-500">Profile proof</div>
                    <div className="mt-1 text-zinc-900 dark:text-zinc-100">
                      {accountSyncSnapshot.profileProof
                        ? `${accountSyncSnapshot.profileProof.deliveryStatus} ${accountSyncSnapshot.profileProof.successCount ?? 0}/${accountSyncSnapshot.profileProof.totalRelays ?? 0}`
                        : "No relay proof yet"}
                    </div>
                    {accountSyncSnapshot.latestProfileEventId ? (
                      <div className="mt-1 font-mono text-[10px] text-zinc-500">{accountSyncSnapshot.latestProfileEventId.slice(0, 16)}...</div>
                    ) : null}
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-3 text-xs dark:bg-zinc-950/60">
                    <div className="font-bold uppercase tracking-wider text-zinc-500">Backup proof</div>
                    <div className="mt-1 text-zinc-900 dark:text-zinc-100">
                      {accountSyncSnapshot.backupProof
                        ? `${accountSyncSnapshot.backupProof.deliveryStatus} ${accountSyncSnapshot.backupProof.successCount ?? 0}/${accountSyncSnapshot.backupProof.totalRelays ?? 0}`
                        : "No relay proof yet"}
                    </div>
                    {accountSyncSnapshot.latestBackupEventId ? (
                      <div className="mt-1 font-mono text-[10px] text-zinc-500">{accountSyncSnapshot.latestBackupEventId.slice(0, 16)}...</div>
                    ) : null}
                  </div>
                </div>
                {accountSyncSnapshot.lastRelayFailureReason ? (
                  <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                    Last relay failure: {accountSyncSnapshot.lastRelayFailureReason}
                  </div>
                ) : null}
                <div className="mt-3 rounded-xl border border-black/10 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-400">
                  Last restore source: {accountSyncSnapshot.lastRestoreSource?.replace("_", " ") || "none"}
                </div>
                <div className="mt-3 rounded-xl border border-black/10 bg-zinc-50 px-3 py-3 dark:border-white/10 dark:bg-zinc-950/60">
                  <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">Manual portability</div>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    Automatic relay restore is best-effort. Portable bundles are deterministic fallback imports between devices.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!publicKeyHex || isPortableBundleExporting || isPortableBundleImporting}
                      className="h-9 text-xs font-bold"
                      onClick={() => void handleExportPortableBundle()}
                    >
                      {isPortableBundleExporting ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Exporting...
                        </span>
                      ) : "Export Portable Bundle"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!publicKeyHex || isPortableBundleImporting || isPortableBundleExporting}
                      className="h-9 text-xs font-bold"
                      onClick={() => portableBundleFileInputRef.current?.click()}
                    >
                      {isPortableBundleImporting ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Importing...
                        </span>
                      ) : "Import Portable Bundle"}
                    </Button>
                  </div>
                  <input
                    ref={portableBundleFileInputRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(event) => { void handlePortableBundleFileSelected(event); }}
                  />
                  <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Keep the bundle file private. It is encrypted, but still contains your account backup envelope.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

    </>
  );
}
