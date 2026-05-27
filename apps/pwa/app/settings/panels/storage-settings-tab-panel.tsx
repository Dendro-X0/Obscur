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
import {
  ensureLocalMediaStoragePathReady,
  openLocalMediaStoragePath,
  pickLocalMediaStorageRootPath,
  purgeLocalMediaCache,
} from "@/app/features/vault/services/local-media-store";
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

export default function StorageSettingsTabPanel(): React.JSX.Element {
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
        <Card title={t("settings.tabs.storage")} description={t("settings.storage.desc")} className="w-full">
          <div className="space-y-8">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="space-y-1">
                  <Label className="font-semibold text-base">{t("settings.storage.effectiveModeTitle", "Effective Mode")}</Label>
                  <p className="text-xs text-zinc-500">{t("settings.storage.effectiveModeDesc", "Derived from active provider and local vault toggles.")}</p>
              </div>
              <span className={cn(
                "rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide",
                storageMode === "hybrid" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                storageMode === "nip96" && "bg-blue-500/15 text-blue-600 dark:text-blue-400",
                storageMode === "local_vault" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                storageMode === "disabled" && "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
              )}>
                {translateStorageMode(storageMode)}
              </span>
              </div>

              {/* Chat Performance Mode */}
              <SettingsToggleCard
                title={t("settings.storage.performanceModeTitle", "Chat Performance Mode (Phase 1)")}
                description={t("settings.storage.performanceModeDesc", "Enable batched chat updates and adaptive rendering for smoother scrolling on large chats.")}
                checked={privacySettings.chatPerformanceV2}
                onChange={(checked) => handleSavePrivacy({ ...privacySettings, chatPerformanceV2: checked })}
              />

              {/* v0.8.3 UX rollout */}
              <SettingsToggleCard
                title={t("settings.storage.chatUxV083Title", "Media & Chat UX Refresh (v0.8.3)")}
                description={t("settings.storage.chatUxV083Desc", "Enable the new media viewer and chat interaction polish. Disable to use the stable v0.8.2 UX path.")}
                checked={privacySettings.chatUxV083}
                onChange={(checked) => handleSavePrivacy({ ...privacySettings, chatUxV083: checked })}
              />

              {/* v0.8.7 reliability core rollout */}
              <SettingsToggleCard
                title={t("settings.storage.reliabilityCoreV087Title", "Reliability Core (v0.8.7)")}
                description={t("settings.storage.reliabilityCoreV087Desc", "Adaptive relay scoring + quorum publishing, sync checkpoint/backfill controls, and storage resilience diagnostics.")}
                checked={privacySettings.reliabilityCoreV087}
                onChange={(checked) => handleSavePrivacy({ ...privacySettings, reliabilityCoreV087: checked })}
              />

              <SettingsToggleCard
                title={t("settings.storage.stabilityModeV090Title", "Stability Mode (v0.9 recovery)")}
                description={t("settings.storage.stabilityModeV090Desc", "Forces the safe Add Friend path (contact card/npub/pubkey) and hides unstable discovery UI.")}
                checked={privacySettings.stabilityModeV090}
                onChange={(checked) => handleSavePrivacy({
                  ...privacySettings,
                  stabilityModeV090: checked,
                  deterministicDiscoveryV090: checked ? false : privacySettings.deterministicDiscoveryV090,
                })}
                highlighted
              />

              <SettingsToggleCard
                title={t("settings.storage.deterministicDiscoveryV090Title", "Deterministic Discovery (v0.9 Wave B)")}
                description={t("settings.storage.deterministicDiscoveryV090Desc", "Resolver + request outbox experimental flow. Requires Rust protocol core and stability mode disabled.")}
                checked={privacySettings.deterministicDiscoveryV090}
                onChange={(checked) => handleSavePrivacy({
                  ...privacySettings,
                  deterministicDiscoveryV090: checked,
                  stabilityModeV090: checked ? false : privacySettings.stabilityModeV090,
                })}
              />

              <SettingsToggleCard
                title={t("settings.storage.protocolCoreRustV090Title", "Rust Protocol Core (v0.9 Wave B)")}
                description={t("settings.storage.protocolCoreRustV090Desc", "Enables runtime adapters backed by Rust protocol contracts for identity/session/outbox paths.")}
                checked={privacySettings.protocolCoreRustV090}
                onChange={(checked) => handleSavePrivacy({
                  ...privacySettings,
                  protocolCoreRustV090: checked,
                  x3dhRatchetV090: checked ? privacySettings.x3dhRatchetV090 : false,
                  stabilityModeV090: checked ? false : privacySettings.stabilityModeV090,
                })}
              />

              <SettingsToggleCard
                title={t("settings.storage.x3dhRatchetV090Title", "X3DH + Ratchet (v0.9 Wave C)")}
                description={t("settings.storage.x3dhRatchetV090Desc", "Enables the full rewritten E2EE handshake/session path. Keep off until Wave C gates pass.")}
                checked={privacySettings.x3dhRatchetV090}
                onChange={(checked) => handleSavePrivacy({
                  ...privacySettings,
                  x3dhRatchetV090: checked,
                  protocolCoreRustV090: checked ? true : privacySettings.protocolCoreRustV090,
                  stabilityModeV090: checked ? false : privacySettings.stabilityModeV090,
                })}
              />

              <div className="rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-white dark:bg-black/20 space-y-4">
                <div className="space-y-1">
                  <Label className="font-semibold text-base">{t("settings.storage.discoveryRolloutFlagsTitle", "Discovery Rollout Flags")}</Label>
                  <p className="text-xs text-zinc-500">
                    {t("settings.storage.discoveryRolloutFlagsDesc", "Guard incremental discovery lanes while keeping deterministic add as the canonical path.")}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-black/5 p-3 dark:border-white/10 bg-zinc-50/60 dark:bg-zinc-900/40">
                  <div>
                    <p className="text-sm font-semibold">{t("settings.storage.discoveryInviteCodeTitle", "Invite Code Lookup")}</p>
                    <p className="text-xs text-zinc-500">{t("settings.storage.discoveryInviteCodeDesc", "Allow `OBSCUR-*` code resolution in Add Friend.")}</p>
                  </div>
                  <SettingsToggle
                    checked={privacySettings.discoveryInviteCodeV1 === true}
                    onChange={(checked) => handleSavePrivacy({
                      ...privacySettings,
                      discoveryInviteCodeV1: checked,
                    })}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-black/5 p-3 dark:border-white/10 bg-zinc-50/60 dark:bg-zinc-900/40">
                  <div>
                    <p className="text-sm font-semibold">{t("settings.storage.discoveryDeepLinkTitle", "Deep-Link Contact Import")}</p>
                    <p className="text-xs text-zinc-500">{t("settings.storage.discoveryDeepLinkDesc", "Route `obscur://contact?...` links to deterministic Add Friend resolve.")}</p>
                  </div>
                  <SettingsToggle
                    checked={privacySettings.discoveryDeepLinkV1 === true}
                    onChange={(checked) => handleSavePrivacy({
                      ...privacySettings,
                      discoveryDeepLinkV1: checked,
                    })}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-black/5 p-3 dark:border-white/10 bg-zinc-50/60 dark:bg-zinc-900/40">
                  <div>
                    <p className="text-sm font-semibold">{t("settings.storage.discoverySuggestionsTitle", "Local Friend Suggestions")}</p>
                    <p className="text-xs text-zinc-500">{t("settings.storage.discoverySuggestionsDesc", "Show local-cache candidate suggestions on empty Add Friend search.")}</p>
                  </div>
                  <SettingsToggle
                    checked={privacySettings.discoverySuggestionsV1 === true}
                    onChange={(checked) => handleSavePrivacy({
                      ...privacySettings,
                      discoverySuggestionsV1: checked,
                    })}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-black/5 p-3 dark:border-white/10 bg-zinc-50/60 dark:bg-zinc-900/40">
                  <div>
                    <p className="text-sm font-semibold">{t("settings.storage.tanstackQueryTitle", "TanStack Query Adapter (Phase 1)")}</p>
                    <p className="text-xs text-zinc-500">{t("settings.storage.tanstackQueryDesc", "Enable guarded Query adapters for discovery, identity resolve, relay diagnostics, and account-sync readers.")}</p>
                  </div>
                  <SettingsToggle
                    checked={privacySettings.tanstackQueryV1 === true}
                    onChange={(checked) => handleSavePrivacy({
                      ...privacySettings,
                      tanstackQueryV1: checked,
                    })}
                  />
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isCheckingStorageHealth}
                    onClick={async () => {
                      setIsCheckingStorageHealth(true);
                      try {
                        const health = await checkStorageHealth();
                        setStorageHealthState(health);
                        setStorageStatsTick((prev: number) => prev + 1);
                      } finally {
                        setIsCheckingStorageHealth(false);
                      }
                    }}
                  >
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
                      Observation window: <span className="font-semibold">{Math.round(relayResilienceSnapshot.observedWindowMs / 60_000)} min</span>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                    Beta gate: <span className={cn("font-semibold", relayResilienceBetaGate.ready ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                      {relayResilienceBetaGate.ready ? "ready" : "not_ready"}
                    </span>
                    {!relayResilienceBetaGate.ready ? (
                      <div className="mt-1 text-[11px] text-zinc-500">
                        Reasons: {relayResilienceBetaGate.reasons.join(", ")}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                    Runtime performance gate: <span
                      className={cn(
                        "font-semibold",
                        relayResiliencePerformanceGate.status === "pass"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : relayResiliencePerformanceGate.status === "warn"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-rose-600 dark:text-rose-400"
                      )}
                    >
                      {relayResiliencePerformanceGate.status}
                    </span>
                    {relayResiliencePerformanceGate.status !== "pass" ? (
                      <div className="mt-1 text-[11px] text-zinc-500">
                        Reasons: {relayResiliencePerformanceGate.reasons.join(", ")}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div
                  id="storage-health"
                  className="rounded-xl border border-black/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-900/40"
                >
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
                  {!storageHealthState.mediaIndexOk || !storageHealthState.messageStoreOk || !storageHealthState.queueStoreOk ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const report = await runStorageRecovery();
                          setStorageActionPhase("success");
                          setStorageActionMessage(`Storage repair complete: repaired ${report.repairedEntries}, removed ${report.removedEntries}.`);
                          setStorageStatsTick((prev: number) => prev + 1);
                          const health = await checkStorageHealth();
                          setStorageHealthState(health);
                        }}
                      >
                        Run Repair
                      </Button>
                      {storageHealthState.errorMessage ? (
                        <span className="text-[11px] text-rose-600 dark:text-rose-400">{storageHealthState.errorMessage}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Media Upload Provider */}
              <div className="space-y-4 rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-white dark:bg-black/20">
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <Label className="font-semibold text-base">{t("settings.storage.providerLabel", "Media Upload Provider (NIP-96)")}</Label>
                    <p className="text-xs text-zinc-500">Configure your preferred NIP-96 compliant storage server for profile pictures and chat media.</p>
                  </div>
                  <SettingsToggle
                    checked={nip96Config.enabled}
                    onChange={(checked) => saveNip96Config({ ...nip96Config, enabled: checked })}
                  />
                </div>

                <div className={cn("transition-all duration-300", nip96Config.enabled ? "opacity-100" : "opacity-50 pointer-events-none")}>
                  <Input
                    value={nip96Config.apiUrl}
                    onChange={(e) => saveNip96Config({ ...nip96Config, apiUrl: e.target.value })}
                    placeholder="https://api.provider.com/upload"
                    className="bg-zinc-50 dark:bg-zinc-900 font-mono text-sm"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={cn(
                      "rounded-full px-2 py-1 text-[10px] font-semibold",
                      providerValidation.state === "success" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                      providerValidation.state === "error" && "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                      providerValidation.state === "idle" && "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400"
                    )}>
                      {providerValidation.message}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={providerValidation.state !== "success" || isCheckingProviderReachability}
                      onClick={() => void handleCheckProviderReachability()}
                    >
                      {isCheckingProviderReachability ? "Checking..." : "Check Provider"}
                    </Button>
                  </div>
                  {providerReachabilityNote ? (
                    <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">{providerReachabilityNote}</div>
                  ) : null}
                </div>
              </div>

              {/* Local Vault Data */}
              <div className="space-y-6 rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-white dark:bg-black/20">
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <Label className="font-semibold text-base">{t("settings.storage.localVaultTitle", "Local Vault Data (Desktop)")}</Label>
                    <p className="text-xs text-zinc-500 whitespace-pre-line">
                      {t("settings.storage.localVaultDesc", "Cache sent and received files locally. Relays are used for encrypted transmission only.")}
                    </p>
                  </div>
                  <SettingsToggle
                    checked={localMediaConfig.enabled}
                    onChange={(checked) => saveLocalMediaConfig({ ...localMediaConfig, enabled: checked })}
                  />
                </div>

                <div className={cn("space-y-6 transition-all duration-300", localMediaConfig.enabled ? "opacity-100" : "opacity-50 pointer-events-none")}>
                  {/* Path Configuration */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Storage Location</Label>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-black/5 dark:border-white/5">
                      <div className="space-y-1 overflow-hidden">
                        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Calculated Path</div>
                        <div className="text-sm font-mono text-zinc-800 dark:text-zinc-200 truncate">
                          {isResolvingLocalPath ? "Resolving..." : (localMediaAbsolutePath || "Default App Data")}
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            const previousConfig = localMediaConfig;
                            const selected = await pickLocalMediaStorageRootPath();
                            if (!selected) return;
                            saveLocalMediaConfig({ ...localMediaConfig, customRootPath: selected });
                            const isReady = await ensureLocalMediaStoragePathReady();
                            if (!isReady) {
                              saveLocalMediaConfig(previousConfig);
                              await refreshLocalMediaAbsolutePath();
                              toast.error("Unable to use this folder. Please choose a different location.");
                              return;
                            }
                            await refreshLocalMediaAbsolutePath();
                            toast.success(t("settings.storage.pathSelected", "Local data path selected."));
                          }}
                        >
                          Change Folder
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={async () => {
                            const opened = await openLocalMediaStoragePath();
                            if (!opened) {
                              toast.error("Could not open folder in this runtime. You can copy the path above.");
                            }
                          }}
                        >
                          Open
                        </Button>
                      </div>
                    </div>

                    {localMediaConfig.customRootPath && (
                      <div className="flex justify-end pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-zinc-500"
                          onClick={async () => {
                            saveLocalMediaConfig({ ...localMediaConfig, customRootPath: "" });
                            await refreshLocalMediaAbsolutePath();
                            toast.success(t("settings.storage.pathResetToDefault", "Reset to default app-data path."));
                          }}
                        >
                          Reset to Default Path
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Cache Rules */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-zinc-500 uppercase tracking-widest text-[10px]">Cache Rules</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex items-center justify-between p-4 rounded-xl border border-black/5 dark:border-white/5 bg-zinc-50/30 dark:bg-zinc-900/30 transition-colors">
                        <span className="text-sm font-medium">{t("settings.storage.cacheSent", "Cache sent files")}</span>
                        <SettingsToggle
                          checked={localMediaConfig.cacheSentFiles}
                          onChange={(checked) => saveLocalMediaConfig({ ...localMediaConfig, cacheSentFiles: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-xl border border-black/5 dark:border-white/5 bg-zinc-50/30 dark:bg-zinc-900/30 transition-colors">
                        <span className="text-sm font-medium">{t("settings.storage.cacheReceived", "Cache received files")}</span>
                        <SettingsToggle
                          checked={localMediaConfig.cacheReceivedFiles}
                          onChange={(checked) => saveLocalMediaConfig({ ...localMediaConfig, cacheReceivedFiles: checked })}
                        />
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
                        <Button
                          type="button"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900/30"
                          onClick={async () => {
                            await purgeLocalMediaCache();
                            toast.success(t("settings.storage.cacheCleared", "Local media cache cleared."));
                            setStorageStatsTick((prev: number) => prev + 1);
                            setStorageActionPhase("success");
                            setStorageActionMessage("Local cache cleared.");
                            void refreshLocalMediaAbsolutePath();
                          }}
                        >
                          {t("settings.storage.clearCache", "Clear Local Cache")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/20"
                          onClick={() => setIsResetLocalHistoryDialogOpen(true)}
                        >
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
              <SettingsActionStatus
                title="Storage Actions"
                phase={storageActionPhase}
                message={storageActionMessage || undefined}
                summary={`Mode: ${storageMode.replace("_", " ")} · ${storageStats.itemCount} indexed file(s)`}
              />
            </div>
          </Card>
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
        title={t("settings.dialogs.clearDataTitle", "Clear Local Data")}
        description={t("settings.dialogs.clearDataDesc", "Are you sure you want to clear all local data? This will clear local caches and databases but will not delete your account.")}
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
        title={t("settings.dialogs.deleteAccountTitle", "Wipe Profile & Delete Account")}
        description={t("settings.dialogs.deleteAccountDesc", "Are you sure you want to wipe local account data on this device and publish a deleted-account marker? This does not destroy the private key itself.")}
        confirmLabel={t("settings.actions.delete", "Wipe & Delete Account")}
        variant="danger"
      />
    </>
  );
}
