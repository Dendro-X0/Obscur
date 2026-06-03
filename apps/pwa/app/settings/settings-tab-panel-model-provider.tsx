"use client";

import type React from "react";
import type { ReactNode } from "react";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { nip19 } from "nostr-tools";
import {
  User,
  Shield,
  Network,
  Palette,
  Lock,
  Database,
  Check,
  Eye,
  EyeOff,
  RefreshCcw,
  Activity,
  Bell,
  ShieldAlert,
  Building2,
  Loader2,
  Wifi,
  Copy,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  ArrowUp,
  ArrowDown,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { RelayDashboard } from "../components/relay-dashboard";
import { AvatarUpload } from "../components/avatar-upload";
import { useTranslation } from "react-i18next";
import { PageShell } from "@/app/components/page-shell";
import { cn } from "@/app/lib/utils";
import { useMobileCompactLayout } from "@/app/features/runtime/use-mobile-compact-layout";
import { Card } from "@dweb/ui-kit";
import { Button } from "@dweb/ui-kit";
import { ConfirmDialog } from "@dweb/ui-kit";
import { Input } from "@dweb/ui-kit";
import { Label } from "@dweb/ui-kit";
import { Textarea } from "@dweb/ui-kit";
import { toast } from "@dweb/ui-kit";
import { DesktopUpdater } from "@/app/components/desktop-updater";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { LanguageSelector } from "@/app/components/language-selector";
import useNavBadges from "@/app/features/main-shell/hooks/use-nav-badges";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { createPendingStartupAuthState } from "@/app/features/auth/services/startup-auth-state-contracts";
import { useProfile } from "@/app/features/profile/hooks/use-profile";
import { ProfileCompletenessIndicator } from "@/app/features/profile/components/profile-completeness-indicator";
import { seedProfileMetadataCache } from "@/app/features/profile/hooks/use-profile-metadata";
import { useNotificationPreference } from "@/app/features/notifications/hooks/use-notification-preference";
import { useProfilePublisher } from "@/app/features/profile/hooks/use-profile-publisher";
import { discoveryCache } from "@/app/features/search/services/discovery-cache";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useRelayPoolRef } from "@/app/features/relays/hooks/use-relay-pool-ref";
import { RelayReadinessSettingsBanner } from "@/app/features/relays/components/relay-readiness-settings-banner";
import { deriveRelayNodeStatus, deriveRelayRuntimeStatus } from "@/app/features/relays/lib/relay-runtime-status";
import { getApiBaseUrl } from "@/app/features/relays/utils/api-base-url";
import { validateRelayUrl } from "@/app/features/relays/utils/validate-relay-url";
import { GroupService } from "@/app/features/groups/services/group-service";
import {
  loadCommunityMembershipLedger,
  selectJoinedCommunityMembershipLedgerEntries,
} from "@/app/features/groups/services/community-membership-ledger";
import { persistExplicitCommunityMembershipLeave } from "@/app/features/groups/services/community-membership-coordinator";
import {
  enqueueCommunityLeaveOutboxItem,
  recordCommunityLeaveRelayPublishOutcome,
} from "@/app/features/groups/services/community-leave-outbox";
import { toGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import type { GroupConversation } from "@/app/features/messaging/types";
import { requestNotificationPermission } from "@/app/features/notifications/utils/request-notification-permission";
import { showDesktopNotification } from "@/app/features/notifications/utils/show-desktop-notification";
import { TrustSettingsPanel } from "@/app/features/messaging/components/trust-settings-panel";
import { PasswordResetPanel } from "@/app/features/settings/components/password-reset-panel";
import { AutoLockSettingsPanel } from "@/app/features/settings/components/auto-lock-settings-panel";
import { SecuritySettingsPanel } from "@/app/features/settings/components/security-settings-panel";
import { useTheme } from "@/app/features/settings/hooks/use-theme";
import { useAccessibilityPreferences, type TextScale } from "@/app/features/settings/hooks/use-accessibility-preferences";
import { useBlocklist } from "@/app/features/network/hooks/use-blocklist";
import type { Nip96Config } from "@/app/features/messaging/lib/nip96-upload-service";
import { getNip96StorageKey } from "@/app/features/messaging/lib/nip96-upload-service";
import { resolveNip05 } from "@/app/features/profile/utils/nip05-resolver";
import { PrivacySettingsService, type PrivacySettings } from "@/app/features/settings/services/privacy-settings-service";
import { getV090RolloutPolicy, normalizeV090Flags } from "@/app/features/settings/services/v090-rollout-policy";
import { useUserInviteCode } from "@/app/features/invites/hooks/use-user-invite-code";
import { queryRelayProfiles } from "@/app/features/search/services/relay-discovery-query";
import {
  INVITE_CODE_PREFIX,
  INVITE_CODE_SUFFIX_LENGTH,
  buildInviteCodeFromSuffix,
  extractInviteCodeSuffix,
  generateRandomInviteCode,
  isCanonicalInviteCode,
  normalizeInviteCodeSuffixInput,
} from "@/app/features/invites/utils/invite-code-format";
import { NATIVE_KEY_SENTINEL } from "@/app/features/crypto/crypto-service";
import { encryptedAccountBackupService } from "@/app/features/account-sync/services/encrypted-account-backup-service";
import { accountProjectionRuntime } from "@/app/features/account-sync/services/account-projection-runtime";
import type { ProfilePublishPhase } from "@/app/features/profile/hooks/use-profile-publisher";
import { SettingsActionStatus, type SettingsActionPhase } from "@/app/features/settings/components/settings-action-status";
import {
  getLocalMediaStorageConfig,
  getLocalMediaIndexSnapshot,
  getLocalMediaStorageAbsolutePath,
  ensureLocalMediaStoragePathReady,
  openLocalMediaStoragePath,
  pickLocalMediaStorageRootPath,
  purgeLocalMediaCache,
  saveLocalMediaStorageConfig,
  DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG,
  type LocalMediaStorageConfig
} from "@/app/features/vault/services/local-media-store";
import {
  checkStorageHealth,
  getLastStorageHealthState,
  runStorageRecovery,
  type StorageHealthState,
} from "@/app/features/messaging/services/storage-health-service";
import { resetLocalHistoryKeepingIdentity } from "@/app/features/messaging/services/local-history-reset-service";
import { getReliabilityMetricsSnapshot, getReliabilityRuntimeSnapshot } from "@/app/shared/reliability-observability";
import { scheduleIdleWork } from "@/app/shared/schedule-idle-work";
import { useSearchParams } from "next/navigation";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import { decodePrivateKey } from "@/app/features/auth/utils/decode-private-key";
import {
  captureRetiredIdentityRegistrySnapshot,
  markRetiredIdentityPublicKey,
  restoreRetiredIdentityRegistrySnapshot,
} from "@/app/features/auth/utils/retired-identity-registry";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import {
  archiveAndClearProfileLocalDataKeepingIdentity,
} from "@/app/features/profiles/services/profile-session-lifecycle";
import { archiveProfileWorkspaceBeforeWipe } from "@/app/features/profiles/services/profile-workspace-archive-service";
import { wipeProfileWorkspaceCompletely } from "@/app/features/profiles/services/wipe-profile-workspace";
import { clearLastBoundAccountPublicKeyHex } from "@/app/features/profiles/services/profile-window-account-binding";
import type { ProfileWorkspaceArchiveWriteResult } from "@/app/features/profiles/services/profile-workspace-archive-contracts";
import { writeExportToDataRoot, revealExportPathInFileManager } from "@/app/features/profiles/services/data-root-export-service";
import { getRuntimeCapabilities } from "@/app/features/runtime/runtime-capabilities";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { ProfileSwitcherCard } from "@/app/features/profiles/components/profile-switcher-card";
import { useAccountSyncSnapshot } from "@/app/features/account-sync/hooks/use-account-sync-snapshot";
import { isSupportedPublicUrl, normalizePublicUrl } from "@/app/shared/public-url";
import { relayResilienceObservability } from "@/app/features/relays/services/relay-resilience-observability";
import { roomKeyStore } from "@/app/features/crypto/room-key-store";
import {
  assessRelayCapability,
  getCommunityModeDefinition,
} from "@/app/features/groups/services/community-mode-contract";

import { SettingsTabPanelModelContext, type SettingsTabPanelModel } from "./settings-tab-panel-model-context";
import type { SettingsTabId } from "@/app/features/settings/services/settings-search-index";
import {
  SettingsToggle,
  SettingsToggleCard,
  toSettingsActionPhase,
  validateProfileInput,
  formatBytes,
  formatRatioPercent,
  APP_VERSION,
  DEFAULT_APP_LANGUAGE,
  DEFAULT_STABLE_PRESET,
  DEFAULT_THEME_PREFERENCE,
  DELETE_ACCOUNT_CONFIRM_TEXT,
  ENABLE_API_HEALTH_PROBE,
  RELAY_PRESETS,
  TEXT_SCALE_OPTIONS,
  classifyRelayFailureHint,
  deriveStorageMode,
  deriveStorageStats,
  withActionTimeout,
  toScopedRelayUrlForDelete,
  PRIVATE_KEY_REVEAL_WINDOW_MS,
  PROFILE_PUBLISH_UI_TIMEOUT_MS,
  NIP05_IDENTIFIER_PATTERN,
} from "./settings-tab-panel-shared";
import type {
  ApiHealthState,
  CapabilityState,
  IdentityIntegrityState,
  IdentityStorageMode,
  InviteCodeAvailabilityStatus,
  RelayPresetId,
  SecurityPosture,
  StorageMode,
  StorageStats,
} from "./settings-tab-panel-shared";

export function SettingsTabPanelModelProvider(props: Readonly<{
  activeTab: SettingsTabId;
  children: ReactNode;
}>): React.JSX.Element {
  const activeTab = props.activeTab;
    const { t, i18n } = useTranslation();
    const identity = useIdentity();
    const accountSyncSnapshot = useAccountSyncSnapshot();
    const theme = useTheme();
    const accessibility = useAccessibilityPreferences();
    const displayPublicKeyHex: string = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? "";
    const publicKeyHex: PublicKeyHex | null = (displayPublicKeyHex as PublicKeyHex | null) ?? null;
    const profile = useProfile();
    const notificationPreference = useNotificationPreference();
    const {
      publishProfile,
      getLastReportSnapshot: getProfilePublishReportSnapshot,
      isPublishing,
      phase: profilePublishPhase,
      lastReport: profilePublishReport,
      error: profilePublishError
    } = useProfilePublisher();
    const {
      relayPool: pool,
      relayList,
      relayRuntime,
      triggerRelayRecovery,
      relaySelection,
      setRelayTransportMode,
    } = useRelay();
    const poolRef = useRelayPoolRef(pool);
    const blocklist = useBlocklist({ publicKeyHex });
  
    const userInviteCode = useUserInviteCode({
      publicKeyHex,
      privateKeyHex: identity.state.privateKeyHex || null
    });
  
    const [apiHealth, setApiHealth] = useState<ApiHealthState>({ status: "idle" });
    const [newRelayUrl, setNewRelayUrl] = useState<string>("");
    const [showAdvancedRelays, setShowAdvancedRelays] = useState<boolean>(false);
    const [isDisableAllRelaysDialogOpen, setIsDisableAllRelaysDialogOpen] = useState(false);
    const [isVerifyingNip05, setIsVerifyingNip05] = useState(false);
    const [privacySettings, setPrivacySettings] = useState<PrivacySettings>(() => normalizeV090Flags(PrivacySettingsService.getSettings()));
    const rolloutPolicy = useMemo(() => getV090RolloutPolicy(privacySettings), [privacySettings]);
    const [isPrivateKeyVisible, setIsPrivateKeyVisible] = useState<boolean>(false);
    const [nsecKey, setNsecKey] = useState<string | null>(null);
    const [challangePassword, setChallengePassword] = useState("");
    const [isChallenging, setIsChallenging] = useState(false);
    const [revealExpiresAtMs, setRevealExpiresAtMs] = useState<number | null>(null);
    const [revealSecondsLeft, setRevealSecondsLeft] = useState<number>(0);
    const [deleteAccountConfirmInput, setDeleteAccountConfirmInput] = useState<string>("");
    const [deleteAccountCountdown, setDeleteAccountCountdown] = useState<number>(0);
    const [notificationActionPhase, setNotificationActionPhase] = useState<SettingsActionPhase>("idle");
    const [notificationActionMessage, setNotificationActionMessage] = useState<string>("");
    const [appearanceActionPhase, setAppearanceActionPhase] = useState<SettingsActionPhase>("idle");
    const [appearanceActionMessage, setAppearanceActionMessage] = useState<string>("");
    const [securityActionPhase, setSecurityActionPhase] = useState<SettingsActionPhase>("idle");
    const [securityActionMessage, setSecurityActionMessage] = useState<string>("");
    const [relayActionPhase, setRelayActionPhase] = useState<SettingsActionPhase>("idle");
    const [relayActionMessage, setRelayActionMessage] = useState<string>("");
    const [storageActionPhase, setStorageActionPhase] = useState<SettingsActionPhase>("idle");
    const [storageActionMessage, setStorageActionMessage] = useState<string>("");
    const [moderationActionPhase, setModerationActionPhase] = useState<SettingsActionPhase>("idle");
    const [moderationActionMessage, setModerationActionMessage] = useState<string>("");
    const [profileSaveActionPhase, setProfileSaveActionPhase] = useState<SettingsActionPhase>("idle");
    const [profileSaveActionMessage, setProfileSaveActionMessage] = useState<string>("");
    const [blocklistQuery, setBlocklistQuery] = useState<string>("");
    const [blocklistInput, setBlocklistInput] = useState<string>("");
    const [profilePreflightError, setProfilePreflightError] = useState<string | null>(null);
    const [inviteCodeAvailabilityStatus, setInviteCodeAvailabilityStatus] = useState<InviteCodeAvailabilityStatus>("idle");
    const [inviteCodeAvailabilityMessage, setInviteCodeAvailabilityMessage] = useState<string>("");
    const [isClearDataDialogOpen, setIsClearDataDialogOpen] = useState(false);
    const [isResetLocalHistoryDialogOpen, setIsResetLocalHistoryDialogOpen] = useState(false);
    const [isDeleteAccountDialogOpen, setIsDeleteAccountDialogOpen] = useState(false);
    const [profileArchiveResult, setProfileArchiveResult] = useState<ProfileWorkspaceArchiveWriteResult | null>(null);
    const [isProfileArchiveDialogOpen, setIsProfileArchiveDialogOpen] = useState(false);
    const [profileArchiveDialogMode, setProfileArchiveDialogMode] = useState<"clear_data" | "delete_account">("clear_data");
    const [isPortableBundleExporting, setIsPortableBundleExporting] = useState(false);
    const [isPortableBundleImporting, setIsPortableBundleImporting] = useState(false);
    const portableBundleFileInputRef = useRef<HTMLInputElement | null>(null);
    const translateRelayPresetLabel = useCallback((presetId: RelayPresetId): string => {
      if (presetId === "default_stable") {
        return t("settings.relays.preset.defaultStable", "Default Stable");
      }
      if (presetId === "high_redundancy") {
        return t("settings.relays.preset.highRedundancy", "High Redundancy");
      }
      return t("settings.relays.preset.lowLatency", "Low Latency");
    }, [t]);
    const translatePermissionState = useCallback((permission: NotificationPermission | "unsupported"): string => {
      if (permission === "granted") return t("settings.notifications.permissionState.granted", "granted");
      if (permission === "denied") return t("settings.notifications.permissionState.denied", "denied");
      if (permission === "default") return t("settings.notifications.permissionState.default", "default");
      return t("settings.notifications.permissionState.unsupported", "unsupported");
    }, [t]);
    const translateStorageMode = useCallback((mode: StorageMode): string => {
      if (mode === "hybrid") return t("settings.storage.mode.hybrid", "hybrid");
      if (mode === "nip96") return t("settings.storage.mode.nip96", "NIP-96");
      if (mode === "local_vault") return t("settings.storage.mode.localVault", "local vault");
      return t("settings.storage.mode.disabled", "disabled");
    }, [t]);
    const translateRelayRuntimeText = useCallback((value: string): string => {
      switch (value) {
        case "No relay configured":
          return t("settings.relays.runtime.noRelayConfigured", "No relay configured");
        case "Add at least one relay in Settings -> Relays.":
          return t("settings.relays.runtime.noRelayConfiguredDesc", "Add at least one relay in Settings -> Relays.");
        case "Relay recovery in progress":
          return t("settings.relays.runtime.recoveryInProgress", "Relay recovery in progress");
        case "Relay connections starting":
          return t("settings.relays.runtime.connectionsStarting", "Relay connections starting");
        case "Reconnecting relays and restoring subscriptions.":
          return t("settings.relays.runtime.reconnecting", "Reconnecting relays and restoring subscriptions.");
        case "No writable relays available":
          return t("settings.relays.runtime.noWritableRelays", "No writable relays available");
        case "Messages can queue locally, but relay-backed delivery is currently unavailable.":
          return t("settings.relays.runtime.noWritableRelaysDesc", "Messages can queue locally, but relay-backed delivery is currently unavailable.");
        case "Configured relays healthy":
          return t("settings.relays.runtime.configuredHealthy", "Configured relays healthy");
        case "Relay communication healthy":
          return t("settings.relays.runtime.communicationHealthy", "Relay communication healthy");
        case "Configured relays are healthy again. Fallback relays may remain connected temporarily as standby coverage.":
          return t("settings.relays.runtime.configuredHealthyDesc", "Configured relays are healthy again. Fallback relays may remain connected temporarily as standby coverage.");
        case "Configured relays are writable and this window is seeing recent relay events.":
          return t("settings.relays.runtime.communicationHealthyDesc", "Configured relays are writable and this window is seeing recent relay events.");
        case "Relay event flow degraded":
          return t("settings.relays.runtime.eventFlowDegraded", "Relay event flow degraded");
        case "Relay connectivity degraded":
          return t("settings.relays.runtime.connectivityDegraded", "Relay connectivity degraded");
        case "Sockets are open, but this window has not seen recent relay events.":
          return t("settings.relays.runtime.eventFlowDegradedDesc", "Sockets are open, but this window has not seen recent relay events.");
        case "Fallback relays are active; connectivity is working with reduced trust and redundancy.":
          return t("settings.relays.runtime.connectivityDegradedDesc", "Fallback relays are active; connectivity is working with reduced trust and redundancy.");
        case "Some configured relays are unavailable or partially useful. Review individual relay status below.":
          return t("settings.relays.runtime.partialUtilityDesc", "Some configured relays are unavailable or partially useful. Review individual relay status below.");
        default:
          if (value.startsWith("Restoring runtime state: ")) {
            return t("settings.relays.runtime.restoringState", {
              defaultValue: "Restoring runtime state: {{stage}}.",
              stage: value.replace("Restoring runtime state: ", "").replace(/\.$/, ""),
            });
          }
          return value;
      }
    }, [t]);
    const translateRelayNodeBadge = useCallback((value: string): string => {
      switch (value) {
        case "Disabled": return t("settings.relays.node.badge.disabled", "Disabled");
        case "Cooling down": return t("settings.relays.node.badge.coolingDown", "Cooling down");
        case "Connecting": return t("settings.relays.node.badge.connecting", "Connecting");
        case "Error": return t("settings.relays.node.badge.error", "Error");
        case "Fallback active": return t("settings.relays.node.badge.fallbackActive", "Fallback active");
        case "Degraded": return t("settings.relays.node.badge.degraded", "Degraded");
        case "High latency": return t("settings.relays.node.badge.highLatency", "High latency");
        case "No recent events": return t("settings.relays.node.badge.noRecentEvents", "No recent events");
        case "Healthy": return t("settings.relays.node.badge.healthy", "Healthy");
        default: return value;
      }
    }, [t]);
    const translateRelayNodeRole = useCallback((value: string): string => {
      switch (value) {
        case "Disabled": return t("settings.relays.node.role.disabled", "Disabled");
        case "Fallback": return t("settings.relays.node.role.fallback", "Fallback");
        case "Transient": return t("settings.relays.node.role.transient", "Transient");
        case "Configured": return t("settings.relays.node.role.configured", "Configured");
        default: return value;
      }
    }, [t]);
    const translateRelayNodeDetail = useCallback((value: string): string => {
      switch (value) {
        case "This relay is configured for the profile but currently disabled.":
          return t("settings.relays.node.detail.disabled", "This relay is configured for the profile but currently disabled.");
        case "Repeated failures triggered relay backoff.":
          return t("settings.relays.node.detail.backoff", "Repeated failures triggered relay backoff.");
        case "The runtime is actively establishing this relay connection.":
          return t("settings.relays.node.detail.connecting", "The runtime is actively establishing this relay connection.");
        case "The last relay connection attempt failed.":
          return t("settings.relays.node.detail.lastAttemptFailed", "The last relay connection attempt failed.");
        case "This relay is connected as temporary fallback coverage, not primary configured transport.":
          return t("settings.relays.node.detail.fallbackActive", "This relay is connected as temporary fallback coverage, not primary configured transport.");
        case "This relay is connected, but it is still being evaluated after recent failures.":
          return t("settings.relays.node.detail.degraded", "This relay is connected, but it is still being evaluated after recent failures.");
        case "The socket is open, but observed latency is high enough to reduce delivery quality.":
          return t("settings.relays.node.detail.highLatency", "The socket is open, but observed latency is high enough to reduce delivery quality.");
        default:
          if (value.startsWith("Repeated failures triggered backoff. Next retry is scheduled automatically.")) {
            return t("settings.relays.node.detail.backoffRetry", "Repeated failures triggered backoff. Next retry is scheduled automatically.");
          }
          return value;
      }
    }, [t]);
    const translateRelayConfidenceLabel = useCallback((value: string): string => {
      if (value.startsWith("Insufficient data (")) {
        const count = Number(value.replace("Insufficient data (", "").replace(")", "")) || 0;
        return t("settings.relays.node.confidence.insufficient", "Insufficient data ({{count}})", { count });
      }
      if (value.startsWith("Low confidence (")) {
        const count = Number(value.replace("Low confidence (", "").replace(")", "")) || 0;
        return t("settings.relays.node.confidence.low", "Low confidence ({{count}})", { count });
      }
      if (value.startsWith("High confidence (")) {
        const count = Number(value.replace("High confidence (", "").replace(")", "")) || 0;
        return t("settings.relays.node.confidence.high", "High confidence ({{count}})", { count });
      }
      return value;
    }, [t]);
  
    const npubValue = useMemo(() => {
      try {
        return displayPublicKeyHex ? nip19.npubEncode(displayPublicKeyHex) : "";
      } catch {
        return "";
      }
    }, [displayPublicKeyHex]);
  
    const identityDiagnostics = identity.getIdentityDiagnostics?.();
    const startupState = identityDiagnostics?.startupState ?? createPendingStartupAuthState({
      storedPublicKeyHex: identity.state.stored?.publicKeyHex,
    });
  
    const identityStorageMode = useMemo<IdentityStorageMode>(() => {
      if (identity.state.privateKeyHex === NATIVE_KEY_SENTINEL) return "native";
      if (identity.state.privateKeyHex) return "session_only";
      if (identity.state.stored?.encryptedPrivateKey) return "encrypted_local";
      return "unknown";
    }, [identity.state.privateKeyHex, identity.state.stored?.encryptedPrivateKey]);
  
    const derivedPublicKeyHex = useMemo(() => {
      if (!identity.state.privateKeyHex || identity.state.privateKeyHex === NATIVE_KEY_SENTINEL) {
        return undefined;
      }
      try {
        return derivePublicKeyHex(identity.state.privateKeyHex);
      } catch {
        return undefined;
      }
    }, [identity.state.privateKeyHex]);
  
    const identityIntegrityState = useMemo<IdentityIntegrityState>(() => {
      if (!identity.state.stored?.publicKeyHex) return "unknown";
      if (startupState.kind === "mismatch") return "mismatch";
      if (derivedPublicKeyHex && derivedPublicKeyHex !== identity.state.stored.publicKeyHex) return "mismatch";
      return "ok";
    }, [derivedPublicKeyHex, identity.state.stored?.publicKeyHex, startupState.kind]);
  
    const securityCapabilityStates = useMemo<Readonly<{
      clipboard: CapabilityState;
      biometric: CapabilityState;
      tor: CapabilityState;
    }>>(() => {
      const isTauriRuntime = getRuntimeCapabilities().isNativeRuntime;
      const clipboardSupported = typeof navigator !== "undefined" && !!navigator.clipboard && typeof navigator.clipboard.writeText === "function";
      return {
        clipboard: clipboardSupported ? "supported" : "unavailable",
        biometric: isTauriRuntime ? "supported" : "unavailable",
        tor: isTauriRuntime ? "supported" : "unavailable",
      };
    }, []);
  
    const securityPosture = useMemo<SecurityPosture>(() => {
      const score = [
        privacySettings.encryptStorageAtRest,
        privacySettings.clearClipboardOnLock && securityCapabilityStates.clipboard === "supported",
        privacySettings.autoLockTimeout > 0,
        privacySettings.biometricLockEnabled && securityCapabilityStates.biometric === "supported",
        privacySettings.enableTorProxy && securityCapabilityStates.tor === "supported",
      ].filter(Boolean).length;
      if (score >= 4) return "strong";
      if (score >= 2) return "moderate";
      return "weak";
    }, [privacySettings, securityCapabilityStates]);
  
    const persistedInviteCodeSuffix = useMemo(() => (
      extractInviteCodeSuffix(profile.state.profile.inviteCode)
    ), [profile.state.profile.inviteCode]);
    const [inviteCodeDraftSuffix, setInviteCodeDraftSuffix] = useState<string>(() => persistedInviteCodeSuffix);
    const [isInviteCodeDraftDirty, setIsInviteCodeDraftDirty] = useState<boolean>(false);
    const inviteCodeDraft = useMemo(() => buildInviteCodeFromSuffix(inviteCodeDraftSuffix), [inviteCodeDraftSuffix]);
  
    const profileValidation = useMemo(() => {
      return validateProfileInput({
        username: profile.state.profile.username,
        about: profile.state.profile.about,
        nip05: profile.state.profile.nip05,
        avatarUrl: profile.state.profile.avatarUrl,
        inviteCode: inviteCodeDraft,
      });
    }, [inviteCodeDraft, profile.state.profile.username, profile.state.profile.about, profile.state.profile.nip05, profile.state.profile.avatarUrl]);
  
    const setInviteCodeFromSuffix = useCallback((suffixInput: string): void => {
      const suffix = normalizeInviteCodeSuffixInput(suffixInput);
      setInviteCodeDraftSuffix(suffix);
      setIsInviteCodeDraftDirty(suffix !== persistedInviteCodeSuffix);
      setInviteCodeAvailabilityStatus("idle");
      setInviteCodeAvailabilityMessage("");
    }, [persistedInviteCodeSuffix]);
  
    const verifyInviteCodeAvailability = useCallback(async (
      inviteCode: string
    ): Promise<Exclude<InviteCodeAvailabilityStatus, "idle" | "checking">> => {
      if (!inviteCode || !isCanonicalInviteCode(inviteCode)) {
        setInviteCodeAvailabilityStatus("idle");
        setInviteCodeAvailabilityMessage("");
        return "unverified";
      }
      setInviteCodeAvailabilityStatus("checking");
      setInviteCodeAvailabilityMessage("Checking code availability...");
      try {
        const relayPool = poolRef.current;
        const [inviteResult, textResult] = await Promise.allSettled([
          queryRelayProfiles({
            pool: relayPool,
            mode: "invite",
            query: inviteCode,
            timeoutMs: 4_500,
            maxResults: 48,
          }),
          queryRelayProfiles({
            pool: relayPool,
            mode: "text",
            query: inviteCode,
            timeoutMs: 4_500,
            maxResults: 48,
          }),
        ]);
        if (inviteResult.status === "rejected" && textResult.status === "rejected") {
          throw new Error("invite_code_lookup_failed");
        }
        const recordsByPubkey = new Map<string, Awaited<ReturnType<typeof queryRelayProfiles>>[number]>();
        if (inviteResult.status === "fulfilled") {
          for (const record of inviteResult.value) {
            recordsByPubkey.set(record.pubkey, record);
          }
        }
        if (textResult.status === "fulfilled") {
          for (const record of textResult.value) {
            recordsByPubkey.set(record.pubkey, record);
          }
        }
        const records = Array.from(recordsByPubkey.values());
        const exactMatches = records.filter((record) => (record.inviteCode ?? "").toUpperCase() === inviteCode.toUpperCase());
        const normalizedSelfPubkey = normalizePublicKeyHex(publicKeyHex ?? undefined);
        const claimedByOther = exactMatches.some((record) => normalizePublicKeyHex(record.pubkey) !== normalizedSelfPubkey);
        if (claimedByOther) {
          setInviteCodeAvailabilityStatus("claimed_by_other");
          setInviteCodeAvailabilityMessage("This code is already claimed. Try Random.");
          return "claimed_by_other";
        }
        setInviteCodeAvailabilityStatus("available");
        setInviteCodeAvailabilityMessage(exactMatches.length > 0 ? "This code is already linked to your account." : "This code appears available.");
        return "available";
      } catch {
        setInviteCodeAvailabilityStatus("unverified");
        setInviteCodeAvailabilityMessage("Could not verify code availability. Check network/relays and retry.");
        return "unverified";
      }
    }, [poolRef, publicKeyHex]);
  
    const handleRandomInviteCode = useCallback(async (): Promise<void> => {
      setProfilePreflightError(null);
      const candidate = generateRandomInviteCode();
      const candidateSuffix = extractInviteCodeSuffix(candidate);
      setInviteCodeDraftSuffix(candidateSuffix);
      setIsInviteCodeDraftDirty(candidateSuffix !== persistedInviteCodeSuffix);
      setInviteCodeAvailabilityStatus("idle");
      setInviteCodeAvailabilityMessage("");
      toast.success("Random code generated.");
    }, [persistedInviteCodeSuffix]);
  
    useEffect(() => {
      if (!isInviteCodeDraftDirty) {
        setInviteCodeDraftSuffix(persistedInviteCodeSuffix);
      }
    }, [isInviteCodeDraftDirty, persistedInviteCodeSuffix]);
  
    useEffect(() => {
      if (activeTab === "profile" || !isInviteCodeDraftDirty) {
        return;
      }
      setInviteCodeDraftSuffix(persistedInviteCodeSuffix);
      setIsInviteCodeDraftDirty(false);
      setInviteCodeAvailabilityStatus("idle");
      setInviteCodeAvailabilityMessage("");
      setProfilePreflightError(null);
    }, [activeTab, isInviteCodeDraftDirty, persistedInviteCodeSuffix]);
  
    useEffect(() => {
      if (profilePreflightError) {
        setProfilePreflightError(null);
      }
      // intentionally keyed to profile validation so field edits clear stale errors
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profileValidation.isValid, profile.state.profile.username, profile.state.profile.about, profile.state.profile.nip05, profile.state.profile.avatarUrl, inviteCodeDraft]);
  
    const clearIndexedDbDatabases = async (): Promise<void> => {
      // IndexedDB permanently excluded — no browser databases to delete.
      return;
    };
  
    const clearRuntimeCaches = async (): Promise<void> => {
      if (typeof window === "undefined") {
        return;
      }
      if ("caches" in window) {
        try {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
        } catch {
          // Best-effort cache cleanup
        }
      }
      if ("serviceWorker" in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
        } catch {
          // Best-effort service worker cleanup
        }
      }
    };
  
    const publishScopedGroupEvent = useCallback(async (
      params: Readonly<{
        relayUrl: string;
        event: unknown;
      }>
    ): Promise<boolean> => {
      const relayPool = poolRef.current;
      const payload = JSON.stringify(["EVENT", params.event]);
      const scopedRelayUrl = toScopedRelayUrlForDelete(params.relayUrl);
      if (!scopedRelayUrl) {
        const fallbackResult = await relayPool.publishToAll(payload);
        return fallbackResult.success;
      }
      if (typeof relayPool.publishToUrls === "function") {
        const scopedResult = await relayPool.publishToUrls([scopedRelayUrl], payload);
        return scopedResult.success;
      }
      if (typeof relayPool.publishToUrl === "function") {
        const scopedResult = await relayPool.publishToUrl(scopedRelayUrl, payload);
        return scopedResult.success;
      }
      if (typeof relayPool.publishToRelay === "function") {
        const scopedResult = await relayPool.publishToRelay(scopedRelayUrl, payload);
        return scopedResult.success;
      }
      const fallbackResult = await relayPool.publishToAll(payload);
      return fallbackResult.success;
    }, [poolRef]);
  
    const leaveJoinedCommunitiesBeforeAccountDeletion = useCallback(async (): Promise<Readonly<{
      joinedCount: number;
      leftPublishedCount: number;
      leftPublishFailureCount: number;
    }>> => {
      if (!publicKeyHex || !identity.state.privateKeyHex) {
        return {
          joinedCount: 0,
          leftPublishedCount: 0,
          leftPublishFailureCount: 0,
        };
      }
  
      const ledgerEntries = loadCommunityMembershipLedger(publicKeyHex);
      const joinedEntries = selectJoinedCommunityMembershipLedgerEntries(ledgerEntries);
      if (joinedEntries.length === 0) {
        return {
          joinedCount: 0,
          leftPublishedCount: 0,
          leftPublishFailureCount: 0,
        };
      }
  
      const groupService = new GroupService(publicKeyHex, identity.state.privateKeyHex as PrivateKeyHex);
      let leftPublishedCount = 0;
      let leftPublishFailureCount = 0;
  
      for (const entry of joinedEntries) {
        const groupId = entry.groupId.trim();
        const relayUrl = entry.relayUrl?.trim() ?? "";
        if (groupId.length === 0 || relayUrl.length === 0) {
          leftPublishFailureCount += 1;
          continue;
        }
  
        enqueueCommunityLeaveOutboxItem({
          publicKeyHex,
          groupId,
          relayUrl,
          communityId: entry.communityId,
        });
  
        const group: GroupConversation = {
          kind: "group",
          id: toGroupConversationId({
            groupId,
            relayUrl,
            communityId: entry.communityId,
          }),
          communityId: entry.communityId,
          groupId,
          relayUrl,
          displayName: entry.displayName ?? "Private Group",
          memberPubkeys: entry.memberPubkeys ?? [publicKeyHex],
          lastMessage: "",
          unreadCount: 0,
          lastMessageTime: new Date(entry.updatedAtUnixMs ?? Date.now()),
          access: "invite-only",
          memberCount: Math.max(1, entry.memberPubkeys?.length ?? 1),
          adminPubkeys: entry.adminPubkeys ?? [],
          avatar: entry.avatar,
        };
        persistExplicitCommunityMembershipLeave({
          publicKeyHex,
          group,
          updatedAtUnixMs: Date.now(),
          lastEvidenceEventId: entry.lastEvidenceEventId,
        });
  
        let nip29LeavePublished = false;
        let sealedLeavePublished = true;
  
        try {
          const nip29Leave = await groupService.sendNip29Leave({ groupId });
          nip29LeavePublished = await publishScopedGroupEvent({
            relayUrl,
            event: nip29Leave,
          });
        } catch {
          nip29LeavePublished = false;
        }
  
        try {
          const roomKeyHex = await roomKeyStore.getRoomKey(groupId);
          if (roomKeyHex && nip29LeavePublished) {
            const sealedLeave = await groupService.sendSealedLeave({
              groupId,
              roomKeyHex,
            });
            sealedLeavePublished = await publishScopedGroupEvent({
              relayUrl,
              event: sealedLeave,
            });
          }
        } catch {
          sealedLeavePublished = false;
        }
  
        recordCommunityLeaveRelayPublishOutcome({
          publicKeyHex,
          groupId,
          relayUrl,
          success: nip29LeavePublished,
          errorMessage: nip29LeavePublished ? undefined : "bulk_leave_publish_failed",
        });
  
        if (nip29LeavePublished && sealedLeavePublished) {
          leftPublishedCount += 1;
        } else {
          leftPublishFailureCount += 1;
        }
      }
  
      return {
        joinedCount: joinedEntries.length,
        leftPublishedCount,
        leftPublishFailureCount,
      };
    }, [identity.state.privateKeyHex, publicKeyHex, publishScopedGroupEvent]);
  
    const wipeLocalRuntimeData = async (): Promise<void> => {
      const retiredIdentitySnapshot = captureRetiredIdentityRegistrySnapshot();
      try {
        await purgeLocalMediaCache();
      } catch {
        // Best-effort; continue with core wipe.
      }
      sessionStorage.clear();
      localStorage.clear();
      restoreRetiredIdentityRegistrySnapshot(retiredIdentitySnapshot);
      await Promise.all([
        clearIndexedDbDatabases(),
        clearRuntimeCaches(),
      ]);
    };
  
    const openProfileArchiveResultDialog = (
      archiveResult: ProfileWorkspaceArchiveWriteResult | null,
      mode: "clear_data" | "delete_account",
    ): void => {
      setProfileArchiveResult(archiveResult);
      setProfileArchiveDialogMode(mode);
      setIsProfileArchiveDialogOpen(true);
      setIsClearDataDialogOpen(false);
      setIsDeleteAccountDialogOpen(false);
    };

    const handleProfileArchiveDialogClose = (): void => {
      setIsProfileArchiveDialogOpen(false);
      setProfileArchiveResult(null);
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    };

    const handleClearData = async () => {
      try {
        setSecurityActionPhase("working");
        setSecurityActionMessage("Exporting archive and clearing local caches...");
        const profileId = getResolvedProfileId();
        const archiveResult = await archiveAndClearProfileLocalDataKeepingIdentity({
          profileId,
          profileLabel: profile.state.profile.username,
          publicKeyHex,
        });
        setSecurityActionPhase("success");
        setSecurityActionMessage("Local caches cleared. Workspace archive saved.");
        openProfileArchiveResultDialog(archiveResult, "clear_data");
      } catch (e) {
        console.error(e);
        setSecurityActionPhase("error");
        setSecurityActionMessage("Failed to clear local data.");
        toast.error("Failed to clear local data.");
      }
    };
  
    const handleResetLocalHistory = async (): Promise<void> => {
      try {
        setStorageActionPhase("working");
        setStorageActionMessage("Resetting local history and sync snapshots...");
        const report = await resetLocalHistoryKeepingIdentity({
          profileId: getResolvedProfileId(),
          publicKeyHex,
        });
        const warningCount = report.warnings.length;
        const summary = `Local history reset. Removed ${report.removedLocalStorageKeyCount} storage key(s), cleared ${report.clearedIndexedDbStoreCount} IndexedDB store(s).`;
        setStorageActionPhase(warningCount > 0 ? "error" : "success");
        setStorageActionMessage(warningCount > 0 ? `${summary} Completed with ${warningCount} warning(s).` : summary);
        if (warningCount > 0) {
          toast.warning(`Local history reset completed with ${warningCount} warning(s).`);
        } else {
          toast.success("Local history reset completed.");
        }
        setIsResetLocalHistoryDialogOpen(false);
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      } catch (error) {
        console.error(error);
        setStorageActionPhase("error");
        setStorageActionMessage("Failed to reset local history.");
        toast.error("Failed to reset local history.");
        setIsResetLocalHistoryDialogOpen(false);
      }
    };
  
    const handleDeleteAccount = async () => {
      try {
        setSecurityActionPhase("working");
        setSecurityActionMessage("Exporting archive, leaving communities, and removing local data...");
        const profileId = getResolvedProfileId();
        const archiveResult = await archiveProfileWorkspaceBeforeWipe({
          profileId,
          profileLabel: profile.state.profile.username,
          reason: "settings_delete_account",
          lastBoundPublicKeyHex: publicKeyHex ?? null,
        });
        if (publicKeyHex) {
          markRetiredIdentityPublicKey({
            publicKeyHex,
            profileId,
          });
        }
        const publishResult = await publishProfile({
          username: "Deleted Account",
          about: "This account has been deleted.",
          avatarUrl: "",
          nip05: "",
          lud16: "",
          inviteCode: ""
        });

        const leaveResult = await leaveJoinedCommunitiesBeforeAccountDeletion();

        try {
          await identity.forgetIdentity();
        } catch (identityError) {
          console.error("Identity forget failed during delete account:", identityError);
        }

        clearLastBoundAccountPublicKeyHex(profileId);
        await wipeProfileWorkspaceCompletely({
          profileId,
          publicKeyHex: publicKeyHex ?? null,
        });

        if (!publishResult) {
          toast.warning("Local data was removed, but profile overwrite could not be confirmed on relays.");
        }
        if (leaveResult.leftPublishFailureCount > 0) {
          toast.warning(`Local data was removed, but ${leaveResult.leftPublishFailureCount} community leave event(s) could not be confirmed on relays.`);
        }
        setSecurityActionPhase("success");
        setSecurityActionMessage("Local profile data removed. Workspace archive saved.");
        openProfileArchiveResultDialog(archiveResult, "delete_account");
      } catch (e) {
        console.error(e);
        setSecurityActionPhase("error");
        setSecurityActionMessage("Local data removal did not complete cleanly.");
        toast.error("Failed to remove local profile data.");
      } finally {
        setDeleteAccountConfirmInput("");
        setDeleteAccountCountdown(0);
      }
    };
  
    const handleRevealToggle = async () => {
      if (identityIntegrityState === "mismatch") {
        toast.error(identityDiagnostics?.message || "Identity mismatch detected. Resolve diagnostics before key reveal.");
        return;
      }
      if (!isPrivateKeyVisible) {
        // If we have a native key, we might need biometrics/native challenge
        if (identity.state.privateKeyHex === NATIVE_KEY_SENTINEL) {
          try {
            let biometricVerified = false;
            try {
              const biometricResult = await invokeNativeCommand<boolean>("request_biometric_auth");
              if (biometricResult.ok && biometricResult.value) {
                biometricVerified = true;
              } else if (privacySettings.biometricLockEnabled) {
                toast.error("Native authentication failed.");
                return;
              }
            } catch {
              // If biometric command is unavailable, fallback to session access path.
              if (privacySettings.biometricLockEnabled) {
                toast.error("Native authentication failed.");
                return;
              }
            }
            if (!biometricVerified && !privacySettings.biometricLockEnabled) {
              toast.warning("Biometric check unavailable. Using active native session.");
            }
            const nsecResult = await invokeNativeCommand<string>("get_session_nsec");
            if (!nsecResult.ok || !nsecResult.value) {
              toast.error("Security: Failed to fetch key from native storage.");
              return;
            }
            setNsecKey(nsecResult.value);
            setIsPrivateKeyVisible(true);
            setRevealExpiresAtMs(Date.now() + PRIVATE_KEY_REVEAL_WINDOW_MS);
          } catch (e) {
            console.error("Failed to fetch native key:", e);
            toast.error("Security: Failed to fetch key from native storage.");
            return;
          }
        } else {
          // Web flow: show password challenge
          setIsChallenging(true);
        }
      } else {
        setIsPrivateKeyVisible(false);
        setNsecKey(null);
        setChallengePassword("");
        setRevealExpiresAtMs(null);
      }
    };
  
    const handleVerifyChallenge = async () => {
      if (!challangePassword) return;
      try {
        // We attempt to unlock/verify with the provided password
        // Since identity might already be unlocked, we can just use the password to check if it matches the derivation
        // In our current implementation, we'll try to use a dummy unlock or check against stored session
        await identity.unlockIdentity({ passphrase: challangePassword as any });
  
        const state = identity.getIdentitySnapshot();
        if (state.privateKeyHex) {
          const bytes = new Uint8Array(32);
          for (let i = 0; i < 32; i++) {
            bytes[i] = parseInt(state.privateKeyHex.slice(i * 2, i * 2 + 2), 16);
          }
          setNsecKey(nip19.nsecEncode(bytes));
          setIsPrivateKeyVisible(true);
          setIsChallenging(false);
          setChallengePassword("");
          setRevealExpiresAtMs(Date.now() + PRIVATE_KEY_REVEAL_WINDOW_MS);
          toast.success("Identity Unlocked");
        }
      } catch (e) {
        toast.error("Incorrect password");
      }
    };
  
    const copyPrivateKey = async () => {
      let keyToCopy = nsecKey;
      if (!keyToCopy && identity.state.privateKeyHex) {
        if (identity.state.privateKeyHex === NATIVE_KEY_SENTINEL) {
          try {
            const nsecResult = await invokeNativeCommand<string>("get_session_nsec");
            if (!nsecResult.ok || !nsecResult.value) {
              toast.error("Failed to fetch key.");
              return;
            }
            keyToCopy = nsecResult.value;
          } catch (e) {
            toast.error("Failed to fetch key.");
            return;
          }
        } else {
          try {
            const bytes = new Uint8Array(32);
            for (let i = 0; i < 32; i++) {
              bytes[i] = parseInt(identity.state.privateKeyHex.slice(i * 2, i * 2 + 2), 16);
            }
            keyToCopy = nip19.nsecEncode(bytes);
          } catch (e) { }
        }
      }
  
      if (keyToCopy) {
        await navigator.clipboard.writeText(keyToCopy);
        toast.success(t("common.copied"));
      }
    };
  
    const exportPrivateKey = async (): Promise<void> => {
      let key = nsecKey;
      if (!key && identity.state.privateKeyHex && identity.state.privateKeyHex !== NATIVE_KEY_SENTINEL) {
        const bytes = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
          bytes[i] = parseInt(identity.state.privateKeyHex.slice(i * 2, i * 2 + 2), 16);
        }
        key = nip19.nsecEncode(bytes);
      }
      if (!key) {
        toast.error("Private key is not currently available to export.");
        return;
      }
      const payload = `# Obscur Private Key Backup\n${key}\n`;
      const blob = new Blob([payload], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "obscur-private-key-backup.txt";
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Private key exported.");
    };
  
    const resolveActivePrivateKeyHex = async (): Promise<PrivateKeyHex | null> => {
      if (identity.state.privateKeyHex && identity.state.privateKeyHex !== NATIVE_KEY_SENTINEL) {
        return identity.state.privateKeyHex;
      }
      if (identity.state.privateKeyHex !== NATIVE_KEY_SENTINEL) {
        return null;
      }
      const nsecResult = await invokeNativeCommand<string>("get_session_nsec");
      if (!nsecResult.ok || !nsecResult.value) {
        return null;
      }
      return decodePrivateKey(nsecResult.value);
    };
  
    const handleExportPortableBundle = async (): Promise<void> => {
      if (!publicKeyHex) {
        toast.error("No active account found.");
        return;
      }
      if (isPortableBundleExporting) {
        return;
      }
      setIsPortableBundleExporting(true);
      try {
        const privateKeyHex = await resolveActivePrivateKeyHex();
        if (!privateKeyHex) {
          throw new Error("Unlock this account first so private state can be exported.");
        }
        const { bundle } = await encryptedAccountBackupService.exportPortableAccountBundle({
          publicKeyHex,
          privateKeyHex,
          profileLabel: profile.state.profile.username,
        });
        const exportedAtIso = new Date(bundle.exportedAtUnixMs).toISOString().replace(/[:.]/g, "-");
        const filename = `obscur-portable-account-${publicKeyHex.slice(0, 8)}-${exportedAtIso}.json`;
        const { writePortableAccountExportToDataRoot } = await import("@/app/features/profiles/services/unified-account-export-service");
        const writeResult = await writePortableAccountExportToDataRoot({
          fileName: filename,
          bundle,
        });
        toast.success("Portable account bundle exported.");
        if (writeResult.absolutePath) {
          await revealExportPathInFileManager(writeResult.absolutePath);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Portable bundle export failed.");
      } finally {
        setIsPortableBundleExporting(false);
      }
    };
  
    const handlePortableBundleFileSelected = async (
      event: React.ChangeEvent<HTMLInputElement>
    ): Promise<void> => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      if (!publicKeyHex) {
        toast.error("No active account found.");
        event.currentTarget.value = "";
        return;
      }
      if (isPortableBundleImporting) {
        event.currentTarget.value = "";
        return;
      }
      setIsPortableBundleImporting(true);
      try {
        const privateKeyHex = await resolveActivePrivateKeyHex();
        if (!privateKeyHex) {
          throw new Error("Unlock this account first so portable data can be imported.");
        }
        const fileText = await file.text();
        const rawBundle = JSON.parse(fileText);
        await encryptedAccountBackupService.importPortableAccountBundle({
          bundle: rawBundle,
          publicKeyHex,
          privateKeyHex,
          profileId: getResolvedProfileId(),
          appendCanonicalEvents: accountProjectionRuntime.appendCanonicalEvents.bind(accountProjectionRuntime),
        });
        toast.success("Portable account bundle imported.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Portable bundle import failed.");
      } finally {
        event.currentTarget.value = "";
        setIsPortableBundleImporting(false);
      }
    };
  
    const handleArmDeleteAccount = (): void => {
      if (deleteAccountConfirmInput.trim() !== DELETE_ACCOUNT_CONFIRM_TEXT) {
        toast.error(`Type "${DELETE_ACCOUNT_CONFIRM_TEXT}" to continue.`);
        return;
      }
      setDeleteAccountCountdown(5);
    };
  
    const handleLockNow = (): void => {
      identity.lockIdentity();
      setSecurityActionPhase("success");
      setSecurityActionMessage("Session locked.");
      toast.success("Session locked.");
    };
  
    const handleProfileSwitchLock = (): void => {
      identity.lockIdentity();
      setIsPrivateKeyVisible(false);
      setNsecKey(null);
      setRevealExpiresAtMs(null);
      setIsChallenging(false);
    };
  
    useEffect(() => {
      return () => {
        profile.revert();
      };
    }, []);
  
    useEffect(() => {
      if (!isPrivateKeyVisible || !revealExpiresAtMs) {
        setRevealSecondsLeft(0);
        return;
      }
      const tick = (): void => {
        const leftMs = revealExpiresAtMs - Date.now();
        const next = Math.max(0, Math.ceil(leftMs / 1000));
        setRevealSecondsLeft(next);
        if (leftMs <= 0) {
          setIsPrivateKeyVisible(false);
          setNsecKey(null);
          setRevealExpiresAtMs(null);
        }
      };
      tick();
      const interval = setInterval(tick, 250);
      return () => clearInterval(interval);
    }, [isPrivateKeyVisible, revealExpiresAtMs]);
  
    useEffect(() => {
      const onBlur = (): void => {
        if (!isPrivateKeyVisible) return;
        setIsPrivateKeyVisible(false);
        setNsecKey(null);
        setRevealExpiresAtMs(null);
      };
      if (typeof window !== "undefined") {
        window.addEventListener("blur", onBlur);
        return () => window.removeEventListener("blur", onBlur);
      }
    }, [isPrivateKeyVisible]);
  
    useEffect(() => {
      if (deleteAccountCountdown <= 0) return;
      const timer = setTimeout(() => setDeleteAccountCountdown((prev) => Math.max(0, prev - 1)), 1000);
      return () => clearTimeout(timer);
    }, [deleteAccountCountdown]);
  
    useEffect(() => {
      if (deleteAccountCountdown > 0 && deleteAccountConfirmInput.trim() !== DELETE_ACCOUNT_CONFIRM_TEXT) {
        setDeleteAccountCountdown(0);
      }
    }, [deleteAccountConfirmInput, deleteAccountCountdown]);
  
    const [nip96Config, setNip96Config] = useState<Nip96Config>(() => {
      const fallback: Nip96Config = { apiUrl: "", enabled: false };
      const rewriteLegacyNip96Url = (value: string): string => {
        if (value === "https://nostr.build/api/v2/upload/files") {
          return "https://nostr.build/api/v2/nip96/upload";
        }
        if (value === "https://sovbit.host/api/v2/upload/files") {
          return "https://api.sovbit.host/api/upload/files";
        }
        return value;
      };
      if (typeof window === "undefined") return fallback;
      try {
        const stored = localStorage.getItem(getNip96StorageKey());
        if (stored) {
          const parsed = JSON.parse(stored) as Nip96Config;
          const normalized: Nip96Config = {
            ...parsed,
            apiUrl: typeof parsed.apiUrl === "string" ? rewriteLegacyNip96Url(parsed.apiUrl) : parsed.apiUrl,
            apiUrls: Array.isArray(parsed.apiUrls)
              ? Array.from(new Set(parsed.apiUrls.map((url) => rewriteLegacyNip96Url(url))))
              : parsed.apiUrls,
          };
          localStorage.setItem(getNip96StorageKey(), JSON.stringify(normalized));
          return normalized;
        }
        if (window.location.hostname.includes("vercel.app") || getRuntimeCapabilities().isNativeRuntime) {
          return { apiUrl: "https://nostr.build/api/v2/nip96/upload", enabled: true };
        }
        return fallback;
      } catch {
        return fallback;
      }
    });
    const [localMediaConfig, setLocalMediaConfig] = useState<LocalMediaStorageConfig>(() => getLocalMediaStorageConfig());
    const [localMediaAbsolutePath, setLocalMediaAbsolutePath] = useState<string>("");
    const [isResolvingLocalPath, setIsResolvingLocalPath] = useState<boolean>(false);
    const [storageStatsTick, setStorageStatsTick] = useState<number>(0);
    const [reliabilityTick, setReliabilityTick] = useState<number>(0);
    const [storageHealthState, setStorageHealthState] = useState<StorageHealthState>(() => getLastStorageHealthState());
    const [isCheckingStorageHealth, setIsCheckingStorageHealth] = useState<boolean>(false);
    const [isCheckingProviderReachability, setIsCheckingProviderReachability] = useState<boolean>(false);
    const [providerReachabilityNote, setProviderReachabilityNote] = useState<string>("");
  
    const saveNip96Config = (newConfig: Nip96Config) => {
      setNip96Config(newConfig);
      localStorage.setItem(getNip96StorageKey(), JSON.stringify(newConfig));
    };
  
    const saveLocalMediaConfig = (newConfig: LocalMediaStorageConfig): void => {
      const normalized = saveLocalMediaStorageConfig(newConfig);
      setLocalMediaConfig(normalized);
      setStorageStatsTick((prev) => prev + 1);
    };
  
    const refreshLocalMediaAbsolutePath = async (): Promise<void> => {
      setIsResolvingLocalPath(true);
      try {
        const resolved = await getLocalMediaStorageAbsolutePath();
        setLocalMediaAbsolutePath(resolved || "");
      } finally {
        setIsResolvingLocalPath(false);
      }
    };
  
    useEffect(() => {
      if (activeTab !== "storage") {
        return;
      }
      let cancelled = false;
      const cancelIdle = scheduleIdleWork(() => {
        if (!cancelled) {
          void refreshLocalMediaAbsolutePath();
        }
      });
      return () => {
        cancelled = true;
        cancelIdle();
      };
    }, [activeTab, localMediaConfig.subdir]);
  
    useEffect(() => {
      if (activeTab !== "storage") return;
      let cancelled = false;
      const cancelIdle = scheduleIdleWork(() => {
        if (cancelled) {
          return;
        }
        setStorageStatsTick((prev) => prev + 1);
        void (async () => {
          setIsCheckingStorageHealth(true);
          try {
            const health = await checkStorageHealth();
            if (!cancelled) {
              setStorageHealthState(health);
            }
          } finally {
            if (!cancelled) {
              setIsCheckingStorageHealth(false);
            }
          }
        })();
      });
      return () => {
        cancelled = true;
        cancelIdle();
      };
    }, [activeTab]);
  
    useEffect(() => {
      if (activeTab !== "storage" || typeof window === "undefined") {
        return;
      }
      const timer = window.setInterval(() => {
        setReliabilityTick((prev) => prev + 1);
      }, 3_000);
      return () => window.clearInterval(timer);
    }, [activeTab]);
  
    const handleSavePrivacy = (newSettings: PrivacySettings) => {
      const normalized = normalizeV090Flags(newSettings);
      setPrivacySettings(normalized);
      PrivacySettingsService.saveSettings(normalized);
    };
  
    const handleVerifyNip05 = async () => {
      const identifier = (profile.state.profile.nip05 || "").trim();
      if (!identifier || !NIP05_IDENTIFIER_PATTERN.test(identifier)) {
        toast.error("Please enter a valid identifier (name@domain.tld)");
        return;
      }
      setIsVerifyingNip05(true);
      try {
        const result = await resolveNip05(identifier);
        if (result.ok) {
          if (result.publicKeyHex === displayPublicKeyHex) {
            toast.success("NIP-05 identifier verified successfully!");
          } else {
            toast.warning("NIP-05 verified, but it belongs to a different public key!");
          }
        } else {
          toast.error(`Verification failed: ${result.reason}`);
        }
      } catch {
        toast.error("An error occurred during verification");
      } finally {
        setIsVerifyingNip05(false);
      }
    };
  
    const handleCheckApi = (): void => {
      const baseUrl: string = getApiBaseUrl().replace(/\/$/, "");
      if (!ENABLE_API_HEALTH_PROBE) {
        setApiHealth({
          status: "disabled",
          baseUrl,
          message: "API probe is disabled in recovery mode. Relay connectivity is the source of truth.",
        });
        return;
      }
      setApiHealth({ status: "checking" });
      const startMs: number = Date.now();
      void fetch(`${baseUrl}/v1/health`, { method: "GET" })
        .then(async (response: Response): Promise<void> => {
          const latencyMs: number = Date.now() - startMs;
          if (!response.ok) {
            setApiHealth({ status: "error", message: `HTTP ${response.status}`, baseUrl });
            return;
          }
          const data: any = await response.json();
          setApiHealth({ status: "ok", latencyMs, timeIso: data.timeIso, baseUrl });
        })
        .catch((error: any): void => {
          setApiHealth({ status: "error", message: error.message || "Unknown error", baseUrl });
        });
    };
  
    const handleEnableNotifications = async (): Promise<void> => {
      setNotificationActionPhase("working");
      setNotificationActionMessage("Requesting notification permission...");
      const result = await requestNotificationPermission();
      if (result.permission === "granted") {
        notificationPreference.setEnabled({ enabled: true });
        setNotificationActionPhase("success");
        setNotificationActionMessage("Notifications are enabled.");
        toast.success("Notifications enabled!");
        return;
      }
      if (result.permission === "unsupported") {
        setNotificationActionPhase("error");
        setNotificationActionMessage("Notifications are not supported in this environment.");
        toast.error("Notifications are not supported.");
        return;
      }
      notificationPreference.setEnabled({ enabled: false });
      setNotificationActionPhase("error");
      setNotificationActionMessage("Permission denied. You can enable notifications from system/browser settings.");
      toast.error("Permission denied");
    };
  
    const handleDisableNotifications = (): void => {
      notificationPreference.setEnabled({ enabled: false });
      setNotificationActionPhase("success");
      setNotificationActionMessage("Notifications are disabled.");
      toast.success("Notifications disabled.");
    };
  
    const handleToggleNotificationChannel = (
      channel: "dmMessages" | "mentionsReplies" | "invitesSystem",
      checked: boolean
    ): void => {
      notificationPreference.setChannels({ channels: { [channel]: checked } });
      setNotificationActionPhase("success");
      setNotificationActionMessage("Notification preferences updated.");
    };
  
    const handleSendTestNotification = async (): Promise<void> => {
      const permission = notificationPreference.state.permission;
      if (permission === "unsupported") {
        setNotificationActionPhase("error");
        setNotificationActionMessage("Notifications are not supported in this environment.");
        toast.error("Notifications are not supported.");
        return;
      }
      if (permission !== "granted") {
        setNotificationActionPhase("error");
        setNotificationActionMessage(
          permission === "denied"
            ? "Notifications are blocked. Enable notification permission in system/browser settings."
            : "Notification permission has not been granted yet. Click Enable Notifications first."
        );
        toast.error(permission === "denied" ? "Notifications are blocked." : "Enable notifications first.");
        return;
      }
      if (!notificationPreference.state.channels.invitesSystem) {
        setNotificationActionPhase("error");
        setNotificationActionMessage("Enable 'Invites and system alerts' to test notification delivery.");
        toast.error("Enable Invites and system alerts first.");
        return;
      }
  
      const result = await showDesktopNotification({
        title: "Obscur test notification",
        body: "Notification delivery is working correctly.",
        tag: "obscur-settings-test"
      });
      if (!result.ok) {
        setNotificationActionPhase("error");
        setNotificationActionMessage("Notification delivery failed in the current runtime.");
        toast.error("Notification delivery failed.");
        return;
      }
      setNotificationActionPhase("success");
      setNotificationActionMessage("Test notification sent.");
      toast.success("Test notification sent.");
    };
  
    const handleResetLanguage = async (): Promise<void> => {
      if (i18n.language === DEFAULT_APP_LANGUAGE) {
        setAppearanceActionPhase("success");
        setAppearanceActionMessage("Language is already set to default.");
        return;
      }
      setAppearanceActionPhase("working");
      setAppearanceActionMessage("Resetting language...");
      await i18n.changeLanguage(DEFAULT_APP_LANGUAGE);
      setAppearanceActionPhase("success");
      setAppearanceActionMessage("Language reset to English.");
      toast.success("Language reset to default.");
    };
  
    const handleResetTheme = (): void => {
      if (theme.preference === DEFAULT_THEME_PREFERENCE) {
        setAppearanceActionPhase("success");
        setAppearanceActionMessage("Theme is already set to system default.");
        return;
      }
      setAppearanceActionPhase("working");
      setAppearanceActionMessage("Resetting theme...");
      theme.setPreference(DEFAULT_THEME_PREFERENCE);
      setAppearanceActionPhase("success");
      setAppearanceActionMessage("Theme reset to system default.");
      toast.success("Theme reset to default.");
    };
  
    const handleResetAccessibility = (): void => {
      accessibility.reset();
      setAppearanceActionPhase("success");
      setAppearanceActionMessage("Accessibility options reset to default.");
      toast.success("Accessibility options reset.");
    };
  
    const handleSaveProfile = async (): Promise<void> => {
      setProfilePreflightError(null);
      if (!profileValidation.isValid) {
        const firstError = profileValidation.usernameError || profileValidation.aboutError || profileValidation.nip05Error || profileValidation.avatarUrlError || profileValidation.inviteCodeError || "Please fix profile validation errors.";
        setProfilePreflightError(firstError);
        setProfileSaveActionPhase("error");
        setProfileSaveActionMessage(firstError);
        toast.error(firstError);
        return;
      }
  
      const normalizedInviteCode = inviteCodeDraft.trim().toUpperCase();
      if (normalizedInviteCode !== profile.state.profile.inviteCode) {
        profile.setInviteCode({ inviteCode: normalizedInviteCode });
      }
      if (normalizedInviteCode.length > 0) {
        setProfileSaveActionPhase("working");
        setProfileSaveActionMessage("Validating friend code...");
        const availability = await verifyInviteCodeAvailability(normalizedInviteCode);
        if (availability === "claimed_by_other") {
          const message = "This friend code is already claimed by another account.";
          setProfilePreflightError(message);
          setProfileSaveActionPhase("error");
          setProfileSaveActionMessage(message);
          toast.error(message);
          return;
        }
        if (availability === "unverified") {
          const message = "Unable to verify friend code uniqueness right now. Please retry.";
          setProfilePreflightError(message);
          setProfileSaveActionPhase("error");
          setProfileSaveActionMessage(message);
          toast.error(message);
          return;
        }
      }
  
      profile.save();
      setIsInviteCodeDraftDirty(false);
      if (publicKeyHex) {
        discoveryCache.upsertProfile({
          pubkey: publicKeyHex,
          name: profile.state.profile.username.trim() || undefined,
          displayName: profile.state.profile.username.trim() || undefined,
          about: profile.state.profile.about?.trim() || undefined,
          picture: profile.state.profile.avatarUrl?.trim() || undefined,
          nip05: profile.state.profile.nip05?.trim() || undefined,
          inviteCode: normalizedInviteCode || undefined,
        });
        seedProfileMetadataCache({
          pubkey: publicKeyHex,
          displayName: profile.state.profile.username.trim() || undefined,
          avatarUrl: profile.state.profile.avatarUrl?.trim() || undefined,
          about: profile.state.profile.about?.trim() || undefined,
          nip05: profile.state.profile.nip05?.trim() || undefined,
        });
      }
      setProfileSaveActionPhase("working");
      setProfileSaveActionMessage("Saving profile and publishing it to relays...");
      const timedOutMessage = "Save finished on this device, but relay publishing timed out. Obscur will keep your saved profile.";
      const publishOperation = publishProfile({
        username: profile.state.profile.username.trim(),
        about: profile.state.profile.about,
        avatarUrl: profile.state.profile.avatarUrl?.trim(),
        nip05: profile.state.profile.nip05?.trim(),
        inviteCode: normalizedInviteCode
      });
      const publishResult = await withActionTimeout(
        publishOperation,
        PROFILE_PUBLISH_UI_TIMEOUT_MS,
        timedOutMessage
      ).catch((error) => {
        const message = error instanceof Error ? error.message : "Failed to publish profile.";
        if (message === timedOutMessage) {
          setProfileSaveActionPhase("working");
          setProfileSaveActionMessage("Profile saved locally. Global publish is still running in the background.");
          toast.info("Profile saved locally. Relay publish is still in progress.");
          return "timed_out" as const;
        }
        setProfileSaveActionPhase("error");
        setProfileSaveActionMessage(message);
        toast.error(message);
        return false;
      });
  
      if (publishResult === "timed_out") {
        void publishOperation.then((finalSuccess) => {
          if (finalSuccess) {
            setProfileSaveActionPhase("success");
            setProfileSaveActionMessage("Profile saved and published to the network.");
            toast.success(t("settings.profileSaved"));
            return;
          }
          const latestPublishReport = getProfilePublishReportSnapshot();
          if (latestPublishReport?.deliveryStatus === "queued") {
            const message = latestPublishReport.message || "Profile is saved on this device, but relay publishing needs a healthier connection.";
            setProfileSaveActionPhase("error");
            setProfileSaveActionMessage(message);
            toast.warning(message);
            return;
          }
          const message = profilePublishError || "Profile publish failed.";
          setProfileSaveActionPhase("error");
          setProfileSaveActionMessage(message);
          toast.error(t("settings.profilePublishFailed"));
        }).catch((error) => {
          const message = error instanceof Error ? error.message : "Failed to publish profile.";
          setProfileSaveActionPhase("error");
          setProfileSaveActionMessage(message);
          toast.error(message);
        });
        return;
      }
  
      if (publishResult) {
        setProfileSaveActionPhase("success");
        setProfileSaveActionMessage("Profile saved and published to the network.");
        toast.success(t("settings.profileSaved"));
        return;
      }
      const latestPublishReport = getProfilePublishReportSnapshot();
      if (latestPublishReport?.deliveryStatus === "queued") {
        const message = latestPublishReport.message || "Profile is saved on this device, but relay publishing needs a healthier connection.";
        setProfileSaveActionPhase("error");
        setProfileSaveActionMessage(message);
        toast.warning(message);
        return;
      }
      setProfileSaveActionPhase("error");
      setProfileSaveActionMessage(profilePublishError || "Profile publish failed.");
      toast.error(t("settings.profilePublishFailed"));
    };
  
    const relayConnectionMap = useMemo(() => {
      return new Map(pool.connections.map((connection) => [connection.url, connection]));
    }, [pool.connections]);
  
    const relayHealthMetricsMap = useMemo(() => {
      return new Map(pool.healthMetrics.map((metric) => [metric.url, metric]));
    }, [pool.healthMetrics]);
  
    const relayRuntimeStatus = useMemo(() => {
      const totalCount = relayList.state.relays.filter((relay) => relay.enabled).length;
      const enabledRelaySet = new Set(relayList.state.relays.filter((relay) => relay.enabled).map((relay) => relay.url));
      const openCount = pool.connections.filter((connection) => connection.status === "open" && enabledRelaySet.has(connection.url)).length;
      return deriveRelayRuntimeStatus({
        openCount,
        totalCount,
        writableCount: relayRuntime.writableRelayCount,
        subscribableCount: relayRuntime.subscribableRelayCount,
        phase: relayRuntime.phase,
        recoveryStage: relayRuntime.recoveryStage,
        lastInboundEventAtUnixMs: relayRuntime.lastInboundEventAtUnixMs,
        fallbackRelayCount: relayRuntime.fallbackRelayUrls.length,
      });
    }, [pool.connections, relayList.state.relays, relayRuntime]);
  
    const relayQuickHealth = useMemo(() => {
      const enabledRelays = relayList.state.relays.filter((relay) => relay.enabled);
      const enabledSet = new Set(enabledRelays.map((relay) => relay.url));
      const openCount = pool.connections.filter((connection) => connection.status === "open" && enabledSet.has(connection.url)).length;
      const latencyValues = enabledRelays
        .map((relay) => relayHealthMetricsMap.get(relay.url)?.latency ?? 0)
        .filter((value) => Number.isFinite(value) && value > 0);
      const averageLatencyMs = latencyValues.length > 0
        ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length)
        : undefined;
  
      const recommendation = relayRuntimeStatus.actionText;
  
      return {
        openCount,
        enabledCount: enabledRelays.length,
        averageLatencyMs,
        recommendation,
      };
    }, [pool.connections, relayHealthMetricsMap, relayList.state.relays, relayRuntimeStatus]);
  
    const relayCapabilityAssessment = useMemo(() => {
      return assessRelayCapability({
        enabledRelayUrls: relayList.state.relays
          .filter((relay) => relay.enabled)
          .map((relay) => relay.url),
      });
    }, [relayList.state.relays]);
  
    const sovereignRoomDefinition = useMemo(
      () => getCommunityModeDefinition("sovereign_room"),
      [],
    );
    const managedWorkspaceDefinition = useMemo(
      () => getCommunityModeDefinition("managed_workspace"),
      [],
    );
  
    const storageMode = useMemo<StorageMode>(() => {
      return deriveStorageMode(nip96Config.enabled, localMediaConfig.enabled);
    }, [localMediaConfig.enabled, nip96Config.enabled]);
  
    const storageStats = useMemo<StorageStats>(() => deriveStorageStats(), [storageStatsTick]);
    const reliabilityMetrics = useMemo(
      () => getReliabilityMetricsSnapshot(),
      [reliabilityTick, storageStatsTick, storageHealthState.checkedAtUnixMs]
    );
    const reliabilityRuntime = useMemo(() => getReliabilityRuntimeSnapshot(), [reliabilityTick]);
    const relayResilienceSnapshot = useMemo(() => relayResilienceObservability.getSnapshot(), [reliabilityTick]);
    const relayResilienceBetaGate = useMemo(
      () => relayResilienceObservability.evaluateBetaReadiness({ snapshot: relayResilienceSnapshot }),
      [relayResilienceSnapshot]
    );
    const relayResiliencePerformanceGate = useMemo(
      () => relayResilienceObservability.evaluateRuntimePerformanceGate({ snapshot: relayResilienceSnapshot }),
      [relayResilienceSnapshot]
    );
    const lastSyncLabel = reliabilityRuntime.lastSyncCompletedAtUnixMs > 0
      ? new Date(reliabilityRuntime.lastSyncCompletedAtUnixMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : "n/a";
  
    const providerValidation = useMemo(() => {
      const raw = (nip96Config.apiUrl ?? "").trim();
      if (!nip96Config.enabled) {
        return { state: "idle" as const, message: "Provider disabled." };
      }
      if (!raw) {
        return { state: "error" as const, message: "Provider URL is required when NIP-96 is enabled." };
      }
      let parsed: URL;
      try {
        parsed = new URL(raw);
      } catch {
        return { state: "error" as const, message: "Invalid URL format." };
      }
      if (parsed.protocol !== "https:") {
        return { state: "error" as const, message: "Use HTTPS for NIP-96 providers." };
      }
      return { state: "success" as const, message: "URL format looks valid." };
    }, [nip96Config.apiUrl, nip96Config.enabled]);
  
    const filteredBlockedKeys = useMemo(() => {
      const query = blocklistQuery.trim().toLowerCase();
      if (!query) return blocklist.state.blockedPublicKeys;
      return blocklist.state.blockedPublicKeys.filter((key) => key.toLowerCase().includes(query));
    }, [blocklist.state.blockedPublicKeys, blocklistQuery]);
  
    const handleAddRelay = (): void => {
      const validated = validateRelayUrl(newRelayUrl);
      if (!validated) {
        toast.error(t("settings.relays.invalidRelayUrl", "Please enter a valid relay URL (wss://...)"));
        return;
      }
      relayList.addRelay({ url: validated.normalizedUrl });
      setNewRelayUrl("");
      toast.success(t("settings.relays.relayAdded", "Relay added"));
    };
  
    const handleRelayBulkEnableAll = (): void => {
      if (relayList.state.relays.length === 0) {
        return;
      }
      relayList.replaceRelays({
        relays: relayList.state.relays.map((r) => ({ url: r.url, enabled: true })),
      });
      toast.success(t("settings.relays.bulkEnableAll", "All relays enabled."));
    };
  
    const handleRelayBulkDisableAllRequest = (): void => {
      if (relayList.state.relays.length === 0) {
        return;
      }
      setIsDisableAllRelaysDialogOpen(true);
    };
  
    const handleRelayBulkDisableAllConfirm = (): void => {
      if (relayList.state.relays.length === 0) {
        setIsDisableAllRelaysDialogOpen(false);
        return;
      }
      relayList.replaceRelays({
        relays: relayList.state.relays.map((r) => ({ url: r.url, enabled: false })),
      });
      toast.success(t("settings.relays.bulkDisableAll", "All relays disabled."));
      setIsDisableAllRelaysDialogOpen(false);
    };
  
    const handleRelayBulkRemoveDisabled = (): void => {
      const kept = relayList.state.relays.filter((r) => r.enabled);
      if (kept.length === 0) {
        toast.error(t(
          "settings.relays.bulkRemoveDisabledBlocked",
          "Enable at least one relay first, or remove rows individually.",
        ));
        return;
      }
      if (kept.length === relayList.state.relays.length) {
        toast.info(t("settings.relays.bulkRemoveDisabledNone", "No disabled relays to remove."));
        return;
      }
      relayList.replaceRelays({ relays: kept });
      toast.success(t("settings.relays.bulkRemoveDisabled", "Removed disabled relays from the list."));
    };
  
    const handleRelayBulkCopyList = async (): Promise<void> => {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        toast.error(t("settings.relays.bulkCopyUnavailable", "Clipboard unavailable in this environment."));
        return;
      }
      try {
        await navigator.clipboard.writeText(JSON.stringify(relayList.state.relays, null, 2));
        toast.success(t("settings.relays.bulkCopySuccess", "Relay list copied as JSON."));
      } catch {
        toast.error(t("settings.relays.bulkCopyFailed", "Failed to copy relay list."));
      }
    };
  
    const applyRelayPreset = (presetId: RelayPresetId): void => {
      const preset = RELAY_PRESETS.find((candidate) => candidate.id === presetId);
      if (!preset) {
        setRelayActionPhase("error");
        setRelayActionMessage("Unknown preset.");
        return;
      }
      relayList.replaceRelays({
        relays: preset.relays.map((url) => ({ url, enabled: true })),
      });
      if (presetId === "high_redundancy") {
        setRelayTransportMode("redundancy");
      }
      setRelayActionPhase("success");
      setRelayActionMessage(`Applied preset: ${preset.label}.`);
      toast.success(`Relay preset applied: ${preset.label}`);
    };
  
    const handleResetRelaySection = (): void => {
      relayList.resetRelays();
      setRelayActionPhase("success");
      setRelayActionMessage("Relay section reset to default list.");
      toast.success("Relay section reset.");
    };
  
    const handleRefreshRelayStatus = async (): Promise<void> => {
      relayResilienceObservability.recordOperatorIntervention();
      const enabledCount = relayList.state.relays.filter((relay) => relay.enabled).length;
      if (enabledCount === 0) {
        setRelayActionPhase("error");
        setRelayActionMessage("Enable at least one relay before refreshing status.");
        toast.error("No enabled relays to refresh.");
        return;
      }
  
      setRelayActionPhase("working");
      setRelayActionMessage("Refreshing relay status...");
  
      try {
        pool.reconnectAll();
        pool.resubscribeAll();
        await triggerRelayRecovery("manual");
        const connected = await pool.waitForConnection(2_500);
        const writableSnapshot = pool.getWritableRelaySnapshot(
          relayList.state.relays.filter((relay) => relay.enabled).map((relay) => relay.url)
        );
        if (connected && writableSnapshot.openRelayCount > 0) {
          setRelayActionPhase("success");
          setRelayActionMessage(`Relay status refreshed. ${writableSnapshot.openRelayCount}/${writableSnapshot.totalRelayCount} relays are writable.`);
          toast.success("Relay status refreshed.");
          return;
        }
  
        setRelayActionPhase("error");
        setRelayActionMessage("Refresh completed, but no writable relays are currently available.");
        toast.error("Relay refresh completed without a writable connection.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Relay refresh failed.";
        setRelayActionPhase("error");
        setRelayActionMessage(message);
        toast.error(message);
      }
    };
  
    const handleResetStorageSection = async (): Promise<void> => {
      const defaultNip96: Nip96Config = { enabled: false, apiUrl: "" };
      saveNip96Config(defaultNip96);
      saveLocalMediaConfig(DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG);
      setProviderReachabilityNote("");
      await refreshLocalMediaAbsolutePath();
      setStorageStatsTick((prev) => prev + 1);
      setStorageActionPhase("success");
      setStorageActionMessage("Storage section reset to defaults.");
      toast.success("Storage section reset.");
    };
  
    const handleCheckProviderReachability = async (): Promise<void> => {
      const url = (nip96Config.apiUrl ?? "").trim();
      if (providerValidation.state !== "success") {
        setStorageActionPhase("error");
        setStorageActionMessage("Fix provider URL before reachability check.");
        return;
      }
      setIsCheckingProviderReachability(true);
      setStorageActionPhase("working");
      setStorageActionMessage("Checking provider reachability...");
      setProviderReachabilityNote("");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6_000);
      try {
        await fetch(url, { method: "GET", mode: "no-cors", signal: controller.signal });
        setStorageActionPhase("success");
        setStorageActionMessage("Provider responded to reachability check.");
        setProviderReachabilityNote(`Reachable: ${url}`);
      } catch {
        setStorageActionPhase("error");
        setStorageActionMessage("Provider reachability check failed. Save is still allowed.");
        setProviderReachabilityNote("Could not verify provider reachability.");
      } finally {
        clearTimeout(timeout);
        setIsCheckingProviderReachability(false);
      }
    };
  
    const handleAddBlockedKey = (): void => {
      const input = blocklistInput.trim();
      if (!input) {
        setModerationActionPhase("error");
        setModerationActionMessage("Enter a public key first.");
        return;
      }
      const normalized = normalizePublicKeyHex(input);
      if (!normalized) {
        setModerationActionPhase("error");
        setModerationActionMessage("Invalid public key format.");
        return;
      }
      if (blocklist.state.blockedPublicKeys.includes(normalized)) {
        setModerationActionPhase("success");
        setModerationActionMessage("Key is already blocked.");
        return;
      }
      blocklist.addBlocked({ publicKeyInput: normalized });
      setBlocklistInput("");
      setModerationActionPhase("success");
      setModerationActionMessage("User blocked.");
      toast.success("User blocked.");
    };
  
    const handleUnblockAll = (): void => {
      if (blocklist.state.blockedPublicKeys.length === 0) {
        setModerationActionPhase("success");
        setModerationActionMessage("Blocklist is already empty.");
        return;
      }
      for (const key of blocklist.state.blockedPublicKeys) {
        blocklist.removeBlocked({ publicKeyHex: key });
      }
      setModerationActionPhase("success");
      setModerationActionMessage("All blocked users removed.");
      toast.success("Blocklist cleared.");
    };
  
  const model: SettingsTabPanelModel = {
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
    isProfileArchiveDialogOpen,
    profileArchiveDialogMode,
    profileArchiveResult,
    handleProfileArchiveDialogClose,
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
    wipeLocalRuntimeData,
  };
  return (
    <SettingsTabPanelModelContext.Provider value={model}>
      {props.children}
    </SettingsTabPanelModelContext.Provider>
  );
}

