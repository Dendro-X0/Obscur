"use client";
import type React from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { TextScale } from "@/app/features/settings/hooks/use-accessibility-preferences";
import { Card, Button, ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Progress, Textarea, toast } from "@dweb/ui-kit";
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
import { getLocalMediaIndexSnapshot, getLocalMediaStorageAbsolutePath, ensureLocalMediaStoragePathReady, openLocalMediaStoragePath, pickLocalMediaStorageRootPath, purgeLocalMediaCache, } from "@/app/features/vault/services/local-media-store";
import { getObscurDataRootConfig, importObscurDataFromDefault, openObscurDataRootPath, pickObscurDataRootPath, planObscurDataRootChange, preflightObscurDataRootMigration, reconnectObscurDataRootPath, buildObscurDataRootTargetPath, resolveObscurDataRootPick, DEFAULT_OBSCUR_DATA_SUBFOLDER, validateObscurDataSubfolderName, setObscurDataRootPath, type DataRootMigrationProgress, type ObscurDataRootChangePlan, type ObscurDataRootConfig, } from "@/app/features/profiles/services/obscur-data-root-service";
import { openExportsFolderInFileManager } from "@/app/features/profiles/services/data-root-export-service";
import { EncryptedWorkspaceExportPanel } from "@/app/features/profiles/components/encrypted-workspace-export-panel";
import { useDesktopProfileIsolationSnapshot } from "@/app/features/profiles/services/desktop-profile-runtime";
import { requestNativeAppRestart } from "@/app/features/runtime/native-adapters";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { useEffect, useState } from "react";
import { TrustSettingsPanel } from "@/app/features/messaging/components/trust-settings-panel";
import { PasswordResetPanel } from "@/app/features/settings/components/password-reset-panel";
import { DesktopAtRestEncryptionNotice } from "@/app/features/settings/components/desktop-at-rest-encryption-notice";
import { SecuritySettingsPanel } from "@/app/features/settings/components/security-settings-panel";
import { SettingsActionStatus } from "@/app/features/settings/components/settings-action-status";
import { ProfileSwitcherCard } from "@/app/features/profiles/components/profile-switcher-card";
import { SettingsToggle, SettingsToggleCard, toSettingsActionPhase, validateProfileInput, formatBytes, formatRatioPercent, } from "../settings-tab-panel-shared";
import { getApiBaseUrl } from "@/app/features/relays/utils/api-base-url";
import { deriveRelayNodeStatus, deriveRelayRuntimeStatus } from "@/app/features/relays/lib/relay-runtime-status";
import { checkStorageHealth, runStorageRecovery } from "@/app/features/messaging/services/storage-health-service";
import { Loader2, Activity, ShieldAlert, Shield, Lock, Database, Copy, ChevronDown, Plus, ArrowUp, ArrowDown, Eye, EyeOff, Building2, Wifi, RefreshCcw, Check, X } from "lucide-react";
import { useSettingsTabPanelModel } from "../settings-tab-panel-model-context";
import { SettingsCompactCard } from "@/app/features/settings/components/settings-compact-card";
import { useMobileCompactLayout } from "@/app/features/runtime/use-mobile-compact-layout";
function dataRootMigrationProgressPercent(progress: DataRootMigrationProgress): number {
    if (progress.bytesTotal > 0) {
        return Math.min(100, Math.round((progress.bytesCopied / progress.bytesTotal) * 100));
    }
    if (progress.itemsTotal > 0) {
        return Math.min(100, Math.round((progress.itemsCopied / progress.itemsTotal) * 100));
    }
    return progress.phase === "complete" ? 100 : 0;
}
function DataRootMigrationProgressIndicator({ progress, isActive, t, }: Readonly<{
    progress: DataRootMigrationProgress | null;
    isActive: boolean;
    t: (key: string, defaultValueOrOptions?: string | Record<string, unknown>, vars?: Record<string, unknown>) => string;
}>): React.JSX.Element | null {
    if (!isActive) {
        return null;
    }
    const snapshot = progress ?? {
        phase: "preparing",
        itemsCopied: 0,
        itemsTotal: 0,
        bytesCopied: 0,
        bytesTotal: 0,
        currentItem: null,
    };
    const percent = dataRootMigrationProgressPercent(snapshot);
    const phaseLabel = snapshot.phase === "preparing"
        ? t("settings.storage.dataFolderMigrationPhasePreparing")
        : snapshot.phase === "complete"
            ? t("settings.storage.dataFolderMigrationPhaseComplete")
            : t("settings.storage.dataFolderMigrationPhaseCopying");
    const byteSummary = snapshot.bytesTotal > 0
        ? t("settings.storage.dataFolderMigrationByteSummary", { copied: formatBytes(snapshot.bytesCopied), total: formatBytes(snapshot.bytesTotal) })
        : snapshot.itemsTotal > 0
            ? t("settings.storage.dataFolderMigrationItemSummary", { copied: snapshot.itemsCopied, total: snapshot.itemsTotal })
            : null;
    return (<div className="space-y-2">
      <Progress value={percent} showValue size="medium" className="w-full"/>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {phaseLabel}
        {byteSummary ? ` · ${byteSummary}` : ""}
        {snapshot.currentItem ? (<span className="block truncate pt-0.5 text-zinc-400 dark:text-zinc-500">{snapshot.currentItem}</span>) : null}
      </p>
    </div>);
}
export default function StorageSettingsTabPanel(): React.JSX.Element {
    const { APP_VERSION, DEFAULT_APP_LANGUAGE, DEFAULT_STABLE_PRESET, DEFAULT_THEME_PREFERENCE, DELETE_ACCOUNT_CONFIRM_TEXT, ENABLE_API_HEALTH_PROBE, INVITE_CODE_PREFIX, INVITE_CODE_SUFFIX_LENGTH, RELAY_PRESETS, TEXT_SCALE_OPTIONS, accessibility, accountSyncSnapshot, activeTab, apiHealth, appearanceActionMessage, appearanceActionPhase, applyRelayPreset, blocklist, blocklistInput, blocklistQuery, challangePassword, checkStorageHealth, clearIndexedDbDatabases, clearRuntimeCaches, copyPrivateKey, deleteAccountConfirmInput, deleteAccountCountdown, deriveRelayNodeStatus, deriveRelayRuntimeStatus, derivedPublicKeyHex, displayPublicKeyHex, exportPrivateKey, filteredBlockedKeys, getProfilePublishReportSnapshot, handleAddBlockedKey, handleAddRelay, handleArmDeleteAccount, handleCheckApi, handleCheckProviderReachability, handleClearData, handleDeleteAccount, handleDisableNotifications, handleEnableNotifications, handleExportPortableBundle, handleLockNow, handlePortableBundleFileSelected, handleProfileSwitchLock, handleRandomInviteCode, handleRefreshRelayStatus, handleRelayBulkCopyList, handleRelayBulkDisableAllConfirm, handleRelayBulkDisableAllRequest, handleRelayBulkEnableAll, handleRelayBulkRemoveDisabled, handleResetAccessibility, handleResetLanguage, handleResetLocalHistory, handleResetRelaySection, handleResetStorageSection, handleResetTheme, handleRevealToggle, handleSavePrivacy, handleSaveProfile, handleSendTestNotification, handleToggleNotificationChannel, handleUnblockAll, handleVerifyChallenge, handleVerifyNip05, i18n, identity, identityDiagnostics, identityIntegrityState, identityStorageMode, inviteCodeAvailabilityMessage, inviteCodeAvailabilityStatus, inviteCodeDraft, inviteCodeDraftSuffix, isChallenging, isCheckingProviderReachability, isCheckingStorageHealth, isClearDataDialogOpen, isDeleteAccountDialogOpen, isDisableAllRelaysDialogOpen, isInviteCodeDraftDirty, isPortableBundleExporting, isPortableBundleImporting, isPrivateKeyVisible, isPublishing, isResetLocalHistoryDialogOpen, isResolvingLocalPath, isVerifyingNip05, lastSyncLabel, leaveJoinedCommunitiesBeforeAccountDeletion, localMediaAbsolutePath, localMediaConfig, managedWorkspaceDefinition, moderationActionMessage, moderationActionPhase, newRelayUrl, nip96Config, notificationActionMessage, notificationActionPhase, notificationPreference, npubValue, nsecKey, persistedInviteCodeSuffix, pool, portableBundleFileInputRef, privacySettings, profile, profilePreflightError, profilePublishError, profilePublishPhase, profilePublishReport, profileSaveActionMessage, profileSaveActionPhase, profileValidation, providerReachabilityNote, providerValidation, publicKeyHex, publishProfile, publishScopedGroupEvent, refreshLocalMediaAbsolutePath, relayActionMessage, relayActionPhase, relayCapabilityAssessment, relayConnectionMap, relayHealthMetricsMap, relayList, relayQuickHealth, relayResilienceBetaGate, relayResiliencePerformanceGate, relayResilienceSnapshot, relayRuntime, relayRuntimeStatus, relaySelection, reliabilityMetrics, reliabilityRuntime, reliabilityTick, resolveActivePrivateKeyHex, revealExpiresAtMs, revealSecondsLeft, rolloutPolicy, runStorageRecovery, saveLocalMediaConfig, saveNip96Config, securityActionMessage, securityActionPhase, securityCapabilityStates, securityPosture, setApiHealth, setAppearanceActionMessage, setAppearanceActionPhase, setBlocklistInput, setBlocklistQuery, setChallengePassword, setDeleteAccountConfirmInput, setDeleteAccountCountdown, setInviteCodeAvailabilityMessage, setInviteCodeAvailabilityStatus, setInviteCodeDraftSuffix, setInviteCodeFromSuffix, setIsChallenging, setIsCheckingProviderReachability, setIsCheckingStorageHealth, setIsClearDataDialogOpen, setIsDeleteAccountDialogOpen, setIsDisableAllRelaysDialogOpen, setIsInviteCodeDraftDirty, setIsPortableBundleExporting, setIsPortableBundleImporting, setIsPrivateKeyVisible, setIsResetLocalHistoryDialogOpen, setIsResolvingLocalPath, setIsVerifyingNip05, setLocalMediaAbsolutePath, setLocalMediaConfig, setModerationActionMessage, setModerationActionPhase, setNewRelayUrl, setNip96Config, setNotificationActionMessage, setNotificationActionPhase, setNsecKey, setPrivacySettings, setProfilePreflightError, setProfileSaveActionMessage, setProfileSaveActionPhase, setProviderReachabilityNote, setRelayActionMessage, setRelayActionPhase, setReliabilityTick, setRevealExpiresAtMs, setRevealSecondsLeft, setSecurityActionMessage, setSecurityActionPhase, setShowAdvancedRelays, setStorageActionMessage, setStorageActionPhase, setStorageHealthState, setStorageStatsTick, showAdvancedRelays, sovereignRoomDefinition, startupState, storageActionMessage, storageActionPhase, storageHealthState, storageMode, storageStats, storageStatsTick, t, theme, translatePermissionState, translateRelayConfidenceLabel, translateRelayNodeBadge, translateRelayNodeDetail, translateRelayNodeRole, translateRelayPresetLabel, translateRelayRuntimeText, translateStorageMode, triggerRelayRecovery, userInviteCode, verifyInviteCodeAvailability, wipeLocalRuntimeData } = useSettingsTabPanelModel() as Record<string, any>;
  const desktopSnapshot = useDesktopProfileIsolationSnapshot();
    const isNativeDesktop = hasNativeRuntime();
  const [dataRootConfig, setDataRootConfig] = useState<ObscurDataRootConfig | null>(null);
  const [isLoadingDataRoot, setIsLoadingDataRoot] = useState(false);
  const [isSavingDataRoot, setIsSavingDataRoot] = useState(false);
    const [dataRootMigrationProgress, setDataRootMigrationProgress] = useState<DataRootMigrationProgress | null>(null);
    const [pendingDataRootPath, setPendingDataRootPath] = useState<string | null | undefined>(undefined);
    const [pendingDataRootPlan, setPendingDataRootPlan] = useState<ObscurDataRootChangePlan | null>(null);
    const [isDataRootMigrationDialogOpen, setIsDataRootMigrationDialogOpen] = useState(false);
    const [isDataRootReconnectDialogOpen, setIsDataRootReconnectDialogOpen] = useState(false);
    const [isDataRootConflictDialogOpen, setIsDataRootConflictDialogOpen] = useState(false);
    const [isDataRootOverwriteDialogOpen, setIsDataRootOverwriteDialogOpen] = useState(false);
    const [isDataRootImportDialogOpen, setIsDataRootImportDialogOpen] = useState(false);
    const [isDataRootSubfolderDialogOpen, setIsDataRootSubfolderDialogOpen] = useState(false);
    const [pendingDataRootParentPath, setPendingDataRootParentPath] = useState("");
    const [pendingDataRootSubfolderName, setPendingDataRootSubfolderName] = useState(DEFAULT_OBSCUR_DATA_SUBFOLDER);
    const [pendingDataRootIntent, setPendingDataRootIntent] = useState<"change" | "reconnect">("change");
    const [pendingDataRootTargetPreview, setPendingDataRootTargetPreview] = useState("");
    const resetPendingDataRootChange = () => {
        setPendingDataRootPath(undefined);
        setPendingDataRootPlan(null);
        setPendingDataRootParentPath("");
        setPendingDataRootSubfolderName(DEFAULT_OBSCUR_DATA_SUBFOLDER);
        setPendingDataRootTargetPreview("");
        setIsDataRootSubfolderDialogOpen(false);
    };
    const continueDataRootChange = async (targetPath: string, intent: "change" | "reconnect") => {
        if (targetPath === dataRootConfig?.effectivePath) {
            return;
        }
        const plan = await planObscurDataRootChange(targetPath);
        if (plan.pathsEquivalent) {
            toast.info(t("settings.storage.dataFolderAlreadyBound"));
            return;
        }
        setPendingDataRootPath(targetPath);
        setPendingDataRootPlan(plan);
        if (plan.targetHasObscurData && intent === "change") {
            setIsDataRootConflictDialogOpen(true);
        }
        else if (plan.targetHasObscurData) {
            setIsDataRootReconnectDialogOpen(true);
        }
        else {
            setIsDataRootMigrationDialogOpen(true);
        }
    };
    const beginDataRootFolderPick = async (intent: "change" | "reconnect") => {
        try {
            const selected = await pickObscurDataRootPath();
            if (!selected)
                return;
            const resolution = await resolveObscurDataRootPick(selected, intent);
            if (resolution.showSubfolderDialog) {
                setPendingDataRootParentPath(resolution.parentPath);
                setPendingDataRootSubfolderName(resolution.subfolderName);
                setPendingDataRootTargetPreview(resolution.targetPath);
                setPendingDataRootIntent(intent);
                setIsDataRootSubfolderDialogOpen(true);
                return;
            }
            await continueDataRootChange(resolution.targetPath, intent);
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to pick data folder.");
        }
    };
    const confirmDataRootSubfolderSelection = async () => {
        const validationError = validateObscurDataSubfolderName(pendingDataRootSubfolderName);
        if (validationError) {
            toast.error(validationError);
            return;
        }
        try {
            const targetPath = await buildObscurDataRootTargetPath(pendingDataRootParentPath, pendingDataRootSubfolderName);
            setIsDataRootSubfolderDialogOpen(false);
            await continueDataRootChange(targetPath, pendingDataRootIntent);
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to prepare data folder.");
        }
    };
    const formatDataFolderPath = (path: string | null | undefined) => (path ?? "").replace(/^\\\\\?\\/, "");
    useEffect(() => {
        if (!isDataRootSubfolderDialogOpen || !pendingDataRootParentPath) {
            return;
        }
        let cancelled = false;
        void buildObscurDataRootTargetPath(pendingDataRootParentPath, pendingDataRootSubfolderName)
            .then((targetPath) => {
            if (!cancelled) {
                setPendingDataRootTargetPreview(targetPath);
            }
        })
            .catch(() => {
            if (!cancelled) {
                setPendingDataRootTargetPreview("");
            }
        });
        return () => {
            cancelled = true;
        };
    }, [isDataRootSubfolderDialogOpen, pendingDataRootParentPath, pendingDataRootSubfolderName]);
    const buildReconnectDialogDescription = (plan: ObscurDataRootChangePlan | null, targetPath: string | null | undefined) => {
        const base = t("settings.storage.dataFolderReconnectDialogDesc", isNativeDesktop
            ? "Obscur will use the data already at {{path}}. Nothing is copied. A backup pointer is restored so deleting AppData does not lose this path again. Obscur will restart automatically after you confirm."
            : "Obscur will use the data already at {{path}}. Nothing is copied. Your profiles, database, and vault cache at that location will load after restart. A backup pointer is restored so deleting AppData does not lose this path again.", { path: targetPath ?? "selected folder" });
        if (!plan?.anchorWouldBeReplaced) {
            return base;
        }
        return `${base}\n\n${t("settings.storage.dataFolderAnchorReplaceWarning", { anchor: plan.anchorPath, path: targetPath ?? "selected folder" })}`;
    };
    const finishDataRootChange = async (next: ObscurDataRootConfig, successMessage: string): Promise<void> => {
        setDataRootConfig(next);
        await refreshLocalMediaAbsolutePath();
        toast.success(successMessage);
        if (!isNativeDesktop) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
        const restart = await requestNativeAppRestart();
        if (!restart.ok) {
            toast.error(t("settings.storage.dataFolderRestartFailed"));
        }
    };
    const applyDataRootChange = async (customPath: string | null, migrateExisting: boolean, overwriteDestination = false) => {
        setIsSavingDataRoot(true);
        setDataRootMigrationProgress(null);
        try {
            const next = await setObscurDataRootPath(customPath, {
                migrateExisting,
                overwriteDestination,
                onMigrationProgress: migrateExisting ? setDataRootMigrationProgress : undefined,
            });
            const successMessage = next.migrationCopiedCount && next.migrationCopiedCount > 0
                ? overwriteDestination
                    ? t("settings.storage.dataFolderOverwriteSuccess", { count: next.migrationCopiedCount })
                    : next.migrationSkippedCount && next.migrationSkippedCount > 0
                        ? t("settings.storage.dataFolderMigrationSkippedCacheSuccess", { count: next.migrationCopiedCount, skipped: next.migrationSkippedCount })
                        : t("settings.storage.dataFolderMigrationSuccess", { count: next.migrationCopiedCount })
                : t("settings.storage.dataFolderUpdated");
            await finishDataRootChange(next, successMessage);
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to set data folder.");
            throw error;
        }
        finally {
            setIsSavingDataRoot(false);
            setDataRootMigrationProgress(null);
        }
    };
  useEffect(() => {
    let cancelled = false;
    void getObscurDataRootConfig()
      .then((config) => {
        if (!cancelled) {
          setDataRootConfig(config);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDataRootConfig(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const compact = useMobileCompactLayout();
    return (<>
        <SettingsCompactCard title={t("settings.tabs.storage")} description={t("settings.storage.desc")} className="w-full">
          <div className={compact ? "space-y-4" : "space-y-8"}>
            <div className={cn("flex items-center justify-between gap-4", compact ? "py-1" : "rounded-2xl border border-black/5 bg-zinc-50/50 p-5 dark:border-white/5 dark:bg-zinc-900/50")}>
              <div className="min-w-0 space-y-1">
                  <Label className={cn("font-semibold", compact ? "text-sm" : "text-base")}>{t("settings.storage.effectiveModeTitle")}</Label>
                  {!compact ? (<p className="text-xs text-zinc-500">{t("settings.storage.effectiveModeDesc")}</p>) : null}
              </div>
              <span className={cn("rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide", storageMode === "hybrid" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", storageMode === "nip96" && "bg-blue-500/15 text-blue-600 dark:text-blue-400", storageMode === "local_vault" && "bg-amber-500/15 text-amber-600 dark:text-amber-400", storageMode === "disabled" && "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400")}>
                {translateStorageMode(storageMode)}
              </span>
              </div>

              {/* Chat Performance Mode */}
              <SettingsToggleCard title={t("settings.storage.performanceModeTitle")} description={t("settings.storage.performanceModeDesc")} checked={privacySettings.chatPerformanceV2} onChange={(checked) => handleSavePrivacy({ ...privacySettings, chatPerformanceV2: checked })}/>

              {/* v0.8.3 UX rollout */}
              <SettingsToggleCard title={t("settings.storage.chatUxV083Title")} description={t("settings.storage.chatUxV083Desc")} checked={privacySettings.chatUxV083} onChange={(checked) => handleSavePrivacy({ ...privacySettings, chatUxV083: checked })}/>

              {/* v0.8.7 reliability core rollout */}
              <SettingsToggleCard title={t("settings.storage.reliabilityCoreV087Title")} description={t("settings.storage.reliabilityCoreV087Desc")} checked={privacySettings.reliabilityCoreV087} onChange={(checked) => handleSavePrivacy({ ...privacySettings, reliabilityCoreV087: checked })}/>

              <SettingsToggleCard title={t("settings.storage.stabilityModeV090Title")} description={t("settings.storage.stabilityModeV090Desc")} checked={privacySettings.stabilityModeV090} onChange={(checked) => handleSavePrivacy({
                  ...privacySettings,
                  stabilityModeV090: checked,
                  deterministicDiscoveryV090: checked ? false : privacySettings.deterministicDiscoveryV090,
        })} highlighted/>

              <SettingsToggleCard title={t("settings.storage.deterministicDiscoveryV090Title")} description={t("settings.storage.deterministicDiscoveryV090Desc")} checked={privacySettings.deterministicDiscoveryV090} onChange={(checked) => handleSavePrivacy({
                  ...privacySettings,
                  deterministicDiscoveryV090: checked,
                  stabilityModeV090: checked ? false : privacySettings.stabilityModeV090,
        })}/>

              <SettingsToggleCard title={t("settings.storage.protocolCoreRustV090Title")} description={t("settings.storage.protocolCoreRustV090Desc")} checked={privacySettings.protocolCoreRustV090} onChange={(checked) => handleSavePrivacy({
                  ...privacySettings,
                  protocolCoreRustV090: checked,
                  x3dhRatchetV090: checked ? privacySettings.x3dhRatchetV090 : false,
                  stabilityModeV090: checked ? false : privacySettings.stabilityModeV090,
        })}/>

              <SettingsToggleCard title={t("settings.storage.x3dhRatchetV090Title")} description={t("settings.storage.x3dhRatchetV090Desc")} checked={privacySettings.x3dhRatchetV090} onChange={(checked) => handleSavePrivacy({
                  ...privacySettings,
                  x3dhRatchetV090: checked,
                  protocolCoreRustV090: checked ? true : privacySettings.protocolCoreRustV090,
                  stabilityModeV090: checked ? false : privacySettings.stabilityModeV090,
        })}/>

              <div className="rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-white dark:bg-black/20 space-y-4">
                <div className="space-y-1">
                  <Label className="font-semibold text-base">{t("settings.storage.discoveryRolloutFlagsTitle")}</Label>
                  <p className="text-xs text-zinc-500">
                    {t("settings.storage.discoveryRolloutFlagsDesc")}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-black/5 p-3 dark:border-white/10 bg-zinc-50/60 dark:bg-zinc-900/40">
                  <div>
                    <p className="text-sm font-semibold">{t("settings.storage.discoveryInviteCodeTitle")}</p>
                    <p className="text-xs text-zinc-500">{t("settings.storage.discoveryInviteCodeDesc")}</p>
                  </div>
                  <SettingsToggle checked={privacySettings.discoveryInviteCodeV1 === true} onChange={(checked) => handleSavePrivacy({
                      ...privacySettings,
                      discoveryInviteCodeV1: checked,
        })}/>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-black/5 p-3 dark:border-white/10 bg-zinc-50/60 dark:bg-zinc-900/40">
                  <div>
                    <p className="text-sm font-semibold">{t("settings.storage.discoveryDeepLinkTitle")}</p>
                    <p className="text-xs text-zinc-500">{t("settings.storage.discoveryDeepLinkDesc")}</p>
                  </div>
                  <SettingsToggle checked={privacySettings.discoveryDeepLinkV1 === true} onChange={(checked) => handleSavePrivacy({
                      ...privacySettings,
                      discoveryDeepLinkV1: checked,
        })}/>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-black/5 p-3 dark:border-white/10 bg-zinc-50/60 dark:bg-zinc-900/40">
                  <div>
                    <p className="text-sm font-semibold">{t("settings.storage.discoverySuggestionsTitle")}</p>
                    <p className="text-xs text-zinc-500">{t("settings.storage.discoverySuggestionsDesc")}</p>
                  </div>
                  <SettingsToggle checked={privacySettings.discoverySuggestionsV1 === true} onChange={(checked) => handleSavePrivacy({
                      ...privacySettings,
                      discoverySuggestionsV1: checked,
        })}/>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-black/5 p-3 dark:border-white/10 bg-zinc-50/60 dark:bg-zinc-900/40">
                  <div>
                    <p className="text-sm font-semibold">{t("settings.storage.tanstackQueryTitle")}</p>
                    <p className="text-xs text-zinc-500">{t("settings.storage.tanstackQueryDesc")}</p>
                  </div>
                  <SettingsToggle checked={privacySettings.tanstackQueryV1 === true} onChange={(checked) => handleSavePrivacy({
                      ...privacySettings,
                      tanstackQueryV1: checked,
        })}/>
                </div>
              </div>

              <div className="rounded-xl border border-black/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-900/40 text-xs text-zinc-500">
                Effective v0.9 policy: stability={rolloutPolicy.stabilityModeEnabled ? "on" : "off"}, protocol-core={rolloutPolicy.protocolCoreEnabled ? "on" : "off"}, deterministic-discovery={rolloutPolicy.deterministicDiscoveryEnabled ? "on" : "off"}, x3dh-ratchet={rolloutPolicy.x3dhRatchetEnabled ? "on" : "off"}, tanstack-query={rolloutPolicy.tanstackQueryEnabled ? "on" : "off"}.
                <br />
                Discovery lanes: invite-code={privacySettings.discoveryInviteCodeV1 ? "on" : "off"}, deep-link={privacySettings.discoveryDeepLinkV1 ? "on" : "off"}, suggestions={privacySettings.discoverySuggestionsV1 ? "on" : "off"}.
              </div>

              <div className="rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-white dark:bg-black/20 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <Label className="font-semibold text-base">Reliability Status</Label>
                  <Button type="button" variant="outline" size="sm" disabled={isCheckingStorageHealth} onClick={async () => {
                      setIsCheckingStorageHealth(true);
                      try {
                        const health = await checkStorageHealth();
                        setStorageHealthState(health);
                        setStorageStatsTick((prev: number) => prev + 1);
            }
            finally {
                        setIsCheckingStorageHealth(false);
                      }
        }}>
                    {isCheckingStorageHealth ? "Checking..." : "Refresh Health"}
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                    Relay summary: <span className="font-semibold">{relayRuntimeStatus.status}</span>
                  </div>
                  <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                    Last sync: <span className="font-semibold">{lastSyncLabel}</span>
                  </div>
                  <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                    Pending/retry: <span className="font-semibold">{reliabilityMetrics.relay_reconnect_suppressed + reliabilityMetrics.relay_publish_partial}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                  <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                    Reconnect suppressed: <span className="font-semibold">{reliabilityMetrics.relay_reconnect_suppressed}</span>
                  </div>
                  <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                    Relay cooling down: <span className="font-semibold">{reliabilityMetrics.relay_cooling_down}</span>
                  </div>
                  <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                    Sync backfills: <span className="font-semibold">{reliabilityMetrics.sync_backfill_requested}</span>
                  </div>
                  <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                    Checkpoint repairs: <span className="font-semibold">{reliabilityMetrics.sync_checkpoint_repaired}</span>
                  </div>
                  <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                    Storage health failures: <span className="font-semibold">{reliabilityMetrics.storage_health_failed}</span>
                  </div>
                  <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                    Storage recovered records: <span className="font-semibold">{reliabilityMetrics.storage_recovery_records}</span>
                  </div>
                  <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                    Storage retries: <span className="font-semibold">{reliabilityMetrics.storage_write_retry}</span>
                  </div>
                  <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                    Relay perf warns: <span className="font-semibold">{reliabilityMetrics.relay_runtime_performance_warn}</span>
                  </div>
                  <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                    Relay perf fails: <span className="font-semibold">{reliabilityMetrics.relay_runtime_performance_fail}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-black/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-900/40">
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Relay Resilience SLO (Phase 4)</div>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                      Recovery p95: <span className="font-semibold">{relayResilienceSnapshot.recoveryLatency.sampleCount > 0 ? `${relayResilienceSnapshot.recoveryLatency.p95LatencyMs} ms` : "n/a"}</span>
                    </div>
                    <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                      Replay success: <span className="font-semibold">{formatRatioPercent(relayResilienceSnapshot.replay.successRatio)}</span>
                    </div>
                    <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                      Scoped blocked: <span className="font-semibold">{formatRatioPercent(relayResilienceSnapshot.scopedReadiness.blockedByReadinessRatio)}</span>
                    </div>
                    <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                      Operator interventions: <span className="font-semibold">{relayResilienceSnapshot.operatorInterventionCount}</span>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                      Replay samples: <span className="font-semibold">{relayResilienceSnapshot.replay.attemptedReplayCount}</span>
                    </div>
                    <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                      Scoped publish samples: <span className="font-semibold">{relayResilienceSnapshot.scopedReadiness.scopedPublishAttemptCount}</span>
                    </div>
                    <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                      Observation window: <span className="font-semibold">{Math.round(relayResilienceSnapshot.observedWindowMs / 60000)} min</span>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                    Beta gate: <span className={cn("font-semibold", relayResilienceBetaGate.ready ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                      {relayResilienceBetaGate.ready ? "ready" : "not_ready"}
                    </span>
                    {!relayResilienceBetaGate.ready ? (<div className="mt-1 text-[11px] text-zinc-500">
                        Reasons: {relayResilienceBetaGate.reasons.join(", ")}
                      </div>) : null}
                  </div>
                  <div className="mt-3 rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                    Runtime performance gate: <span className={cn("font-semibold", relayResiliencePerformanceGate.status === "pass"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : relayResiliencePerformanceGate.status === "warn"
                            ? "text-amber-600 dark:text-amber-400"
                : "text-rose-600 dark:text-rose-400")}>
                      {relayResiliencePerformanceGate.status}
                    </span>
                    {relayResiliencePerformanceGate.status !== "pass" ? (<div className="mt-1 text-[11px] text-zinc-500">
                        Reasons: {relayResiliencePerformanceGate.reasons.join(", ")}
                      </div>) : null}
                  </div>
                </div>

                <div id="storage-health" className="rounded-xl border border-black/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-900/40">
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Storage Health</div>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                      Message store: <span className="font-semibold">{storageHealthState.messageStoreOk ? "ok" : "error"}</span>
                    </div>
                    <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                      Queue store: <span className="font-semibold">{storageHealthState.queueStoreOk ? "ok" : "error"}</span>
                    </div>
                    <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                      Media index: <span className="font-semibold">{storageHealthState.mediaIndexOk ? "ok" : "error"}</span>
                    </div>
                  </div>
                  {!storageHealthState.mediaIndexOk || !storageHealthState.messageStoreOk || !storageHealthState.queueStoreOk ? (<div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={async () => {
                          const report = await runStorageRecovery();
                          setStorageActionPhase("success");
                          setStorageActionMessage(`Storage repair complete: repaired ${report.repairedEntries}, removed ${report.removedEntries}.`);
                          setStorageStatsTick((prev: number) => prev + 1);
                          const health = await checkStorageHealth();
                          setStorageHealthState(health);
            }}>
                        Run Repair
                      </Button>
                      {storageHealthState.errorMessage ? (<span className="text-[11px] text-rose-600 dark:text-rose-400">{storageHealthState.errorMessage}</span>) : null}
                    </div>) : null}
                </div>
              </div>

              {/* Media Upload Provider */}
              <div className="space-y-4 rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-white dark:bg-black/20">
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <Label className="font-semibold text-base">{t("settings.storage.providerLabel")}</Label>
                    <p className="text-xs text-zinc-500">Configure your preferred NIP-96 compliant storage server for profile pictures and chat media.</p>
                  </div>
                  <SettingsToggle checked={nip96Config.enabled} onChange={(checked) => saveNip96Config({ ...nip96Config, enabled: checked })}/>
                </div>

                <div className={cn("transition-all duration-300", nip96Config.enabled ? "opacity-100" : "opacity-50 pointer-events-none")}>
                  <Input value={nip96Config.apiUrl} onChange={(e) => saveNip96Config({ ...nip96Config, apiUrl: e.target.value })} placeholder="https://api.provider.com/upload" className="bg-zinc-50 dark:bg-zinc-900 font-mono text-sm"/>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", providerValidation.state === "success" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", providerValidation.state === "error" && "bg-rose-500/15 text-rose-600 dark:text-rose-400", providerValidation.state === "idle" && "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400")}>
                      {providerValidation.message}
                    </span>
                    <Button type="button" variant="outline" size="sm" disabled={providerValidation.state !== "success" || isCheckingProviderReachability} onClick={() => void handleCheckProviderReachability()}>
                      {isCheckingProviderReachability ? "Checking..." : "Check Provider"}
                    </Button>
                  </div>
                  {providerReachabilityNote ? (<div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">{providerReachabilityNote}</div>) : null}
                </div>
              </div>

              {/* Obscur Data Root + Encrypted Workspace Export */}
              <div className="space-y-6 rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-white dark:bg-black/20">
                <div className="space-y-1">
                  <Label className="font-semibold text-base">{t("settings.storage.dataFolderTitle")}</Label>
                  <p className="text-xs text-zinc-500 whitespace-pre-line">
                    {t("settings.storage.dataFolderDesc")}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {t("settings.storage.dataFolderSlowStorageNote")}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {t("settings.storage.dataFolderRestartNote", isNativeDesktop
            ? "When you pick a drive or parent folder, Obscur creates app.obscur.desktop inside it by default (you can rename it). Obscur restarts automatically after you confirm a folder change. Existing data is copied when needed."
            : "When you pick a drive or parent folder, Obscur creates app.obscur.desktop inside it by default (you can rename it). Restart Obscur after changing this path. Existing data is copied when needed.")}
                  </p>
                  <p className="text-[11px] text-amber-600/90 dark:text-amber-400/90">
                    {t("settings.storage.dataFolderCommunityWarning")}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 whitespace-pre-line">
                    {t("settings.storage.dataFolderBindDesc")}
                  </p>
                  <p className="text-[11px] text-amber-600/90 dark:text-amber-400/90">
                    {t("settings.storage.dataFolderPointerWarning")}
                  </p>
                  {isNativeDesktop ? <DesktopAtRestEncryptionNotice variant="card" className="mt-2"/> : null}
                </div>

                {dataRootConfig?.physicalPathSlow ? (<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-100/90 dark:text-amber-200/90">
                    <div className="font-semibold">
                      {t("settings.storage.dataFolderSlowBannerTitle")}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                      {dataRootConfig.physicalPathIssue
                ?? t("settings.storage.dataFolderSlowBannerDesc")}
                    </p>
                  </div>) : null}

                {dataRootConfig?.recoverableCustomPath ? (<div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-100/90 dark:text-emerald-200/90">
                    <div className="font-semibold">
                      {t("settings.storage.dataFolderRecoverBannerTitle")}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                      {t("settings.storage.dataFolderRecoverBannerDesc", { path: dataRootConfig.recoverableCustomPath })}
                    </p>
                    <div className="mt-3 flex justify-end">
                      <Button type="button" variant="secondary" size="sm" disabled={isSavingDataRoot} onClick={async () => {
                setPendingDataRootPath(dataRootConfig.recoverableCustomPath ?? null);
                setIsDataRootReconnectDialogOpen(true);
            }}>
                        {t("settings.storage.dataFolderRecoverAction")}
                      </Button>
                    </div>
                  </div>) : null}

                {dataRootConfig?.canImportFromDefault ? (<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-100/90 dark:text-amber-200/90">
                    <div className="font-semibold">
                      {t("settings.storage.dataFolderImportBannerTitle")}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                      {t("settings.storage.dataFolderImportBannerDesc", { path: dataRootConfig.defaultPath })}
                    </p>
                    <div className="mt-3 flex justify-end">
                      <Button type="button" variant="secondary" size="sm" disabled={isSavingDataRoot} onClick={() => setIsDataRootImportDialogOpen(true)}>
                        {t("settings.storage.dataFolderImportAction")}
                      </Button>
                    </div>
                  </div>) : null}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-black/5 dark:border-white/5">
                  <div className="space-y-1 overflow-hidden">
                    <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Data location</div>
                    <div className="text-sm font-mono text-zinc-800 dark:text-zinc-200 truncate">
                      {isLoadingDataRoot ? "Loading..." : (formatDataFolderPath(dataRootConfig?.effectivePath) || "Default app data")}
                    </div>
                    {dataRootConfig?.appDataPath ? (<div className="text-[11px] text-zinc-500 truncate">
                        App path: {dataRootConfig.appDataPath}
                        {dataRootConfig.storageMode === "junction" ? " (junction)" : ""}
                        {dataRootConfig.storageMode === "symlink" ? " (symlink)" : ""}
                        {dataRootConfig.storageMode === "pointer" ? " (pointer)" : ""}
                      </div>) : null}
                    {dataRootConfig?.authoritySource && dataRootConfig.authoritySource !== "default_appdata" ? (<div className="text-[11px] text-emerald-600/90 dark:text-emerald-400/90">
                        {t("settings.storage.dataFolderAuthority", {
                source: dataRootConfig.authoritySource.replace(/_/g, " "),
            })}
                        {dataRootConfig.pointerHealed
                ? ` · ${t("settings.storage.dataFolderBindHealed")}`
                : ""}
                      </div>) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button type="button" variant="secondary" size="sm" disabled={isSavingDataRoot || !isNativeDesktop} onClick={() => void beginDataRootFolderPick("reconnect")}>
                      {t("settings.storage.dataFolderReconnectAction")}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" disabled={isSavingDataRoot || !isNativeDesktop} onClick={() => void beginDataRootFolderPick("change")}>
                      Change Folder
                    </Button>
                    <Button type="button" variant="secondary" size="sm" disabled={!dataRootConfig?.effectivePath} onClick={() => void openExportsFolderInFileManager()}>
                      Encrypted Backups
                    </Button>
                    <Button type="button" variant="secondary" size="sm" disabled={!dataRootConfig?.effectivePath} onClick={async () => {
            if (!dataRootConfig?.effectivePath)
                return;
                        const opened = await openObscurDataRootPath(dataRootConfig.effectivePath);
                        if (!opened) {
                          toast.error("Could not open folder in this runtime.");
                        }
        }}>
                      Open
                    </Button>
                  </div>
                </div>

                {dataRootConfig?.effectivePath ? (<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                      <div className="font-semibold uppercase tracking-wider text-zinc-500">
                        {t("settings.storage.dataFolderExportsLabel")}
                      </div>
                      <div className="mt-1 font-mono truncate text-zinc-700 dark:text-zinc-300">
                        {dataRootConfig.exportsPath || "—"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                      <div className="font-semibold uppercase tracking-wider text-zinc-500">
                        {t("settings.storage.dataFolderArchivesLabel")}
                      </div>
                      <div className="mt-1 font-mono truncate text-zinc-700 dark:text-zinc-300">
                        {dataRootConfig.profileArchivesPath || "—"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                      <div className="font-semibold uppercase tracking-wider text-zinc-500">
                        {t("settings.storage.dataFolderVaultLabel")}
                      </div>
                      <div className="mt-1 font-mono truncate text-zinc-700 dark:text-zinc-300">
                        {dataRootConfig.vaultMediaPath || localMediaAbsolutePath || "—"}
                      </div>
                    </div>
                  </div>) : null}

                {dataRootConfig?.customPath ? (<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    {dataRootConfig.canImportFromDefault ? (<p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {t("settings.storage.dataFolderImportHint", { path: dataRootConfig.defaultPath })}
                      </p>) : (<span />)}
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      {dataRootConfig.canImportFromDefault ? (<Button type="button" variant="secondary" size="sm" className="h-7 text-xs" disabled={isSavingDataRoot} onClick={() => setIsDataRootImportDialogOpen(true)}>
                          {t("settings.storage.dataFolderImportAction")}
                        </Button>) : null}
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-zinc-500" disabled={isSavingDataRoot} onClick={() => {
                setPendingDataRootPath(null);
                setIsDataRootMigrationDialogOpen(true);
            }}>
                      Reset to Default Path
                    </Button>
                  </div>
                  </div>) : null}

                <EncryptedWorkspaceExportPanel publicKeyHex={publicKeyHex} profileLabel={desktopSnapshot.currentWindow.profileLabel} resolveActivePrivateKeyHex={resolveActivePrivateKeyHex} t={t}/>
              </div>

              {/* Local Vault Data */}
              <div className="space-y-6 rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-white dark:bg-black/20">
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <Label className="font-semibold text-base">{t("settings.storage.localVaultTitle")}</Label>
                    <p className="text-xs text-zinc-500 whitespace-pre-line">
                      {t("settings.storage.localVaultDesc")}
                    </p>
                  </div>
                  <SettingsToggle checked={localMediaConfig.enabled} onChange={(checked) => saveLocalMediaConfig({ ...localMediaConfig, enabled: checked })}/>
                </div>

                <div className={cn("space-y-6 transition-all duration-300", localMediaConfig.enabled ? "opacity-100" : "opacity-50 pointer-events-none")}>
                  {/* Path Configuration */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Storage Location</Label>

                    {isNativeDesktop ? (<div className="space-y-1">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {t("settings.storage.vaultUnderDataFolderNote")}
                      </p>
                        <p className="text-xs text-emerald-700/90 dark:text-emerald-300/90">
                        {t("settings.storage.vaultEncryptedSandboxNote")}
                      </p>
                      </div>) : null}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-black/5 dark:border-white/5">
                      <div className="space-y-1 overflow-hidden">
                        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Calculated Path</div>
                        <div className="text-sm font-mono text-zinc-800 dark:text-zinc-200 truncate">
                          {isResolvingLocalPath ? "Resolving..." : (dataRootConfig?.vaultMediaPath || localMediaAbsolutePath || "Default App Data")}
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        {!isNativeDesktop ? (<Button type="button" variant="ghost" size="sm" onClick={async () => {
                            const previousConfig = localMediaConfig;
                            const selected = await pickLocalMediaStorageRootPath();
                if (!selected)
                    return;
                            saveLocalMediaConfig({ ...localMediaConfig, customRootPath: selected });
                            const isReady = await ensureLocalMediaStoragePathReady();
                            if (!isReady) {
                              saveLocalMediaConfig(previousConfig);
                              await refreshLocalMediaAbsolutePath();
                              toast.error("Unable to use this folder. Please choose a different location.");
                              return;
                            }
                            await refreshLocalMediaAbsolutePath();
                toast.success(t("settings.storage.pathSelected"));
            }}>
                          Change Folder
                          </Button>) : null}
                        <Button type="button" variant="secondary" size="sm" onClick={async () => {
                            const opened = await openLocalMediaStoragePath();
                            if (!opened) {
                              toast.error("Could not open folder in this runtime. You can copy the path above.");
                            }
        }}>
                          Open
                        </Button>
                      </div>
                    </div>

                    {!isNativeDesktop && localMediaConfig.customRootPath ? (<div className="flex justify-end pt-1">
                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-zinc-500" onClick={async () => {
                            saveLocalMediaConfig({ ...localMediaConfig, customRootPath: "" });
                            await refreshLocalMediaAbsolutePath();
                toast.success(t("settings.storage.pathResetToDefault"));
            }}>
                          Reset to Default Path
                        </Button>
                      </div>) : null}
                  </div>

                  {/* Download destination */}
                  {isNativeDesktop ? (<div className="space-y-3">
                      <Label className="text-sm font-semibold">Download Destination</Label>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-black/5 dark:border-white/5">
                        <div className="space-y-1 overflow-hidden">
                          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Default Folder</div>
                          <div className="text-sm font-mono text-zinc-800 dark:text-zinc-200 truncate">
                            {localMediaConfig.downloadRootPath?.trim().length ? localMediaConfig.downloadRootPath : "Ask every time"}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button type="button" variant="ghost" size="sm" onClick={async () => {
                              const selected = await pickLocalMediaStorageRootPath();
                  if (!selected)
                      return;
                              saveLocalMediaConfig({ ...localMediaConfig, downloadRootPath: selected });
                              toast.success("Default download folder saved.");
                          }}>
                            Choose Folder
                          </Button>
                          <Button type="button" variant="secondary" size="sm" onClick={() => {
                              saveLocalMediaConfig({ ...localMediaConfig, downloadRootPath: "" });
                              toast.success("Download folder reset. Obscur will ask where to save each file.");
                          }}>
                            Reset
                          </Button>
                        </div>
                      </div>
                    </div>) : null}

                  {/* Cache Rules */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-zinc-500 uppercase tracking-widest text-[10px]">Cache Rules</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex items-center justify-between p-4 rounded-xl border border-black/5 dark:border-white/5 bg-zinc-50/30 dark:bg-zinc-900/30 transition-colors">
                        <span className="text-sm font-medium">{t("settings.storage.cacheSent")}</span>
                        <SettingsToggle checked={localMediaConfig.cacheSentFiles} onChange={(checked) => saveLocalMediaConfig({ ...localMediaConfig, cacheSentFiles: checked })}/>
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-xl border border-black/5 dark:border-white/5 bg-zinc-50/30 dark:bg-zinc-900/30 transition-colors">
                        <span className="text-sm font-medium">{t("settings.storage.cacheReceived")}</span>
                        <SettingsToggle checked={localMediaConfig.cacheReceivedFiles} onChange={(checked) => saveLocalMediaConfig({ ...localMediaConfig, cacheReceivedFiles: checked })}/>
                      </div>
                    </div>
                  </div>

                  {/* Maintenance */}
                  <div className="pt-2 border-t border-black/5 dark:border-white/5">
                    <div className="mb-4 rounded-xl border border-black/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-900/40">
                      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Cache Index Metrics (estimate)</div>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                          Cached files: <span className="font-semibold">{storageStats.itemCount}</span>
                        </div>
                        <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                          Estimated size: <span className="font-semibold">{formatBytes(storageStats.totalBytes)}</span>
                        </div>
                        <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                          Last cached: <span className="font-semibold">{typeof storageStats.lastSavedAtUnixMs === "number" ? new Date(storageStats.lastSavedAtUnixMs).toLocaleString() : "n/a"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4">
                      <div>
                        <Label className="text-sm font-semibold text-red-600 dark:text-red-400">Maintenance</Label>
                        <p className="text-xs text-zinc-500 mt-1">Free up disk space safely without deleting messages.</p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button type="button" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900/30" onClick={async () => {
                            await purgeLocalMediaCache();
            toast.success(t("settings.storage.cacheCleared"));
                            setStorageStatsTick((prev: number) => prev + 1);
                            setStorageActionPhase("success");
                            setStorageActionMessage("Local cache cleared.");
                            void refreshLocalMediaAbsolutePath();
        }}>
                          {t("settings.storage.clearCache")}
                        </Button>
                        <Button type="button" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/20" onClick={() => setIsResetLocalHistoryDialogOpen(true)}>
                          Reset Local History
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => void handleResetStorageSection()} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                        Reset Storage Section
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <SettingsActionStatus title="Storage Actions" phase={storageActionPhase} message={storageActionMessage || undefined} summary={`Mode: ${storageMode.replace("_", " ")} · ${storageStats.itemCount} indexed file(s)`}/>
            </div>
          </SettingsCompactCard>
      <Dialog open={isDataRootSubfolderDialogOpen} onOpenChange={(open) => {
            if (!open) {
                setIsDataRootSubfolderDialogOpen(false);
                resetPendingDataRootChange();
            }
        }}>
        <DialogContent className="w-[min(32rem,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle>
              {t("settings.storage.dataFolderSubfolderDialogTitle")}
            </DialogTitle>
            <DialogDescription className="whitespace-pre-line text-left">
              {t("settings.storage.dataFolderSubfolderDialogDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="data-root-parent-path">
                {t("settings.storage.dataFolderSubfolderParentLabel")}
              </Label>
              <Input id="data-root-parent-path" readOnly value={formatDataFolderPath(pendingDataRootParentPath)} className="font-mono text-sm"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="data-root-subfolder-name">
                {t("settings.storage.dataFolderSubfolderNameLabel")}
              </Label>
              <Input id="data-root-subfolder-name" value={pendingDataRootSubfolderName} onChange={(event) => setPendingDataRootSubfolderName(event.target.value)} placeholder={DEFAULT_OBSCUR_DATA_SUBFOLDER} className="font-mono text-sm"/>
            </div>
            <div className="rounded-xl border border-black/5 bg-zinc-50/80 px-4 py-3 text-sm dark:border-white/5 dark:bg-zinc-900/50">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                {t("settings.storage.dataFolderSubfolderPreviewLabel")}
              </div>
              <div className="mt-1 break-all font-mono text-zinc-800 dark:text-zinc-200">
                {formatDataFolderPath(pendingDataRootTargetPreview) || "—"}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => {
            setIsDataRootSubfolderDialogOpen(false);
            resetPendingDataRootChange();
        }}>
              {t("common.cancel")}
            </Button>
            <Button type="button" disabled={!pendingDataRootTargetPreview || Boolean(validateObscurDataSubfolderName(pendingDataRootSubfolderName))} onClick={() => void confirmDataRootSubfolderSelection()}>
              {t("settings.storage.dataFolderSubfolderContinue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog isOpen={isDataRootMigrationDialogOpen} onClose={() => {
            setIsDataRootMigrationDialogOpen(false);
            resetPendingDataRootChange();
        }} onConfirm={async () => {
            if (pendingDataRootPath === undefined)
                return;
            try {
                await applyDataRootChange(pendingDataRootPath, true, false);
                setIsDataRootMigrationDialogOpen(false);
                resetPendingDataRootChange();
            }
            catch {
                // toast already shown
            }
        }} title={pendingDataRootPath === null
            ? t("settings.storage.dataFolderResetDialogTitle")
            : t("settings.storage.dataFolderMigrationDialogTitle")} description={pendingDataRootPath === null
            ? t("settings.storage.dataFolderResetDialogDesc", isNativeDesktop
                ? "Your profiles, database, vault cache, and backups will be copied from {{from}} to the default app-data folder ({{to}}). Obscur will restart automatically after you confirm."
                : "Your profiles, database, vault cache, and backups will be copied from {{from}} to the default app-data folder ({{to}}). Restart Obscur after confirming.", {
                from: dataRootConfig?.effectivePath ?? "current folder",
                to: dataRootConfig?.defaultPath ?? "default app data",
            })
            : t("settings.storage.dataFolderMigrationDialogDesc", isNativeDesktop
                ? "Your profiles, database, vault cache, and backups will be copied from {{from}} to {{to}}. The destination folder must be empty. Community and group history move with the local database and profile folders. Obscur will restart automatically after you confirm."
                : "Your profiles, database, vault cache, and backups will be copied from {{from}} to {{to}}. The destination folder must be empty. Community and group history move with the local database and profile folders. Restart Obscur after confirming.", {
                from: formatDataFolderPath(dataRootConfig?.effectivePath ?? "current folder"),
                to: formatDataFolderPath(pendingDataRootPath ?? "new folder"),
            })} confirmLabel={t("settings.storage.dataFolderMigrationConfirm")} cancelLabel={t("common.cancel")} isLoading={isSavingDataRoot}>
        <DataRootMigrationProgressIndicator progress={dataRootMigrationProgress} isActive={isSavingDataRoot} t={t}/>
      </ConfirmDialog>

      <ConfirmDialog isOpen={isDataRootReconnectDialogOpen} onClose={() => {
            setIsDataRootReconnectDialogOpen(false);
            resetPendingDataRootChange();
        }} onConfirm={async () => {
            if (!pendingDataRootPath)
                return;
            setIsSavingDataRoot(true);
            try {
                const next = await reconnectObscurDataRootPath(pendingDataRootPath);
                await finishDataRootChange(next, t("settings.storage.dataFolderReconnectSuccess", { path: pendingDataRootPath }));
                setIsDataRootReconnectDialogOpen(false);
                resetPendingDataRootChange();
            }
            catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to reconnect data folder.");
            }
            finally {
                setIsSavingDataRoot(false);
            }
        }} title={t("settings.storage.dataFolderReconnectDialogTitle")} description={buildReconnectDialogDescription(pendingDataRootPlan, pendingDataRootPath)} confirmLabel={t("settings.storage.dataFolderReconnectConfirm")} cancelLabel={t("common.cancel")} isLoading={isSavingDataRoot}/>

      <Dialog open={isDataRootConflictDialogOpen} onOpenChange={(open) => {
            if (!open) {
                setIsDataRootConflictDialogOpen(false);
                resetPendingDataRootChange();
            }
        }}>
        <DialogContent className="w-[min(32rem,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle>
              {t("settings.storage.dataFolderConflictDialogTitle")}
            </DialogTitle>
            <DialogDescription className="whitespace-pre-line text-left">
              {t("settings.storage.dataFolderConflictDialogDesc", {
            target: formatDataFolderPath(pendingDataRootPlan?.targetPath ?? pendingDataRootPath),
            source: formatDataFolderPath(pendingDataRootPlan?.sourcePath ?? dataRootConfig?.effectivePath),
        })}
              {pendingDataRootPlan?.anchorWouldBeReplaced
            ? `\n\n${t("settings.storage.dataFolderAnchorReplaceWarning", {
                anchor: pendingDataRootPlan.anchorPath,
                path: pendingDataRootPlan.targetPath,
            })}`
            : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button type="button" disabled={isSavingDataRoot} onClick={async () => {
            if (!pendingDataRootPath)
                return;
            setIsSavingDataRoot(true);
            try {
                const next = await reconnectObscurDataRootPath(pendingDataRootPath);
                await finishDataRootChange(next, t("settings.storage.dataFolderReconnectSuccess", { path: pendingDataRootPath }));
                setIsDataRootConflictDialogOpen(false);
                resetPendingDataRootChange();
            }
            catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to reconnect data folder.");
            }
            finally {
                setIsSavingDataRoot(false);
            }
        }}>
              {t("settings.storage.dataFolderConflictUseExisting")}
            </Button>
            <Button type="button" variant="danger" disabled={isSavingDataRoot} onClick={() => {
            setIsDataRootConflictDialogOpen(false);
            setIsDataRootOverwriteDialogOpen(true);
        }}>
              {t("settings.storage.dataFolderConflictOverwrite")}
            </Button>
            <Button type="button" variant="ghost" disabled={isSavingDataRoot} onClick={() => {
            setIsDataRootConflictDialogOpen(false);
            resetPendingDataRootChange();
        }}>
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog isOpen={isDataRootOverwriteDialogOpen} variant="danger" onClose={() => {
            setIsDataRootOverwriteDialogOpen(false);
            resetPendingDataRootChange();
        }} onConfirm={async () => {
            if (!pendingDataRootPath)
                return;
            try {
                await applyDataRootChange(pendingDataRootPath, true, true);
                setIsDataRootOverwriteDialogOpen(false);
                resetPendingDataRootChange();
            }
            catch {
                // toast already shown
            }
        }} title={t("settings.storage.dataFolderOverwriteDialogTitle")} description={t("settings.storage.dataFolderOverwriteDialogDesc", {
            target: formatDataFolderPath(pendingDataRootPlan?.targetPath ?? pendingDataRootPath),
            source: formatDataFolderPath(pendingDataRootPlan?.sourcePath ?? dataRootConfig?.effectivePath),
        })} confirmLabel={t("settings.storage.dataFolderOverwriteConfirm")} cancelLabel={t("common.cancel")} isLoading={isSavingDataRoot}>
        <DataRootMigrationProgressIndicator progress={dataRootMigrationProgress} isActive={isSavingDataRoot} t={t}/>
      </ConfirmDialog>

      <ConfirmDialog isOpen={isDataRootImportDialogOpen} onClose={() => setIsDataRootImportDialogOpen(false)} onConfirm={async () => {
            setIsSavingDataRoot(true);
            try {
                const next = await importObscurDataFromDefault();
                await finishDataRootChange(next, t("settings.storage.dataFolderImportSuccess", { count: next.migrationCopiedCount ?? 0 }));
                setIsDataRootImportDialogOpen(false);
            }
            catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to import data from AppData.");
            }
            finally {
                setIsSavingDataRoot(false);
            }
        }} title={t("settings.storage.dataFolderImportDialogTitle")} description={t("settings.storage.dataFolderImportDialogDesc", isNativeDesktop
            ? "Missing profiles, database files, vault cache, and backups will be copied from {{from}} into your current data folder ({{to}}). Existing newer files at the destination are kept. Obscur will restart automatically after you confirm."
            : "Missing profiles, database files, vault cache, and backups will be copied from {{from}} into your current data folder ({{to}}). Existing newer files at the destination are kept. Restart Obscur after confirming.", {
            from: dataRootConfig?.defaultPath ?? "AppData",
            to: dataRootConfig?.effectivePath ?? "current folder",
        })} confirmLabel={t("settings.storage.dataFolderImportConfirm")} cancelLabel={t("common.cancel")} isLoading={isSavingDataRoot}/>

      <ConfirmDialog isOpen={isDisableAllRelaysDialogOpen} onClose={() => setIsDisableAllRelaysDialogOpen(false)} onConfirm={handleRelayBulkDisableAllConfirm} title={t("settings.relays.disableAllDialogTitle")} description={t("settings.relays.disableAllDialogDesc")} confirmLabel={t("settings.relays.disableAllConfirm")} cancelLabel={t("common.cancel")} variant="danger"/>

      <ConfirmDialog isOpen={isClearDataDialogOpen} onClose={() => setIsClearDataDialogOpen(false)} onConfirm={handleClearData} title={t("settings.dialogs.clearDataTitle")} description={t("settings.dialogs.clearDataDesc")} confirmLabel={t("settings.actions.clear")} variant="danger"/>

      <ConfirmDialog isOpen={isResetLocalHistoryDialogOpen} onClose={() => setIsResetLocalHistoryDialogOpen(false)} onConfirm={handleResetLocalHistory} title="Reset Local History (Keep Identity)" description="This clears local chat history, sync checkpoints, and cached media on this device, but keeps your identity/session and remember-me credentials." confirmLabel="Reset Local History" variant="danger"/>

      <ConfirmDialog isOpen={isDeleteAccountDialogOpen} onClose={() => setIsDeleteAccountDialogOpen(false)} onConfirm={handleDeleteAccount} title={t("settings.dialogs.deleteAccountTitle")} description={t("settings.dialogs.deleteAccountDesc")} confirmLabel={t("settings.actions.delete")} variant="danger"/>
    </>);
}
