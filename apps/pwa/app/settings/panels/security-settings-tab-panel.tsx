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
import { SettingsToggle, SettingsToggleCard, toSettingsActionPhase, validateProfileInput, formatBytes, formatRatioPercent, } from "../settings-tab-panel-shared";
import { getApiBaseUrl } from "@/app/features/relays/utils/api-base-url";
import { deriveRelayNodeStatus, deriveRelayRuntimeStatus } from "@/app/features/relays/lib/relay-runtime-status";
import { checkStorageHealth, runStorageRecovery } from "@/app/features/messaging/services/storage-health-service";
import { Loader2, Activity, ShieldAlert, Shield, Lock, Database, Copy, ChevronDown, Plus, ArrowUp, ArrowDown, Eye, EyeOff, Building2, Wifi, RefreshCcw, Check, X } from "lucide-react";
import { useSettingsTabPanelModel } from "../settings-tab-panel-model-context";
import { SettingsCompactCard, SettingsCompactSection } from "@/app/features/settings/components/settings-compact-card";
import { useMobileCompactLayout } from "@/app/features/runtime/use-mobile-compact-layout";
import { AppLockConfirmDialog } from "@/app/features/auth/components/app-lock-confirm-dialog";
import { useAppLockConfirm } from "@/app/features/auth/hooks/use-app-lock-confirm";
export default function SecuritySettingsTabPanel(): React.JSX.Element {
    const { APP_VERSION, DEFAULT_APP_LANGUAGE, DEFAULT_STABLE_PRESET, DEFAULT_THEME_PREFERENCE, DELETE_ACCOUNT_CONFIRM_TEXT, ENABLE_API_HEALTH_PROBE, INVITE_CODE_PREFIX, INVITE_CODE_SUFFIX_LENGTH, RELAY_PRESETS, TEXT_SCALE_OPTIONS, accessibility, accountSyncSnapshot, activeTab, apiHealth, appearanceActionMessage, appearanceActionPhase, applyRelayPreset, blocklist, blocklistInput, blocklistQuery, challangePassword, checkStorageHealth, clearIndexedDbDatabases, clearRuntimeCaches, copyPrivateKey, deleteAccountConfirmInput, deleteAccountCountdown, deriveRelayNodeStatus, deriveRelayRuntimeStatus, derivedPublicKeyHex, displayPublicKeyHex, exportPrivateKey, filteredBlockedKeys, getProfilePublishReportSnapshot, handleAddBlockedKey, handleAddRelay, handleArmDeleteAccount, handleCheckApi, handleCheckProviderReachability, handleClearData, handleDeleteAccount, handleDisableNotifications, handleEnableNotifications, handleExportPortableBundle, handleLockNow, handlePortableBundleFileSelected, handleProfileSwitchLock, handleRandomInviteCode, handleRefreshRelayStatus, handleRelayBulkCopyList, handleRelayBulkDisableAllConfirm, handleRelayBulkDisableAllRequest, handleRelayBulkEnableAll, handleRelayBulkRemoveDisabled, handleResetAccessibility, handleResetLanguage, handleResetLocalHistory, handleResetRelaySection, handleResetStorageSection, handleResetTheme, handleRevealToggle, handleSavePrivacy, handleSaveProfile, handleSendTestNotification, handleToggleNotificationChannel, handleUnblockAll, handleVerifyChallenge, handleVerifyNip05, i18n, identity, identityDiagnostics, identityIntegrityState, identityStorageMode, inviteCodeAvailabilityMessage, inviteCodeAvailabilityStatus, inviteCodeDraft, inviteCodeDraftSuffix, isChallenging, isCheckingProviderReachability, isCheckingStorageHealth, isClearDataDialogOpen, isDeleteAccountDialogOpen, isDisableAllRelaysDialogOpen, isInviteCodeDraftDirty, isPortableBundleExporting, isPortableBundleImporting, isPrivateKeyVisible, isPublishing, isResetLocalHistoryDialogOpen, isResolvingLocalPath, isVerifyingNip05, lastSyncLabel, leaveJoinedCommunitiesBeforeAccountDeletion, localMediaAbsolutePath, localMediaConfig, managedWorkspaceDefinition, moderationActionMessage, moderationActionPhase, newRelayUrl, nip96Config, notificationActionMessage, notificationActionPhase, notificationPreference, npubValue, nsecKey, persistedInviteCodeSuffix, pool, portableBundleFileInputRef, privacySettings, profile, profilePreflightError, profilePublishError, profilePublishPhase, profilePublishReport, profileSaveActionMessage, profileSaveActionPhase, profileValidation, providerReachabilityNote, providerValidation, publicKeyHex, publishProfile, publishScopedGroupEvent, refreshLocalMediaAbsolutePath, relayActionMessage, relayActionPhase, relayCapabilityAssessment, relayConnectionMap, relayHealthMetricsMap, relayList, relayQuickHealth, relayResilienceBetaGate, relayResiliencePerformanceGate, relayResilienceSnapshot, relayRuntime, relayRuntimeStatus, relaySelection, reliabilityMetrics, reliabilityRuntime, reliabilityTick, resolveActivePrivateKeyHex, revealExpiresAtMs, revealSecondsLeft, rolloutPolicy, runStorageRecovery, saveLocalMediaConfig, saveNip96Config, securityActionMessage, securityActionPhase, securityCapabilityStates, securityPosture, setApiHealth, setAppearanceActionMessage, setAppearanceActionPhase, setBlocklistInput, setBlocklistQuery, setChallengePassword, setDeleteAccountConfirmInput, setDeleteAccountCountdown, setInviteCodeAvailabilityMessage, setInviteCodeAvailabilityStatus, setInviteCodeDraftSuffix, setInviteCodeFromSuffix, setIsChallenging, setIsCheckingProviderReachability, setIsCheckingStorageHealth, setIsClearDataDialogOpen, setIsDeleteAccountDialogOpen, setIsDisableAllRelaysDialogOpen, setIsInviteCodeDraftDirty, setIsPortableBundleExporting, setIsPortableBundleImporting, setIsPrivateKeyVisible, setIsResetLocalHistoryDialogOpen, setIsResolvingLocalPath, setIsVerifyingNip05, setLocalMediaAbsolutePath, setLocalMediaConfig, setModerationActionMessage, setModerationActionPhase, setNewRelayUrl, setNip96Config, setNotificationActionMessage, setNotificationActionPhase, setNsecKey, setPrivacySettings, setProfilePreflightError, setProfileSaveActionMessage, setProfileSaveActionPhase, setProviderReachabilityNote, setRelayActionMessage, setRelayActionPhase, setReliabilityTick, setRevealExpiresAtMs, setRevealSecondsLeft, setSecurityActionMessage, setSecurityActionPhase, setShowAdvancedRelays, setStorageActionMessage, setStorageActionPhase, setStorageHealthState, setStorageStatsTick, showAdvancedRelays, sovereignRoomDefinition, startupState, storageActionMessage, storageActionPhase, storageHealthState, storageMode, storageStats, storageStatsTick, t, theme, translatePermissionState, translateRelayConfidenceLabel, translateRelayNodeBadge, translateRelayNodeDetail, translateRelayNodeRole, translateRelayPresetLabel, translateRelayRuntimeText, translateStorageMode, triggerRelayRecovery, userInviteCode, verifyInviteCodeAvailability, wipeLocalRuntimeData } = useSettingsTabPanelModel() as Record<string, any>;
    const compact = useMobileCompactLayout();
    const {
        canLock,
        isLockConfirmOpen,
        openLockConfirm,
        closeLockConfirm,
        confirmLock,
    } = useAppLockConfirm();
    const handleConfirmLock = async (): Promise<void> => {
        await confirmLock();
        setSecurityActionPhase("success");
        setSecurityActionMessage(t("settings.security.lockedToast"));
    };
    return (<>
          <div className={compact ? "space-y-4" : "space-y-6"}>
            <SecuritySettingsPanel />
            <SettingsCompactCard title={t("settings.security.postureTitle")} description={t("settings.security.postureDesc")} className="w-full">
              <div className={compact ? "space-y-3" : "space-y-4"}>
                <div className={cn("flex items-center justify-between", compact ? "py-1" : "rounded-xl border border-black/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-900/50")}>
                  <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{t("settings.security.overallPosture")}</div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", securityPosture === "strong" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", securityPosture === "moderate" && "bg-amber-500/15 text-amber-600 dark:text-amber-400", securityPosture === "weak" && "bg-rose-500/15 text-rose-600 dark:text-rose-400")}>
                    {t(`settings.security.posture.${securityPosture}`)}
                  </span>
                </div>
                <div className={cn("grid gap-2", compact ? "grid-cols-3" : "md:grid-cols-3")}>
                  <div className={cn("rounded-lg border border-black/5 text-xs dark:border-white/10", compact ? "p-2 text-center" : "p-3")}>
                    {t("settings.security.capabilityClipboard")}: <span className="font-semibold">{t(`settings.security.capability.${securityCapabilityStates.clipboard}`)}</span>
                  </div>
                  <div className={cn("rounded-lg border border-black/5 text-xs dark:border-white/10", compact ? "p-2 text-center" : "p-3")}>
                    {t("settings.security.capabilityBiometric")}: <span className="font-semibold">{t(`settings.security.capability.${securityCapabilityStates.biometric}`)}</span>
                  </div>
                  <div className={cn("rounded-lg border border-black/5 text-xs dark:border-white/10", compact ? "p-2 text-center" : "p-3")}>
                    {t("settings.security.capabilityTor")}: <span className="font-semibold">{t(`settings.security.capability.${securityCapabilityStates.tor}`)}</span>
                  </div>
                </div>
              </div>
            </SettingsCompactCard>
            <div id="security-password-reset">
              <PasswordResetPanel />
            </div>
            <div id="security-auto-lock">
              <AutoLockSettingsPanel />
            </div>
            <SettingsCompactCard title={t("settings.security.sessionTitle")} description={t("settings.security.sessionDesc")} className="w-full">
              <div className={cn("space-y-3", compact ? undefined : "space-y-4")}>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {t("settings.security.lockNowDesc")}
                </p>
                <Button variant="secondary" onClick={openLockConfirm} disabled={!canLock} className={compact ? "h-10 w-full" : undefined}>
                  <Lock className="h-4 w-4" />
                  {t("settings.security.lockNow")}
                </Button>
                <Button variant="outline" className={cn("text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-900/20", compact ? "h-10 w-full" : undefined)} onClick={() => setIsClearDataDialogOpen(true)}>
                  {t("settings.actions.clearData")}
                </Button>
                {!compact ? (<SettingsActionStatus title={t("settings.security.sessionActionsTitle")} phase={securityActionPhase} message={securityActionMessage || undefined} summary={t("settings.security.sessionActionsSummary")}/>) : null}
              </div>
            </SettingsCompactCard>
          </div>
      <ConfirmDialog isOpen={isDisableAllRelaysDialogOpen} onClose={() => setIsDisableAllRelaysDialogOpen(false)} onConfirm={handleRelayBulkDisableAllConfirm} title={t("settings.relays.disableAllDialogTitle")} description={t("settings.relays.disableAllDialogDesc")} confirmLabel={t("settings.relays.disableAllConfirm")} cancelLabel={t("common.cancel")} variant="danger"/>

      <ConfirmDialog isOpen={isClearDataDialogOpen} onClose={() => setIsClearDataDialogOpen(false)} onConfirm={handleClearData} title={t("settings.dialogs.clearDataTitle")} description={t("settings.dialogs.clearDataDesc")} confirmLabel={t("settings.actions.clear")} variant="danger"/>

      <ConfirmDialog isOpen={isResetLocalHistoryDialogOpen} onClose={() => setIsResetLocalHistoryDialogOpen(false)} onConfirm={handleResetLocalHistory} title={t("settings.security.resetLocalHistoryTitle")} description={t("settings.security.resetLocalHistoryDesc")} confirmLabel={t("settings.security.resetLocalHistoryConfirm")} variant="danger"/>

      <ConfirmDialog isOpen={isDeleteAccountDialogOpen} onClose={() => setIsDeleteAccountDialogOpen(false)} onConfirm={handleDeleteAccount} title={t("settings.dialogs.deleteAccountTitle")} description={t("settings.dialogs.deleteAccountDesc")} confirmLabel={t("settings.actions.delete")} variant="danger"/>

      <AppLockConfirmDialog
        isOpen={isLockConfirmOpen}
        onClose={closeLockConfirm}
        onConfirm={() => {
          void handleConfirmLock();
        }}
      />
    </>);
}
