"use client";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
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
import { RelaySettingsMetricsToolbar } from "@/app/features/settings/components/relay-settings-metrics-toolbar";
import type { RelaySettingsCategory } from "@/app/features/relays/services/relay-settings-node-filter";
import { CommunityMembershipSyncSettingsPanel } from "@/app/features/settings/components/community-membership-sync-settings-panel";
import { OperatorTrustSetupWizard } from "@/app/features/settings/components/operator-trust-setup-wizard";
import { TrustSettingsPanel } from "@/app/features/messaging/components/trust-settings-panel";
import { PasswordResetPanel } from "@/app/features/settings/components/password-reset-panel";
import { AutoLockSettingsPanel } from "@/app/features/settings/components/auto-lock-settings-panel";
import { SecuritySettingsPanel } from "@/app/features/settings/components/security-settings-panel";
import { SettingsActionStatus } from "@/app/features/settings/components/settings-action-status";
import { ProfileSwitcherCard } from "@/app/features/profiles/components/profile-switcher-card";
import { SettingsToggle, SettingsToggleCard, toSettingsActionPhase, validateProfileInput, formatBytes, formatRatioPercent, } from "../settings-tab-panel-shared";
import { getApiBaseUrl } from "@/app/features/relays/utils/api-base-url";
import { deriveRelayNodeStatus, deriveRelayRuntimeStatus } from "@/app/features/relays/lib/relay-runtime-status";
import { getActiveTransportScopeCopy } from "@/app/features/relays/services/relay-transport-scope-copy";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { partitionRelayListByTransportScope } from "@/app/features/relays/services/relay-transport-scope";
import { checkStorageHealth, runStorageRecovery } from "@/app/features/messaging/services/storage-health-service";
import { Loader2, Activity, ShieldAlert, Shield, Lock, Database, Copy, ChevronDown, Plus, ArrowUp, ArrowDown, Eye, EyeOff, Building2, Wifi, RefreshCcw, Check, X } from "lucide-react";
import { useSettingsTabPanelModel } from "../settings-tab-panel-model-context";
import { SETTINGS_SEARCH_PREPARE_EVENT, type SettingsSearchPrepareDetail } from "@/app/features/settings/services/settings-search-navigate";
export default function RelaysSettingsTabPanel(): React.JSX.Element {
    const [relayMetricsCategory, setRelayMetricsCategory] = useState<RelaySettingsCategory>("all");
    const [relayMetricsAvailableOnly, setRelayMetricsAvailableOnly] = useState(false);
    const { activePoolRelayUrls, communityCandidateRelayUrls, relayTransportMode, setRelayTransportMode, } = useRelay();
    const { APP_VERSION, DEFAULT_APP_LANGUAGE, DEFAULT_STABLE_PRESET, DEFAULT_THEME_PREFERENCE, DELETE_ACCOUNT_CONFIRM_TEXT, ENABLE_API_HEALTH_PROBE, INVITE_CODE_PREFIX, INVITE_CODE_SUFFIX_LENGTH, RELAY_PRESETS, TEXT_SCALE_OPTIONS, accessibility, accountSyncSnapshot, activeTab, apiHealth, appearanceActionMessage, appearanceActionPhase, applyRelayPreset, blocklist, blocklistInput, blocklistQuery, challangePassword, checkStorageHealth, clearIndexedDbDatabases, clearRuntimeCaches, copyPrivateKey, deleteAccountConfirmInput, deleteAccountCountdown, deriveRelayNodeStatus, deriveRelayRuntimeStatus, derivedPublicKeyHex, displayPublicKeyHex, exportPrivateKey, filteredBlockedKeys, getProfilePublishReportSnapshot, handleAddBlockedKey, handleAddRelay, handleArmDeleteAccount, handleCheckApi, handleCheckProviderReachability, handleClearData, handleDeleteAccount, handleDisableNotifications, handleEnableNotifications, handleExportPortableBundle, handleLockNow, handlePortableBundleFileSelected, handleProfileSwitchLock, handleRandomInviteCode, handleRefreshRelayStatus, handleRelayBulkCopyList, handleRelayBulkDisableAllConfirm, handleRelayBulkDisableAllRequest, handleRelayBulkEnableAll, handleRelayBulkRemoveDisabled, handleResetAccessibility, handleResetLanguage, handleResetLocalHistory, handleResetRelaySection, handleResetStorageSection, handleResetTheme, handleRevealToggle, handleSavePrivacy, handleSaveProfile, handleSendTestNotification, handleToggleNotificationChannel, handleUnblockAll, handleVerifyChallenge, handleVerifyNip05, i18n, identity, identityDiagnostics, identityIntegrityState, identityStorageMode, inviteCodeAvailabilityMessage, inviteCodeAvailabilityStatus, inviteCodeDraft, inviteCodeDraftSuffix, isChallenging, isCheckingProviderReachability, isCheckingStorageHealth, isClearDataDialogOpen, isDeleteAccountDialogOpen, isDisableAllRelaysDialogOpen, isInviteCodeDraftDirty, isPortableBundleExporting, isPortableBundleImporting, isPrivateKeyVisible, isPublishing, isResetLocalHistoryDialogOpen, isResolvingLocalPath, isVerifyingNip05, lastSyncLabel, leaveJoinedCommunitiesBeforeAccountDeletion, localMediaAbsolutePath, localMediaConfig, managedWorkspaceDefinition, moderationActionMessage, moderationActionPhase, newRelayUrl, nip96Config, notificationActionMessage, notificationActionPhase, notificationPreference, npubValue, nsecKey, persistedInviteCodeSuffix, pool, portableBundleFileInputRef, privacySettings, profile, profilePreflightError, profilePublishError, profilePublishPhase, profilePublishReport, profileSaveActionMessage, profileSaveActionPhase, profileValidation, providerReachabilityNote, providerValidation, publicKeyHex, publishProfile, publishScopedGroupEvent, refreshLocalMediaAbsolutePath, relayActionMessage, relayActionPhase, relayCapabilityAssessment, relayConnectionMap, relayHealthMetricsMap, relayList, relayQuickHealth, relayResilienceBetaGate, relayResiliencePerformanceGate, relayResilienceSnapshot, relayRuntime, relayRuntimeStatus, relaySelection, reliabilityMetrics, reliabilityRuntime, reliabilityTick, resolveActivePrivateKeyHex, revealExpiresAtMs, revealSecondsLeft, rolloutPolicy, runStorageRecovery, saveLocalMediaConfig, saveNip96Config, securityActionMessage, securityActionPhase, securityCapabilityStates, securityPosture, setApiHealth, setAppearanceActionMessage, setAppearanceActionPhase, setBlocklistInput, setBlocklistQuery, setChallengePassword, setDeleteAccountConfirmInput, setDeleteAccountCountdown, setInviteCodeAvailabilityMessage, setInviteCodeAvailabilityStatus, setInviteCodeDraftSuffix, setInviteCodeFromSuffix, setIsChallenging, setIsCheckingProviderReachability, setIsCheckingStorageHealth, setIsClearDataDialogOpen, setIsDeleteAccountDialogOpen, setIsDisableAllRelaysDialogOpen, setIsInviteCodeDraftDirty, setIsPortableBundleExporting, setIsPortableBundleImporting, setIsPrivateKeyVisible, setIsResetLocalHistoryDialogOpen, setIsResolvingLocalPath, setIsVerifyingNip05, setLocalMediaAbsolutePath, setLocalMediaConfig, setModerationActionMessage, setModerationActionPhase, setNewRelayUrl, setNip96Config, setNotificationActionMessage, setNotificationActionPhase, setNsecKey, setPrivacySettings, setProfilePreflightError, setProfileSaveActionMessage, setProfileSaveActionPhase, setProviderReachabilityNote, setRelayActionMessage, setRelayActionPhase, setReliabilityTick, setRevealExpiresAtMs, setRevealSecondsLeft, setSecurityActionMessage, setSecurityActionPhase, setShowAdvancedRelays, setStorageActionMessage, setStorageActionPhase, setStorageHealthState, setStorageStatsTick, showAdvancedRelays, sovereignRoomDefinition, startupState, storageActionMessage, storageActionPhase, storageHealthState, storageMode, storageStats, storageStatsTick, t, theme, translatePermissionState, translateRelayConfidenceLabel, translateRelayNodeBadge, translateRelayNodeDetail, translateRelayNodeRole, translateRelayPresetLabel, translateRelayRuntimeText, translateStorageMode, triggerRelayRecovery, userInviteCode, verifyInviteCodeAvailability, wipeLocalRuntimeData } = useSettingsTabPanelModel() as Record<string, any>;
    useEffect(() => {
        const onPrepareSearchNavigate = (event: Event): void => {
            const detail = (event as CustomEvent<SettingsSearchPrepareDetail>).detail;
            if (!detail) {
                return;
            }
            if (detail.entryId === "relay-advanced" || detail.elementId === "relay-advanced-settings") {
                setShowAdvancedRelays(true);
            }
        };
        window.addEventListener(SETTINGS_SEARCH_PREPARE_EVENT, onPrepareSearchNavigate);
        return () => {
            window.removeEventListener(SETTINGS_SEARCH_PREPARE_EVENT, onPrepareSearchNavigate);
        };
    }, [setShowAdvancedRelays]);
    const relayScopePartition = useMemo(() => partitionRelayListByTransportScope(relayList.state.relays), [relayList.state.relays]);
    const renderRelayListSection = (sectionRelays: ReadonlyArray<{
        url: string;
        enabled: boolean;
    }>, options: Readonly<{
        dmTransport: boolean;
    }>): React.ReactNode => (sectionRelays.map((relay: {
        url: string;
        enabled: boolean;
    }, index: number) => {
        const health = relayHealthMetricsMap.get(relay.url);
        const inActivePool = options.dmTransport && activePoolRelayUrls.includes(relay.url);
        const connection = relayConnectionMap.get(relay.url);
        const relayRole = options.dmTransport && relay.enabled && !relayRuntime.fallbackRelayUrls.includes(relay.url)
            ? (relaySelection.primaryUrl === relay.url ? "primary" : "standby")
            : (relay.enabled ? "standby" : undefined);
        const derivedStatus = deriveRelayNodeStatus({
            url: relay.url,
            enabled: relay.enabled,
            connection,
            metrics: health,
            isConfigured: true,
            role: relayRole,
            isActivePoolMember: inActivePool && relay.url !== relaySelection.primaryUrl,
            isFallback: relayRuntime.fallbackRelayUrls.includes(relay.url),
            runtimePhase: relayRuntime.phase,
            lastInboundEventAtUnixMs: relayRuntime.lastInboundEventAtUnixMs,
        });
        return (<div key={relay.url} className="group flex items-center justify-between gap-4 rounded-2xl border border-black/10 dark:border-white/10 p-5 bg-white/60 backdrop-blur-md transition-all hover:bg-white/80 hover:shadow-md dark:bg-zinc-900/40 dark:hover:bg-zinc-900/60">
          <div className="flex items-center gap-5 min-w-0">
            <SettingsToggle checked={relay.enabled} onChange={(enabled: boolean) => relayList.setRelayEnabled({ url: relay.url, enabled })}/>
            <div className="min-w-0 flex flex-col gap-1">
              <p className={cn("font-mono text-[11px] font-bold tracking-tight truncate transition-opacity", !relay.enabled ? "text-zinc-400 opacity-60" : "text-zinc-900 dark:text-zinc-100")}>
                {relay.url}
              </p>
              <div className="flex items-center gap-2">
                <div className={cn("h-1.5 w-1.5 rounded-full ring-2 ring-offset-1 ring-offset-transparent", derivedStatus.status === "healthy"
                ? "bg-emerald-500 ring-emerald-500/20"
                : derivedStatus.status === "recovering"
                    ? "bg-sky-500 ring-sky-500/20"
                    : derivedStatus.status === "degraded"
                        ? "bg-amber-500 ring-amber-500/20"
                        : "bg-rose-500 ring-rose-500/20")}/>
                <span className={cn("text-[10px] font-black uppercase tracking-[0.2em] leading-none", derivedStatus.status === "healthy"
                ? "text-emerald-600 dark:text-emerald-400"
                : derivedStatus.status === "recovering"
                    ? "text-sky-600 dark:text-sky-400"
                    : derivedStatus.status === "degraded"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-rose-600 dark:text-rose-400")}>
                  {translateRelayNodeBadge(derivedStatus.badge)}
                </span>
                <span className="rounded-md bg-black/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500 dark:bg-white/5 dark:text-zinc-400">
                  {translateRelayNodeRole(derivedStatus.roleLabel)}
                </span>
              </div>
              <div className="mt-1 text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                {translateRelayNodeDetail(derivedStatus.detail)}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-400">
                <span>{t("settings.relays.successLabel", {
                defaultValue: "Success {{value}}",
                value: derivedStatus.successLabel,
            })}</span>
                <span>•</span>
                <span>{translateRelayConfidenceLabel(derivedStatus.confidenceLabel)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
            <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 shadow-sm" onClick={() => relayList.moveRelay({ url: relay.url, direction: "up" })} disabled={index === 0}>
              <ArrowUp className="h-4 w-4"/>
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 shadow-sm" onClick={() => relayList.moveRelay({ url: relay.url, direction: "down" })} disabled={index === sectionRelays.length - 1}>
              <ArrowDown className="h-4 w-4"/>
            </Button>
            <div className="w-1 h-4 border-r border-black/10 dark:border-white/10 mx-0.5"/>
            <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 shadow-sm transition-colors" onClick={() => relayList.removeRelay({ url: relay.url })}>
              <X className="h-4 w-4 font-black"/>
            </Button>
          </div>
        </div>);
    }));
    return (<>
        <Card title={t("settings.relays.title")} description={t("settings.relays.desc")} className="w-full">
          <div className="space-y-6">
            <RelayReadinessSettingsBanner />
            {/* API Status Panel */}
            <div id="relay-api-status" className="space-y-4 rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-500">
                <Activity className="h-4 w-4 text-purple-500"/>
                {t("settings.health.api")}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-black/20 border border-black/5 dark:border-white/5 shadow-sm">
                <div className="space-y-1 overflow-hidden">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none">{t("settings.relays.endpoint")}</div>
                  <div className="text-xs font-mono text-zinc-600 dark:text-zinc-300 truncate">{getApiBaseUrl()}</div>
                </div>
                <Button variant="secondary" size="sm" onClick={handleCheckApi} disabled={apiHealth.status === "checking"} className="shrink-0">
                  {apiHealth.status === "checking"
            ? <Loader2 className="h-3 w-3 animate-spin"/>
            : ENABLE_API_HEALTH_PROBE
                ? t("settings.health.check")
                : t("settings.relays.showAdvisory")}
                </Button>
              </div>

              <AnimatePresence mode="wait">
                {apiHealth.status === "disabled" && (<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs flex items-center gap-2 font-medium">
                    <Activity className="h-3 w-3"/>
                    {apiHealth.message}
                  </motion.div>)}
                {apiHealth.status === "ok" && (<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 font-medium">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"/>
                    Operational — Latency: {apiHealth.latencyMs}ms
                  </motion.div>)}
                {apiHealth.status === "error" && (<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 font-medium">
                    <ShieldAlert className="h-3 w-3"/>
                    Connection Error: {apiHealth.message}
                  </motion.div>)}
              </AnimatePresence>
            </div>

            {/* Relay Runtime Setup */}
            <div className="space-y-4 rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-white dark:bg-black/20">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Label className="font-semibold text-base">{t("settings.relays.connectivityTitle")}</Label>
                  <p className="text-xs text-zinc-500">
                    {t("settings.relays.connectivityDesc", {
            defaultValue: "Nostr DM and profile events use the public relay pool below (basic = one relay, redundancy = up to three). Workspace communities and operator-configured nodes use their own relay URLs and are not limited by this toggle.",
            enabled: relayList.state.relays.filter((relay: {
                enabled: boolean;
            }) => relay.enabled).length,
            total: relayList.state.relays.length,
            writable: relayRuntime.writableRelayCount,
        })}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {t("settings.relays.scopeSummary", {
            defaultValue: "DM transport: {{dmEnabled}} enabled · Workspace candidates: {{communityEnabled}} enabled ({{communityConfigured}} configured). Unreachable intranet relays stay out of the DM pool until you enable them here.",
            dmEnabled: relayScopePartition.dm.filter((relay) => relay.enabled).length,
            communityEnabled: communityCandidateRelayUrls.length,
            communityConfigured: relayScopePartition.community.length,
        })}
                  </p>
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    {getActiveTransportScopeCopy({
            selection: relaySelection,
            transportMode: relayTransportMode,
            activePoolRelayUrls,
            writableRelayCount: relayRuntime.writableRelayCount,
            subscribableRelayCount: relayRuntime.subscribableRelayCount,
            enabledRelayCount: relayList.state.relays.filter((relay: {
                enabled: boolean;
            }) => relay.enabled).length,
        })}
                  </p>
                </div>
                <Button type="button" size="sm" variant={showAdvancedRelays ? "secondary" : "outline"} onClick={() => setShowAdvancedRelays((prev: boolean) => !prev)}>
                  {showAdvancedRelays
            ? t("settings.relays.hideAdvanced")
            : t("settings.relays.showAdvanced")}
                </Button>
              </div>

              <SettingsToggleCard title={t("settings.relays.redundancyModeTitle")} description={t("settings.relays.redundancyModeDesc")} checked={relayTransportMode === "redundancy"} onChange={(enabled: boolean) => {
            setRelayTransportMode(enabled ? "redundancy" : "basic");
        }}/>

              <div className="rounded-xl border border-black/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-900/50">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold", relayRuntimeStatus.status === "healthy"
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
            : relayRuntimeStatus.status === "recovering"
                ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
                : relayRuntimeStatus.status === "degraded"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300")}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", relayRuntimeStatus.status === "healthy" ? "bg-emerald-500" :
            relayRuntimeStatus.status === "recovering" ? "bg-sky-500 animate-pulse" :
                relayRuntimeStatus.status === "degraded" ? "bg-amber-500" : "bg-rose-500")}/>
                    {relayRuntimeStatus.status === "healthy"
            ? t("settings.relays.statusPrimary")
            : relayRuntimeStatus.status === "recovering"
                ? t("settings.relays.statusSwitching")
                : relayRuntimeStatus.status === "degraded"
                    ? t("settings.relays.statusDegraded")
                    : t("settings.relays.statusOffline")}
                  </span>
                  {relaySelection.primaryUrl && (<span className="rounded-full bg-zinc-100 px-2 py-1 font-mono text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 truncate max-w-[180px]">
                      {(() => { try {
            return new URL(relaySelection.primaryUrl).hostname;
        }
        catch {
            return relaySelection.primaryUrl;
        } })()}
                    </span>)}
                  <span className="rounded-full bg-zinc-100 px-2 py-1 font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {t("settings.relays.avgLatencyBadge", {
            defaultValue: "Avg Latency {{latency}}",
            latency: typeof relayQuickHealth.averageLatencyMs === "number" ? `${relayQuickHealth.averageLatencyMs}ms` : "n/a",
        })}
                  </span>
                </div>
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">{translateRelayRuntimeText(relayQuickHealth.recommendation)}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{t("settings.relays.presets")}</Label>
                <div className="flex flex-wrap gap-2">
                  {RELAY_PRESETS.map((preset: {
            id: string;
            label: string;
        }) => (<Button key={preset.id} type="button" size="sm" variant="outline" onClick={() => applyRelayPreset(preset.id)}>
                      {translateRelayPresetLabel(preset.id)}
                    </Button>))}
                  <Button type="button" variant="outline" size="sm" onClick={() => void handleRefreshRelayStatus()}>
                    <RefreshCcw className="mr-2 h-4 w-4"/>
                    {t("settings.relays.refreshStatus")}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={handleResetRelaySection} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                    {t("settings.relays.resetSection")}
                  </Button>
                </div>
              </div>

              <div className={cn("rounded-xl border p-4 transition-all duration-300", relayRuntimeStatus.status === "healthy"
            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300 shadow-[0_0_15px_-5px_rgba(16,185,129,0.1)]"
            : relayRuntimeStatus.status === "recovering"
                ? "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300 shadow-[0_0_15px_-5px_rgba(14,165,233,0.1)]"
                : relayRuntimeStatus.status === "degraded"
                    ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300 shadow-[0_0_15px_-5px_rgba(245,158,11,0.1)]"
                    : "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300 shadow-[0_0_15px_-5px_rgba(244,63,94,0.1)]")}>
                <div className="flex items-center gap-3">
                  <div className={cn("h-2.5 w-2.5 rounded-full shadow-sm animate-pulse", relayRuntimeStatus.status === "healthy"
            ? "bg-emerald-500"
            : relayRuntimeStatus.status === "recovering"
                ? "bg-sky-500"
                : relayRuntimeStatus.status === "degraded"
                    ? "bg-amber-500"
                    : "bg-rose-500")}/>
                  <div className="space-y-0.5">
                    <div className="text-sm font-bold">{translateRelayRuntimeText(relayRuntimeStatus.label)}</div>
                    <div className="text-xs opacity-70 leading-normal">{translateRelayRuntimeText(relayRuntimeStatus.actionText)}</div>
                  </div>
                </div>
              </div>

              <OperatorTrustSetupWizard />

              <div id="relay-community-modes" className="rounded-2xl border border-black/5 bg-zinc-50/70 p-5 dark:border-white/10 dark:bg-zinc-900/40">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <Label className="font-semibold text-base">
                      {t("settings.relays.communityModesTitle")}
                    </Label>
                    <p className="text-xs text-zinc-500">
                      {t("settings.relays.communityModesDesc")}
                    </p>
                  </div>
                  <span className="rounded-full border border-black/5 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:border-white/10 dark:bg-black/20 dark:text-zinc-300">
                    {relayCapabilityAssessment.label}
                  </span>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {relayCapabilityAssessment.summary}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {relayCapabilityAssessment.settingsHint}
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10">
                        <Shield className="h-4 w-4 text-primary"/>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-zinc-900 dark:text-white">
                          {sovereignRoomDefinition.label}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                          {sovereignRoomDefinition.shortDescription}
                        </p>
                        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                          {sovereignRoomDefinition.caution}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500/10">
                        <Building2 className="h-4 w-4 text-emerald-500"/>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-zinc-900 dark:text-white">
                          {managedWorkspaceDefinition.label}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                          {managedWorkspaceDefinition.shortDescription}
                        </p>
                        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                          {relayCapabilityAssessment.supportsManagedWorkspace
            ? t("settings.relays.communityModesManagedAvailable")
            : t("settings.relays.communityModesManagedHidden")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <CommunityMembershipSyncSettingsPanel />
            </div>

            {/* Advanced Configuration */}
            <AnimatePresence>
              {showAdvancedRelays && (<motion.div id="relay-advanced-settings" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-6">
                  <div className="space-y-4 rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div className="space-y-1">
                      <Label className="font-semibold text-base">{t("settings.relays.advancedConfigTitle")}</Label>
                      <p className="text-xs text-zinc-500">{t("settings.relays.advancedConfigDesc")}</p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        {t("settings.relays.bulkTitle")}
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={handleRelayBulkEnableAll}>
                          {t("settings.relays.bulkEnableAll")}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={handleRelayBulkDisableAllRequest}>
                          {t("settings.relays.bulkDisableAll")}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={handleRelayBulkRemoveDisabled}>
                          {t("settings.relays.bulkRemoveDisabledButton")}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => void handleRelayBulkCopyList()}>
                          <Copy className="mr-1.5 h-3.5 w-3.5"/>
                          {t("settings.relays.bulkCopyJson")}
                        </Button>
                      </div>
                      <p className="text-[11px] leading-relaxed text-zinc-500">
                        {t("settings.relays.bulkHint")}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <Input value={newRelayUrl} onChange={(e) => setNewRelayUrl(e.target.value)} placeholder="wss://relay.example.com" className="bg-white dark:bg-black/20 border-black/5 dark:border-white/10" onKeyDown={(e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddRelay();
                }
            }}/>
                      <div className="flex gap-2">
                        <Button type="button" onClick={handleAddRelay} className="whitespace-nowrap">
                          <Plus className="h-4 w-4 mr-2"/>
                          {t("settings.relays.addNode")}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={handleResetRelaySection} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                          Reset
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                          {t("settings.relays.dmSectionTitle")}
                        </Label>
                        <p className="text-[11px] leading-relaxed text-zinc-500">
                          {t("settings.relays.dmSectionDesc")}
                        </p>
                        <div className="space-y-3">
                          {relayScopePartition.dm.length > 0
                ? renderRelayListSection(relayScopePartition.dm, { dmTransport: true })
                : (<p className="text-xs text-zinc-500">
                                {t("settings.relays.dmSectionEmpty")}
                              </p>)}
                        </div>
                      </div>
                      <div className="space-y-2 border-t border-black/5 pt-4 dark:border-white/10">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                          {t("settings.relays.communitySectionTitle")}
                        </Label>
                        <p className="text-[11px] leading-relaxed text-zinc-500">
                          {t("settings.relays.communitySectionDesc")}
                        </p>
                        <div className="space-y-3">
                          {relayScopePartition.community.length > 0
                ? renderRelayListSection(relayScopePartition.community, { dmTransport: false })
                : (<p className="text-xs text-zinc-500">
                                {t("settings.relays.communitySectionEmpty")}
                              </p>)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Performance Monitor (Also inside Advanced) */}
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-widest text-zinc-400">
                      <Wifi className="h-3.5 w-3.5"/>
                      Network Performance Metrics
                    </div>
                    <RelaySettingsMetricsToolbar category={relayMetricsCategory} onCategoryChange={setRelayMetricsCategory} availableOnly={relayMetricsAvailableOnly} onAvailableOnlyChange={setRelayMetricsAvailableOnly}/>
                    <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-zinc-50/30 dark:bg-black/10 p-2">
                      <RelayDashboard category={relayMetricsCategory} availableOnly={relayMetricsAvailableOnly}/>
                    </div>
                  </div>
                </motion.div>)}
            </AnimatePresence>
            <SettingsActionStatus title={t("settings.relays.actionsTitle")} phase={relayActionPhase} message={relayActionMessage || undefined} summary={t("settings.relays.actionsSummary", {
            defaultValue: "Publish-ready {{writable}} of {{enabled}} · Open sockets {{open}} of {{enabled}}",
            writable: relayRuntime.writableRelayCount,
            open: relayQuickHealth.openCount,
            enabled: relayQuickHealth.enabledCount,
        })}/>
          </div>
        </Card>
      <ConfirmDialog isOpen={isDisableAllRelaysDialogOpen} onClose={() => setIsDisableAllRelaysDialogOpen(false)} onConfirm={handleRelayBulkDisableAllConfirm} title={t("settings.relays.disableAllDialogTitle")} description={t("settings.relays.disableAllDialogDesc")} confirmLabel={t("settings.relays.disableAllConfirm")} cancelLabel={t("common.cancel")} variant="danger"/>

      <ConfirmDialog isOpen={isClearDataDialogOpen} onClose={() => setIsClearDataDialogOpen(false)} onConfirm={handleClearData} title={t("settings.dialogs.clearDataTitle")} description={t("settings.dialogs.clearDataDesc")} confirmLabel={t("settings.actions.clear")} variant="danger"/>

      <ConfirmDialog isOpen={isResetLocalHistoryDialogOpen} onClose={() => setIsResetLocalHistoryDialogOpen(false)} onConfirm={handleResetLocalHistory} title="Reset Local History (Keep Identity)" description="This clears local chat history, sync checkpoints, and cached media on this device, but keeps your identity/session and remember-me credentials." confirmLabel="Reset Local History" variant="danger"/>

      <ConfirmDialog isOpen={isDeleteAccountDialogOpen} onClose={() => setIsDeleteAccountDialogOpen(false)} onConfirm={handleDeleteAccount} title={t("settings.dialogs.deleteAccountTitle")} description={t("settings.dialogs.deleteAccountDesc")} confirmLabel={t("settings.actions.delete")} variant="danger"/>
    </>);
}
