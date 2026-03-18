"use client";

import type React from "react";
import { useMemo, useState, useEffect, useCallback } from "react";
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
import { useProfile } from "@/app/features/profile/hooks/use-profile";
import { ProfileCompletenessIndicator } from "@/app/features/profile/components/profile-completeness-indicator";
import { seedProfileMetadataCache } from "@/app/features/profile/hooks/use-profile-metadata";
import { useNotificationPreference } from "@/app/features/notifications/hooks/use-notification-preference";
import { useProfilePublisher } from "@/app/features/profile/hooks/use-profile-publisher";
import { discoveryCache } from "@/app/features/search/services/discovery-cache";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { deriveRelayNodeStatus, deriveRelayRuntimeStatus } from "@/app/features/relays/lib/relay-runtime-status";
import { getApiBaseUrl } from "@/app/features/relays/utils/api-base-url";
import { validateRelayUrl } from "@/app/features/relays/utils/validate-relay-url";
import { requestNotificationPermission } from "@/app/features/notifications/utils/request-notification-permission";
import { showDesktopNotification } from "@/app/features/notifications/utils/show-desktop-notification";
import { TrustSettingsPanel } from "@/app/features/messaging/components/trust-settings-panel";
import { PasswordResetPanel } from "@/app/features/settings/components/password-reset-panel";
import { AutoLockSettingsPanel } from "@/app/features/settings/components/auto-lock-settings-panel";
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
import { getReliabilityMetricsSnapshot, getReliabilityRuntimeSnapshot } from "@/app/shared/reliability-observability";
import { useSearchParams } from "next/navigation";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import { getRuntimeCapabilities } from "@/app/features/runtime/runtime-capabilities";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { ProfileSwitcherCard } from "@/app/features/profiles/components/profile-switcher-card";
import { useAccountSyncSnapshot } from "@/app/features/account-sync/hooks/use-account-sync-snapshot";
import { isSupportedPublicUrl, normalizePublicUrl } from "@/app/shared/public-url";
import { relayResilienceObservability } from "@/app/features/relays/services/relay-resilience-observability";

const APP_VERSION: string = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
const ENABLE_API_HEALTH_PROBE =
  process.env.NEXT_PUBLIC_ENABLE_API_HEALTH_PROBE === "1"
  || process.env.NEXT_PUBLIC_ENABLE_API_HEALTH_PROBE === "true";

type ApiHealthState = Readonly<
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok"; latencyMs: number; timeIso: string; baseUrl: string }
  | { status: "disabled"; message: string; baseUrl: string }
  | { status: "error"; message: string; baseUrl: string }
>;

type SettingsTabType =
  | "profile"
  | "identity"
  | "relays"
  | "notifications"
  | "appearance"
  | "blocklist"
  | "privacy"
  | "security"
  | "storage"
  | "updates";

type InviteCodeAvailabilityStatus =
  | "idle"
  | "checking"
  | "available"
  | "claimed_by_other"
  | "unverified";

const toSettingsActionPhase = (phase: ProfilePublishPhase): SettingsActionPhase => {
  if (phase === "waiting_relays") return "waiting";
  if (phase === "preparing") return "preparing";
  if (phase === "mining" || phase === "signing") return "working";
  if (phase === "publishing") return "publishing";
  if (phase === "success") return "success";
  if (phase === "error") return "error";
  return "idle";
};

type ProfileValidationResult = Readonly<{
  usernameError?: string;
  aboutError?: string;
  nip05Error?: string;
  avatarUrlError?: string;
  inviteCodeError?: string;
  isValid: boolean;
}>;

const NIP05_IDENTIFIER_PATTERN = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const DEFAULT_APP_LANGUAGE = "en";
const DEFAULT_THEME_PREFERENCE = "system" as const;
const TEXT_SCALE_OPTIONS: ReadonlyArray<TextScale> = [90, 100, 110, 120];
const PRIVATE_KEY_REVEAL_WINDOW_MS = 20_000;
const PROFILE_PUBLISH_UI_TIMEOUT_MS = 20_000;
const DELETE_ACCOUNT_CONFIRM_TEXT = "WIPE ACCOUNT";

type IdentityStorageMode = "native" | "encrypted_local" | "session_only" | "unknown";
type IdentityIntegrityState = "ok" | "mismatch" | "unknown";
type SecurityPosture = "strong" | "moderate" | "weak";
type CapabilityState = "supported" | "unavailable" | "error";
type RelayPresetId = "default_stable" | "high_redundancy" | "low_latency";
type RelayFailureHint = "timeout" | "network" | "tls" | "rate_limited" | "unknown";
type StorageMode = "nip96" | "local_vault" | "hybrid" | "disabled";
type StorageStats = Readonly<{ itemCount: number; totalBytes: number; lastSavedAtUnixMs?: number }>;

type RelayPreset = Readonly<{
  id: RelayPresetId;
  label: string;
  relays: ReadonlyArray<string>;
}>;

const DEFAULT_STABLE_PRESET: RelayPreset = {
  id: "default_stable",
  label: "Default Stable",
  relays: ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"],
};

const HIGH_REDUNDANCY_PRESET: RelayPreset = {
  id: "high_redundancy",
  label: "High Redundancy",
  relays: [
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://relay.primal.net",
    "wss://relay.snort.social",
    "wss://relay.nostr.band",
  ],
};

const LOW_LATENCY_PRESET: RelayPreset = {
  id: "low_latency",
  label: "Low Latency",
  relays: ["wss://relay.primal.net", "wss://relay.damus.io", "wss://nos.lol"],
};

const RELAY_PRESETS: ReadonlyArray<RelayPreset> = [DEFAULT_STABLE_PRESET, HIGH_REDUNDANCY_PRESET, LOW_LATENCY_PRESET];

const classifyRelayFailureHint = (message?: string): RelayFailureHint => {
  if (!message) return "unknown";
  const normalized = message.toLowerCase();
  if (normalized.includes("timeout") || normalized.includes("timed out")) return "timeout";
  if (normalized.includes("tls") || normalized.includes("ssl") || normalized.includes("handshake") || normalized.includes("certificate")) return "tls";
  if (normalized.includes("429") || normalized.includes("rate") || normalized.includes("throttle")) return "rate_limited";
  if (
    normalized.includes("network")
    || normalized.includes("dns")
    || normalized.includes("offline")
    || normalized.includes("refused")
    || normalized.includes("failed")
  ) {
    return "network";
  }
  return "unknown";
};

const deriveStorageMode = (nip96Enabled: boolean, localVaultEnabled: boolean): StorageMode => {
  if (nip96Enabled && localVaultEnabled) return "hybrid";
  if (nip96Enabled) return "nip96";
  if (localVaultEnabled) return "local_vault";
  return "disabled";
};

const deriveStorageStats = (): StorageStats => {
  const snapshot = getLocalMediaIndexSnapshot();
  const entries = Object.values(snapshot);
  const totalBytes = entries.reduce((sum, entry) => sum + (Number.isFinite(entry.size) ? entry.size : 0), 0);
  const lastSavedAtUnixMs = entries.reduce<number | undefined>((latest, entry) => {
    if (!Number.isFinite(entry.savedAtUnixMs)) return latest;
    if (typeof latest !== "number") return entry.savedAtUnixMs;
    return Math.max(latest, entry.savedAtUnixMs);
  }, undefined);
  return {
    itemCount: entries.length,
    totalBytes,
    lastSavedAtUnixMs,
  };
};

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** idx;
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
};

const formatRatioPercent = (ratio: number): string => {
  if (!Number.isFinite(ratio)) {
    return "n/a";
  }
  return `${(ratio * 100).toFixed(1)}%`;
};

const withActionTimeout = async <T,>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const validateProfileInput = (profile: Readonly<{ username: string; about?: string; nip05?: string; avatarUrl?: string; inviteCode?: string }>): ProfileValidationResult => {
  const username = profile.username.trim();
  const about = (profile.about ?? "").trim();
  const nip05 = (profile.nip05 ?? "").trim();
  const avatarUrl = (profile.avatarUrl ?? "").trim();
  const inviteCode = (profile.inviteCode ?? "").trim();

  let usernameError: string | undefined;
  let aboutError: string | undefined;
  let nip05Error: string | undefined;
  let avatarUrlError: string | undefined;
  let inviteCodeError: string | undefined;

  if (username.length < 3) {
    usernameError = "Username must be at least 3 characters.";
  } else if (username.length > 48) {
    usernameError = "Username is too long (max 48 characters).";
  }
  if (about.length > 280) {
    aboutError = "Description is too long (max 280 characters).";
  }

  if (nip05.length > 0 && !NIP05_IDENTIFIER_PATTERN.test(nip05)) {
    nip05Error = "NIP-05 must use name@domain.tld format.";
  }

  if (avatarUrl.length > 0) {
    const normalizedAvatarUrl = normalizePublicUrl(avatarUrl);
    if (!isSupportedPublicUrl(normalizedAvatarUrl)) {
      avatarUrlError = "Avatar URL must start with /, http://, or https://.";
    }
  }

  if (inviteCode.length > 0 && !isCanonicalInviteCode(inviteCode)) {
    inviteCodeError = `Code must use ${INVITE_CODE_PREFIX}-XXXXXX (6 letters/numbers).`;
  }

  return {
    usernameError,
    aboutError,
    nip05Error,
    avatarUrlError,
    inviteCodeError,
    isValid: !usernameError && !aboutError && !nip05Error && !avatarUrlError && !inviteCodeError,
  };
};

const GROUPS = [
  {
    id: "general",
    labelKey: "settings.groups.general",
    items: [
      { id: "profile", labelKey: "settings.tabs.profile", icon: User },
      { id: "appearance", labelKey: "settings.tabs.appearance", icon: Palette },
      { id: "notifications", labelKey: "settings.tabs.notifications", icon: Bell },
    ]
  },
  {
    id: "account",
    labelKey: "settings.groups.account",
    items: [
      { id: "identity", labelKey: "settings.tabs.identity", icon: Shield },
      { id: "security", labelKey: "settings.tabs.security", icon: Lock },
    ]
  },
  {
    id: "network",
    labelKey: "settings.groups.network",
    items: [
      { id: "relays", labelKey: "settings.tabs.relays", icon: Network },
      { id: "storage", labelKey: "settings.tabs.storage", icon: Database },
    ]
  },
  {
    id: "moderation",
    labelKey: "settings.groups.moderation",
    items: [
      { id: "blocklist", labelKey: "settings.tabs.blocklist", icon: EyeOff },
      { id: "privacy", labelKey: "settings.tabs.privacy", icon: ShieldAlert },
    ]
  },
  {
    id: "system",
    labelKey: "settings.groups.system",
    items: [
      { id: "updates", labelKey: "settings.tabs.updates", icon: RefreshCcw },
    ]
  },
];

function SettingsToggle({ checked, onChange, id }: { checked: boolean; onChange: (checked: boolean) => void; id?: string }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500",
        checked ? "bg-purple-600" : "bg-zinc-300 dark:bg-zinc-700"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

export default function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation();
  const identity = useIdentity();
  const searchParams = useSearchParams();
  const displayPublicKeyHex: string = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? "";
  const publicKeyHex: PublicKeyHex | null = (displayPublicKeyHex as PublicKeyHex | null) ?? null;
  const navBadges = useNavBadges({ publicKeyHex });

  const [activeTab, setActiveTab] = useState<SettingsTabType>("profile");
  const [showMobileMenu, setShowMobileMenu] = useState(true);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (!requestedTab) return;
    const validTabs: ReadonlyArray<SettingsTabType> = ["profile", "identity", "relays", "notifications", "appearance", "blocklist", "privacy", "security", "storage", "updates"];
    if (!validTabs.includes(requestedTab as SettingsTabType)) return;
    setActiveTab(requestedTab as SettingsTabType);
    setShowMobileMenu(false);
  }, [searchParams]);

  return (
    <PageShell
      title={t("settings.title")}
      navBadgeCounts={navBadges.navBadgeCounts}
      hideHeader={!showMobileMenu}
    >
      <div className="mx-auto w-full max-w-6xl p-0 md:p-4">
        <div className="flex flex-col gap-8 md:flex-row">
          {/* Sidebar Navigation - Desktop */}
          <aside className="hidden w-64 shrink-0 md:block sticky top-20 self-start h-fit">
            <nav className="flex flex-col gap-6">
              {GROUPS.map((group) => (
                <div key={group.id} className="space-y-1">
                  <h3 className="px-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-500">
                    {t(group.labelKey)}
                  </h3>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveTab(item.id as SettingsTabType)}
                          className={cn(
                            "group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all text-left outline-none",
                            active
                              ? "bg-gradient-primary border-none text-white shadow-md shadow-purple-500/25 font-bold scale-[1.02] active:scale-[0.98] ring-1 ring-white/10 dark:bg-zinc-800 dark:text-zinc-100"
                              : "border-transparent text-zinc-600 hover:bg-black/5 hover:border-black/5 font-semibold dark:text-zinc-400 dark:hover:bg-zinc-900/40 dark:hover:border-white/5"
                          )}
                        >
                          <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                            active ? "bg-white/20 shadow-sm dark:bg-black/20" : "bg-zinc-100/50 dark:bg-zinc-800/30 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-800"
                          )}>
                            <Icon className={cn("h-4 w-4", active ? "text-white dark:text-purple-400" : "text-zinc-400")} />
                          </div>
                          {t(item.labelKey)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          {/* Mobile Master-Detail View */}
          <div className="flex flex-col w-full md:hidden min-h-[calc(100vh-120px)]">
            <AnimatePresence mode="wait">
              {showMobileMenu ? (
                <motion.div
                  key="menu"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col p-4 space-y-8"
                >
                  {GROUPS.map((group) => (
                    <div key={group.id} className="space-y-3">
                      <h3 className="px-1 text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
                        {t(group.labelKey)}
                      </h3>
                      <div className="overflow-hidden rounded-3xl border border-black/5 bg-white/60 backdrop-blur-xl shadow-lg shadow-black/5 dark:border-white/10 dark:bg-zinc-900/60">
                        {group.items.map((item, idx) => {
                          const Icon = item.icon;
                          const active = activeTab === item.id;
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                setActiveTab(item.id as SettingsTabType);
                                setShowMobileMenu(false);
                              }}
                              className={cn(
                                "flex w-full items-center justify-between px-4 py-4.5 transition-all hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98]",
                                idx < group.items.length - 1 && "border-b border-black/5 dark:border-white/5"
                              )}
                            >
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  "flex h-10 w-10 items-center justify-center rounded-2xl transition-all shadow-sm",
                                  active ? "bg-gradient-primary text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                                )}>
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col items-start gap-0.5">
                                  <span className="text-sm font-black tracking-tight text-zinc-900 dark:text-zinc-100">{t(item.labelKey)}</span>
                                  <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-wider">{group.id}</span>
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-zinc-300" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="content"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex flex-col"
                >
                  <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-black/5 bg-white/80 p-4 backdrop-blur-md dark:border-white/80 dark:bg-black/80">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowMobileMenu(true)}
                      className="h-8 w-8 p-0 hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <h2 className="text-sm font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
                      {t(GROUPS.flatMap(g => g.items).find(i => i.id === activeTab)?.labelKey || "")}
                    </h2>
                  </div>
                  <div className="p-4 pb-32">
                    <MainContentSection activeTab={activeTab} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Main Content Area - Desktop */}
          <main className="hidden min-w-0 flex-1 md:block">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <MainContentSection activeTab={activeTab} />
            </div>
          </main>
        </div>
      </div>
    </PageShell>
  );
}

/**
 * Extracted main content logic to allow reuse between desktop and mobile views
 */
function MainContentSection({ activeTab }: { activeTab: SettingsTabType }): React.JSX.Element {
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
  const { relayPool: pool, relayList, relayRuntime, triggerRelayRecovery } = useRelay();
  const blocklist = useBlocklist({ publicKeyHex });

  const userInviteCode = useUserInviteCode({
    publicKeyHex,
    privateKeyHex: identity.state.privateKeyHex || null
  });

  const [apiHealth, setApiHealth] = useState<ApiHealthState>({ status: "idle" });
  const [newRelayUrl, setNewRelayUrl] = useState<string>("");
  const [showAdvancedRelays, setShowAdvancedRelays] = useState<boolean>(false);
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
  const [isDeleteAccountDialogOpen, setIsDeleteAccountDialogOpen] = useState(false);

  const npubValue = useMemo(() => {
    try {
      return displayPublicKeyHex ? nip19.npubEncode(displayPublicKeyHex) : "";
    } catch {
      return "";
    }
  }, [displayPublicKeyHex]);

  const identityDiagnostics = identity.getIdentityDiagnostics?.();

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
    if (identityDiagnostics?.mismatchReason) return "mismatch";
    if (derivedPublicKeyHex && derivedPublicKeyHex !== identity.state.stored.publicKeyHex) return "mismatch";
    return "ok";
  }, [identity.state.stored?.publicKeyHex, identityDiagnostics?.mismatchReason, derivedPublicKeyHex]);

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
      const [inviteResult, textResult] = await Promise.allSettled([
        queryRelayProfiles({
          pool,
          mode: "invite",
          query: inviteCode,
          timeoutMs: 4_500,
          maxResults: 48,
        }),
        queryRelayProfiles({
          pool,
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
  }, [pool, publicKeyHex]);

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

  const handleClearData = async () => {
    try {
      setSecurityActionPhase("working");
      setSecurityActionMessage("Clearing local data...");
      localStorage.clear();
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }
      if (typeof window !== "undefined") window.location.reload();
    } catch (e) {
      console.error(e);
      setSecurityActionPhase("error");
      setSecurityActionMessage("Failed to clear local data.");
      if (typeof window !== "undefined") window.location.reload();
    }
  };

  const handleDeleteAccount = async () => {
    try {
      // 1. Wipe the public profile on the Nostr network
      await publishProfile({
        username: "Deleted Account",
        about: "This account has been deleted.",
        avatarUrl: "",
        nip05: "",
        lud16: "",
        inviteCode: ""
      });

      // 2. Clear local identity
      await identity.forgetIdentity();

      // 3. Clear all browser storage
      localStorage.clear();
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }

      // 4. Reload to reset state
      if (typeof window !== "undefined") window.location.reload();
    } catch (e) {
      console.error(e);
      if (typeof window !== "undefined") window.location.reload();
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
    void refreshLocalMediaAbsolutePath();
  }, [localMediaConfig.subdir]);

  useEffect(() => {
    if (activeTab !== "storage") return;
    setStorageStatsTick((prev) => prev + 1);
    void (async () => {
      setIsCheckingStorageHealth(true);
      try {
        const health = await checkStorageHealth();
        setStorageHealthState(health);
      } finally {
        setIsCheckingStorageHealth(false);
      }
    })();
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = window.setInterval(() => {
      setReliabilityTick((prev) => prev + 1);
    }, 3_000);
    return () => window.clearInterval(timer);
  }, []);

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
    const success = await withActionTimeout(
      publishProfile({
        username: profile.state.profile.username.trim(),
        about: profile.state.profile.about,
        avatarUrl: profile.state.profile.avatarUrl?.trim(),
        nip05: profile.state.profile.nip05?.trim(),
        inviteCode: normalizedInviteCode
      }),
      PROFILE_PUBLISH_UI_TIMEOUT_MS,
      "Save finished on this device, but relay publishing timed out. Obscur will keep your saved profile."
    ).catch((error) => {
      const message = error instanceof Error ? error.message : "Failed to publish profile.";
      setProfileSaveActionPhase("error");
      setProfileSaveActionMessage(message);
      toast.error(message);
      return false;
    });

    if (success) {
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

  return (
    <div className="grid grid-cols-1 gap-4">
      {activeTab === "profile" && (
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
              <div className="rounded-2xl border border-black/10 bg-white/70 p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/50">
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
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "appearance" && (
        <Card title={t("settings.appearance.title")} description={t("settings.appearance.desc")} className="w-full">
          <div className="space-y-6">
            {/* Language Selection */}
            <div className="group relative overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-br from-white/80 to-zinc-50/40 p-5 backdrop-blur-md shadow-sm transition-all hover:shadow-md dark:border-white/10 dark:from-zinc-900/40 dark:to-zinc-950/20">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex flex-col gap-0.5">
                  <Label className="text-zinc-900 dark:text-zinc-100 font-bold tracking-tight">{t("settings.language")}</Label>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{t("settings.appearance.currentLanguage", "Current language")}: {i18n.language}</p>
                </div>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => void handleResetLanguage()}
                  className="h-8 px-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-primary transition-colors hover:bg-primary/5 dark:hover:text-primary dark:hover:bg-primary/10"
                >
                  {t("settings.appearance.resetLanguage", "Reset")}
                </Button>
              </div>
              <div className="rounded-xl bg-white/50 p-2 dark:bg-black/20">
                <LanguageSelector />
              </div>
            </div>

            {/* Theme Preference */}
            <div className="group relative overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-br from-white/80 to-zinc-50/40 p-5 backdrop-blur-md shadow-sm transition-all hover:shadow-md dark:border-white/10 dark:from-zinc-900/40 dark:to-zinc-950/20">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex flex-col gap-0.5">
                  <Label className="text-zinc-900 dark:text-zinc-100 font-bold tracking-tight">{t("settings.appearance.theme")}</Label>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{t("settings.appearance.currentTheme", "Current theme preference")}: {theme.preference}</p>
                </div>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleResetTheme}
                  className="h-8 px-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-primary transition-colors hover:bg-primary/5 dark:hover:text-primary dark:hover:bg-primary/10"
                >
                  {t("settings.appearance.resetTheme", "Reset")}
                </Button>
              </div>
              <div className="rounded-xl bg-white/50 p-3 dark:bg-black/20">
                <ThemeToggle />
              </div>
            </div>

            {/* Accessibility Settings */}
            <div className="group relative overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-br from-white/80 to-zinc-50/40 p-5 backdrop-blur-md shadow-sm transition-all hover:shadow-md dark:border-white/10 dark:from-zinc-900/40 dark:to-zinc-950/20">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex flex-col gap-0.5">
                  <Label className="text-zinc-900 dark:text-zinc-100 font-bold tracking-tight">{t("settings.appearance.accessibility", "Accessibility")}</Label>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{t("settings.appearance.textScale", "Text Scale")}: {accessibility.preferences.textScale}%</p>
                </div>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleResetAccessibility}
                  className="h-8 px-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-primary transition-colors hover:bg-primary/5 dark:hover:text-primary dark:hover:bg-primary/10"
                >
                  {t("settings.appearance.resetAccessibility", "Reset")}
                </Button>
              </div>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {TEXT_SCALE_OPTIONS.map((scale) => (
                    <Button
                      key={scale}
                      type="button"
                      size="sm"
                      variant={accessibility.preferences.textScale === scale ? "primary" : "outline"}
                      className={cn(
                        "h-10 px-4 font-black transition-all",
                        accessibility.preferences.textScale === scale 
                          ? "shadow-md !border-none" 
                          : "bg-white/50 text-zinc-500 border-black/5 hover:bg-white dark:bg-black/20 dark:text-zinc-400 dark:border-white/5 dark:hover:bg-black/40"
                      )}
                      onClick={() => {
                        accessibility.setTextScale(scale);
                        setAppearanceActionPhase("success");
                        setAppearanceActionMessage(`Text scale set to ${scale}%.`);
                      }}
                    >
                      {scale}%
                    </Button>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-4 rounded-xl border border-black/5 bg-black/5 p-4 dark:border-white/5 dark:bg-black/20">
                  <div className="flex flex-col gap-1">
                    <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {t("settings.appearance.reducedMotion", "Reduced Motion")}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t("settings.appearance.reducedMotionDesc", "Reduce animations and transitions across the app.")}
                    </div>
                  </div>
                  <SettingsToggle
                    checked={accessibility.preferences.reducedMotion}
                    onChange={(checked: boolean) => {
                      accessibility.setReducedMotion(checked);
                      setAppearanceActionPhase("success");
                      setAppearanceActionMessage(checked ? "Reduced motion enabled." : "Reduced motion disabled.");
                    }}
                  />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-black/5 bg-black/5 p-4 dark:border-white/5 dark:bg-black/20">
                  <div className="flex flex-col gap-1">
                    <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {t("settings.appearance.contrastAssist", "Contrast Assist")}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t("settings.appearance.contrastAssistDesc", "Increase visual contrast for text and UI surfaces.")}
                    </div>
                  </div>
                  <SettingsToggle
                    checked={accessibility.preferences.contrastAssist}
                    onChange={(checked: boolean) => {
                      accessibility.setContrastAssist(checked);
                      setAppearanceActionPhase("success");
                      setAppearanceActionMessage(checked ? "Contrast assist enabled." : "Contrast assist disabled.");
                    }}
                  />
                </div>
              </div>
            </div>
            <SettingsActionStatus
              title="Appearance"
              phase={appearanceActionPhase}
              message={appearanceActionMessage || undefined}
              summary="Customize and reset appearance preferences."
            />
          </div>
        </Card>
      )}

      {activeTab === "updates" && (
        <Card title={t("settings.updates.title")} description={t("settings.updates.desc")} className="w-full">
          <div className="space-y-5">
            <div className="relative overflow-hidden rounded-2xl border border-black/5 bg-gradient-to-br from-zinc-50 via-white to-zinc-100 p-5 shadow-sm dark:border-white/10 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950">
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-500/10 blur-2xl dark:bg-violet-400/10" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Release Channel</div>
                  <h4 className="mt-2 text-base font-semibold text-zinc-700 dark:text-zinc-200">Update Status</h4>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                    Check latest stable releases and install updates when available.
                  </p>
                </div>
                <span className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                  APP_VERSION === "dev"
                    ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                )}>
                  {APP_VERSION === "dev" ? "development" : "stable"}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              <span className="text-sm font-medium">{t("settings.updates.currentVersion")}</span>
              <span className="rounded bg-zinc-200 px-2 py-0.5 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                v{APP_VERSION}
              </span>
            </div>
            <DesktopUpdater variant="inline" />
          </div>
        </Card>
      )}

      {activeTab === "identity" && (
        <div className="space-y-6">
          <ProfileSwitcherCard onBeforeSwitch={handleProfileSwitchLock} />
          <Card title={t("identity.title")} description={t("identity.description")} className="w-full">
            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-br from-zinc-50 to-white p-5 shadow-sm dark:border-white/10 dark:from-zinc-900/40 dark:to-zinc-950/20">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-black tracking-tight text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Account Identity</span>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none">Global Identification State</p>
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
                
                <div className="mt-6 grid gap-4 md:grid-cols-2">
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
                        className="w-full h-16 rounded-2xl border-2 border-dashed border-black/10 bg-transparent hover:bg-purple-500/5 hover:border-purple-500/40 group transition-all dark:border-white/10 dark:hover:bg-purple-500/10"
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

            <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/30 dark:bg-red-950/10 space-y-3">
              <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">{t("settings.dangerZone", "Danger Zone")}</h3>
              <p className="mt-1 text-xs text-red-700 dark:text-red-300 font-medium">
                {t("settings.deleteAccountDesc", "This will permanently remove your account key from this device and wipe your public profile.")}
              </p>
              <p className="mt-2 text-[10px] text-red-600/80 dark:text-red-400/80 leading-relaxed italic">
                Note on Decentralized Identity: Your cryptographic private key is a mathematical concept and cannot be "destroyed." While this action will overwrite your public profile with a "Deleted Account" status and erase all local data, anyone possessing the exact private key string could technically log in again.
              </p>
              <div className="space-y-2">
                <Label htmlFor="delete-confirm-input" className="text-xs text-red-900 dark:text-red-200">Type "{DELETE_ACCOUNT_CONFIRM_TEXT}" to continue</Label>
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
                    {t("settings.actions.clearData", "Clear All Local Data")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleArmDeleteAccount}
                    disabled={deleteAccountCountdown > 0}
                  >
                    {deleteAccountCountdown > 0 ? `Armed in ${deleteAccountCountdown}s` : "Arm Wipe Account"}
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
                {isPublishing ? "Wiping Profile & Deleting Data..." : t("settings.deleteAccount", "Wipe Profile & Delete Data")}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "notifications" && (
        <Card title={t("settings.notifications.title")} description={t("settings.notifications.desc")} className="w-full">
          <div className="space-y-3">
            <div className="text-sm text-zinc-700 dark:text-zinc-300">
              {t("settings.notifications.backgroundDesc")}
            </div>
            <div className="rounded-xl border border-black/5 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-900/50">
              <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                {t("settings.notifications.permission", "Permission")}: {notificationPreference.state.permission}
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {notificationPreference.state.permission === "granted"
                  ? t("settings.notifications.permissionGrantedDesc", "Permission granted. Notifications can be delivered.")
                  : notificationPreference.state.permission === "denied"
                    ? t("settings.notifications.permissionDeniedDesc", "Permission denied. Enable notifications from system/browser settings.")
                    : notificationPreference.state.permission === "default"
                      ? t("settings.notifications.permissionDefaultDesc", "Permission not decided yet. Click Enable Notifications to request access.")
                      : t("settings.notifications.permissionUnsupportedDesc", "This runtime does not support notifications.")}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={handleEnableNotifications}
              >
                {t("settings.notifications.enable")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleDisableNotifications}
              >
                {t("settings.notifications.disable")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleSendTestNotification}
              >
                {t("settings.notifications.test", "Send Test Notification")}
              </Button>
            </div>
            <div className="rounded-xl border border-black/5 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-900/50 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                    {t("settings.notifications.channel.dm", "Direct messages")}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t("settings.notifications.channel.dmDesc", "Notify when you receive a new DM.")}
                  </div>
                </div>
                <SettingsToggle
                  checked={notificationPreference.state.channels.dmMessages}
                  onChange={(checked) => handleToggleNotificationChannel("dmMessages", checked)}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                    {t("settings.notifications.channel.mentions", "Mentions and replies")}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t("settings.notifications.channel.mentionsDesc", "Notify when someone mentions or replies to you.")}
                  </div>
                </div>
                <SettingsToggle
                  checked={notificationPreference.state.channels.mentionsReplies}
                  onChange={(checked) => handleToggleNotificationChannel("mentionsReplies", checked)}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                    {t("settings.notifications.channel.invites", "Invites and system alerts")}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t("settings.notifications.channel.invitesDesc", "Notify for invites and important system notices.")}
                  </div>
                </div>
                <SettingsToggle
                  checked={notificationPreference.state.channels.invitesSystem}
                  onChange={(checked) => handleToggleNotificationChannel("invitesSystem", checked)}
                />
              </div>
            </div>
            <SettingsActionStatus
              title="Notification Setup"
              phase={notificationActionPhase}
              message={notificationActionMessage || undefined}
              summary={`Permission: ${notificationPreference.state.permission} · ${notificationPreference.state.enabled ? "enabled" : "disabled"}`}
            />
          </div>
        </Card>
      )}

      {activeTab === "relays" && (
        <Card title={t("settings.relays.title")} description={t("settings.relays.desc")} className="w-full">
          <div className="space-y-6">
            {/* API Status Panel */}
            <div className="space-y-4 rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-500">
                <Activity className="h-4 w-4 text-purple-500" />
                {t("settings.health.api", "API Status")}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-black/20 border border-black/5 dark:border-white/5 shadow-sm">
                <div className="space-y-1 overflow-hidden">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none">Endpoint</div>
                  <div className="text-xs font-mono text-zinc-600 dark:text-zinc-300 truncate">{getApiBaseUrl()}</div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCheckApi}
                  disabled={apiHealth.status === "checking"}
                  className="shrink-0"
                >
                  {apiHealth.status === "checking"
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : ENABLE_API_HEALTH_PROBE
                      ? t("settings.health.check", "Test Connection")
                      : "Show Advisory"}
                </Button>
              </div>

              <AnimatePresence mode="wait">
                {apiHealth.status === "disabled" && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs flex items-center gap-2 font-medium"
                  >
                    <Activity className="h-3 w-3" />
                    {apiHealth.message}
                  </motion.div>
                )}
                {apiHealth.status === "ok" && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 font-medium"
                  >
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Operational — Latency: {apiHealth.latencyMs}ms
                  </motion.div>
                )}
                {apiHealth.status === "error" && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 font-medium"
                  >
                    <ShieldAlert className="h-3 w-3" />
                    Connection Error: {apiHealth.message}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Relay Runtime Setup */}
            <div className="space-y-4 rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-white dark:bg-black/20">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Label className="font-semibold text-base">Relay Connectivity</Label>
                  <p className="text-xs text-zinc-500">
                    Basic mode uses optimized default relays. Active: {relayList.state.relays.filter((relay) => relay.enabled).length}/{relayList.state.relays.length}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={showAdvancedRelays ? "secondary" : "outline"}
                  onClick={() => setShowAdvancedRelays((prev) => !prev)}
                >
                  {showAdvancedRelays ? "Hide Advanced" : "Advanced Settings"}
                </Button>
              </div>

              <div className="rounded-xl border border-black/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-900/50">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="rounded-full bg-zinc-100 px-2 py-1 font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    Connected {relayQuickHealth.openCount}/{relayQuickHealth.enabledCount}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-1 font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    Avg Latency {typeof relayQuickHealth.averageLatencyMs === "number" ? `${relayQuickHealth.averageLatencyMs}ms` : "n/a"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">{relayQuickHealth.recommendation}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Presets</Label>
                <div className="flex flex-wrap gap-2">
                  {RELAY_PRESETS.map((preset) => (
                    <Button key={preset.id} type="button" size="sm" variant="outline" onClick={() => applyRelayPreset(preset.id)}>
                      {preset.label}
                    </Button>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => void handleRefreshRelayStatus()}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Refresh Status
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={handleResetRelaySection} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                    Reset Relay Section
                  </Button>
                </div>
              </div>

              <div
                className={cn(
                  "rounded-xl border p-4 transition-all duration-300",
                  relayRuntimeStatus.status === "healthy"
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300 shadow-[0_0_15px_-5px_rgba(16,185,129,0.1)]"
                    : relayRuntimeStatus.status === "recovering"
                      ? "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-300 shadow-[0_0_15px_-5px_rgba(14,165,233,0.1)]"
                    : relayRuntimeStatus.status === "degraded"
                      ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300 shadow-[0_0_15px_-5px_rgba(245,158,11,0.1)]"
                      : "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300 shadow-[0_0_15px_-5px_rgba(244,63,94,0.1)]"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-2.5 w-2.5 rounded-full shadow-sm animate-pulse",
                    relayRuntimeStatus.status === "healthy"
                      ? "bg-emerald-500"
                      : relayRuntimeStatus.status === "recovering"
                        ? "bg-sky-500"
                        : relayRuntimeStatus.status === "degraded"
                          ? "bg-amber-500"
                          : "bg-rose-500"
                  )} />
                  <div className="space-y-0.5">
                    <div className="text-sm font-bold">{relayRuntimeStatus.label}</div>
                    <div className="text-xs opacity-70 leading-normal">{relayRuntimeStatus.actionText}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Advanced Configuration */}
            <AnimatePresence>
              {showAdvancedRelays && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden space-y-6"
                >
                  <div className="space-y-4 rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div className="space-y-1">
                      <Label className="font-semibold text-base">Advanced Configuration</Label>
                      <p className="text-xs text-zinc-500">Manually add, sort, and enable specific relay nodes for maximum redundancy.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <Input
                        value={newRelayUrl}
                        onChange={(e) => setNewRelayUrl(e.target.value)}
                        placeholder="wss://relay.example.com"
                        className="bg-white dark:bg-black/20 border-black/5 dark:border-white/10"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddRelay();
                          }
                        }}
                      />
                      <div className="flex gap-2">
                        <Button type="button" onClick={handleAddRelay} className="whitespace-nowrap">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Node
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={handleResetRelaySection} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                          Reset
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      {relayList.state.relays.map((relay, index) => {
                        const connection = relayConnectionMap.get(relay.url);
                        const health = relayHealthMetricsMap.get(relay.url);
                        const derivedStatus = deriveRelayNodeStatus({
                          url: relay.url,
                          enabled: relay.enabled,
                          connection,
                          metrics: health,
                          isConfigured: true,
                          isFallback: relayRuntime.fallbackRelayUrls.includes(relay.url),
                          runtimePhase: relayRuntime.phase,
                          lastInboundEventAtUnixMs: relayRuntime.lastInboundEventAtUnixMs,
                        });

                        return (
                          <div
                            key={relay.url}
                            className="group flex items-center justify-between gap-4 rounded-2xl border border-black/10 dark:border-white/10 p-5 bg-white/60 backdrop-blur-md transition-all hover:bg-white/80 hover:shadow-md dark:bg-zinc-900/40 dark:hover:bg-zinc-900/60"
                          >
                            <div className="flex items-center gap-5 min-w-0">
                              <SettingsToggle
                                checked={relay.enabled}
                                onChange={(enabled: boolean) => relayList.setRelayEnabled({ url: relay.url, enabled })}
                              />
                              <div className="min-w-0 flex flex-col gap-1">
                                <p className={cn(
                                  "font-mono text-[11px] font-bold tracking-tight truncate transition-opacity", 
                                  !relay.enabled ? "text-zinc-400 opacity-60" : "text-zinc-900 dark:text-zinc-100"
                                )}>
                                  {relay.url}
                                </p>
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "h-1.5 w-1.5 rounded-full ring-2 ring-offset-1 ring-offset-transparent",
                                    derivedStatus.status === "healthy"
                                      ? "bg-emerald-500 ring-emerald-500/20"
                                      : derivedStatus.status === "recovering"
                                        ? "bg-sky-500 ring-sky-500/20"
                                        : derivedStatus.status === "degraded"
                                          ? "bg-amber-500 ring-amber-500/20"
                                          : "bg-rose-500 ring-rose-500/20"
                                  )} />
                                  <span className={cn(
                                    "text-[10px] font-black uppercase tracking-[0.2em] leading-none",
                                    derivedStatus.status === "healthy"
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : derivedStatus.status === "recovering"
                                        ? "text-sky-600 dark:text-sky-400"
                                        : derivedStatus.status === "degraded"
                                          ? "text-amber-600 dark:text-amber-400"
                                          : "text-rose-600 dark:text-rose-400"
                                  )}>
                                    {derivedStatus.badge}
                                  </span>
                                  <span className="rounded-md bg-black/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500 dark:bg-white/5 dark:text-zinc-400">
                                    {derivedStatus.roleLabel}
                                  </span>
                                </div>
                                <div className="mt-1 text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                                  {derivedStatus.detail}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-400">
                                  <span>Success {derivedStatus.successLabel}</span>
                                  <span>•</span>
                                  <span>{derivedStatus.confidenceLabel}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 p-0 rounded-xl bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 shadow-sm"
                                onClick={() => relayList.moveRelay({ url: relay.url, direction: "up" })}
                                disabled={index === 0}
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 p-0 rounded-xl bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 shadow-sm"
                                onClick={() => relayList.moveRelay({ url: relay.url, direction: "down" })}
                                disabled={index === relayList.state.relays.length - 1}
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                              <div className="w-1 h-4 border-r border-black/10 dark:border-white/10 mx-0.5" />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 p-0 rounded-xl bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 shadow-sm transition-colors"
                                onClick={() => relayList.removeRelay({ url: relay.url })}
                              >
                                <X className="h-4 w-4 font-black" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Performance Monitor (Also inside Advanced) */}
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-widest text-zinc-400">
                      <Wifi className="h-3.5 w-3.5" />
                      Network Performance Metrics
                    </div>
                    <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-zinc-50/30 dark:bg-black/10 p-2">
                      <RelayDashboard />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <SettingsActionStatus
              title="Relay Actions"
              phase={relayActionPhase}
              message={relayActionMessage || undefined}
              summary={`Connected ${relayQuickHealth.openCount}/${relayQuickHealth.enabledCount} enabled relays`}
            />
          </div>
        </Card>
      )}

      {activeTab === "blocklist" && (
        <Card title={t("settings.tabs.blocklist")} description={t("settings.blocklist.desc")} className="w-full">
          <div className="space-y-6">
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

            <div className="space-y-3 rounded-2xl border border-black/5 bg-zinc-50/50 p-4 dark:border-white/10 dark:bg-zinc-900/40">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Block by Public Key</Label>
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
                  className="h-10 px-8 font-bold text-white bg-gradient-primary border-none shadow-sm hover:shadow-md transition-all"
                >
                  Block
                </Button>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-black/5 bg-white/70 p-4 dark:border-white/10 dark:bg-black/20">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  {t("settings.blocklist.blockedUsers", "Blocked Users")} ({filteredBlockedKeys.length})
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={blocklistQuery}
                    onChange={(e) => setBlocklistQuery(e.target.value)}
                    placeholder="Search blocked keys..."
                    className="h-8 w-[180px] border-black/10 bg-white/90 text-xs dark:border-white/10 dark:bg-black/20"
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={handleUnblockAll} className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20">
                    Unblock All
                  </Button>
                </div>
              </div>
              {filteredBlockedKeys.length === 0 ? (
                <p className="rounded-xl border border-dashed border-black/10 p-6 text-center text-xs italic text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                  {t("settings.blocklist.empty", "No users blocked yet.")}
                </p>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredBlockedKeys.map((pubkey) => (
                    <div key={pubkey} className="group flex items-center justify-between gap-2 rounded-xl border border-black/5 bg-zinc-50/80 p-3 shadow-sm transition-all hover:border-zinc-300 hover:bg-white dark:border-white/10 dark:bg-zinc-900/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900">
                      <span className="font-mono text-[10px] truncate flex-1">{pubkey}</span>
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
            </div>
            <SettingsActionStatus
              title="Moderation Actions"
              phase={moderationActionPhase}
              message={moderationActionMessage || undefined}
              summary={`Blocked: ${blocklist.state.blockedPublicKeys.length} · Filtered: ${filteredBlockedKeys.length}`}
            />
          </div>
        </Card>
      )
      }

      {
        activeTab === "privacy" && (
          <div className="space-y-6">
            <TrustSettingsPanel />
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
                <SettingsActionStatus
                  title="Privacy Summary"
                  phase="idle"
                  summary={`DM policy: ${privacySettings.dmPrivacy} · Modern DMs: ${privacySettings.useModernDMs ? "enabled" : "disabled"}`}
                />
              </div>
            </Card>
          </div>
        )
      }

      {
        activeTab === "security" && (
          <div className="space-y-6">
            <Card title="Security Posture" description="Current protection status and capability checks." className="w-full">
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-black/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-900/50">
                  <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Overall posture</div>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    securityPosture === "strong" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                    securityPosture === "moderate" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                    securityPosture === "weak" && "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                  )}>
                    {securityPosture}
                  </span>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                    Clipboard: <span className="font-semibold">{securityCapabilityStates.clipboard}</span>
                  </div>
                  <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                    Biometric: <span className="font-semibold">{securityCapabilityStates.biometric}</span>
                  </div>
                  <div className="rounded-lg border border-black/5 p-3 text-xs dark:border-white/10">
                    Tor: <span className="font-semibold">{securityCapabilityStates.tor}</span>
                  </div>
                </div>
              </div>
            </Card>
            <PasswordResetPanel />
            <AutoLockSettingsPanel />
            <Card title="Session Management" description="Security settings for your current session." className="w-full">
              <div className="space-y-4">
                <Button
                  variant="secondary"
                  onClick={handleLockNow}
                >
                  Lock Now
                </Button>
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-900/20"
                  onClick={() => setIsClearDataDialogOpen(true)}
                >
                  {t("settings.actions.clearData", "Clear All Local Data")}
                </Button>
                <SettingsActionStatus
                  title="Security Actions"
                  phase={securityActionPhase}
                  message={securityActionMessage || undefined}
                  summary="Use Lock Now for immediate protection; clear local data only when needed."
                />
              </div>
            </Card>
          </div>
        )
      }

      {
        activeTab === "storage" && (
        <Card title={t("settings.tabs.storage")} description={t("settings.storage.desc")} className="w-full">
          <div className="space-y-8">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="space-y-1">
                <Label className="font-semibold text-base">Effective Mode</Label>
                <p className="text-xs text-zinc-500">Derived from active provider and local vault toggles.</p>
              </div>
              <span className={cn(
                "rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide",
                storageMode === "hybrid" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                storageMode === "nip96" && "bg-blue-500/15 text-blue-600 dark:text-blue-400",
                storageMode === "local_vault" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                storageMode === "disabled" && "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
              )}>
                {storageMode.replace("_", " ")}
              </span>
            </div>

              {/* Chat Performance Mode */}
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="space-y-1">
                  <Label className="font-semibold text-base">{t("settings.storage.performanceModeTitle", "Chat Performance Mode (Phase 1)")}</Label>
                  <p className="text-xs text-zinc-500">
                    {t("settings.storage.performanceModeDesc", "Enable batched chat updates and adaptive rendering for smoother scrolling on large chats.")}
                  </p>
                </div>
                <SettingsToggle
                  checked={privacySettings.chatPerformanceV2}
                  onChange={(checked) => handleSavePrivacy({ ...privacySettings, chatPerformanceV2: checked })}
                />
              </div>

              {/* v0.8.3 UX rollout */}
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="space-y-1">
                  <Label className="font-semibold text-base">{t("settings.storage.chatUxV083Title", "Media & Chat UX Refresh (v0.8.3)")}</Label>
                  <p className="text-xs text-zinc-500">
                    {t("settings.storage.chatUxV083Desc", "Enable the new media viewer and chat interaction polish. Disable to use the stable v0.8.2 UX path.")}
                  </p>
                </div>
                <SettingsToggle
                  checked={privacySettings.chatUxV083}
                  onChange={(checked) => handleSavePrivacy({ ...privacySettings, chatUxV083: checked })}
                />
              </div>

              {/* v0.8.7 reliability core rollout */}
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="space-y-1">
                  <Label className="font-semibold text-base">Reliability Core (v0.8.7)</Label>
                  <p className="text-xs text-zinc-500">
                    Adaptive relay scoring + quorum publishing, sync checkpoint/backfill controls, and storage resilience diagnostics.
                  </p>
                </div>
                <SettingsToggle
                  checked={privacySettings.reliabilityCoreV087}
                  onChange={(checked) => handleSavePrivacy({ ...privacySettings, reliabilityCoreV087: checked })}
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-2xl border border-blue-500/20 p-5 dark:border-blue-400/20 bg-blue-500/5">
                <div className="space-y-1">
                  <Label className="font-semibold text-base">Stability Mode (v0.9 recovery)</Label>
                  <p className="text-xs text-zinc-500">
                    Forces the safe Add Friend path (contact card/npub/pubkey) and hides unstable discovery UI.
                  </p>
                </div>
                <SettingsToggle
                  checked={privacySettings.stabilityModeV090}
                  onChange={(checked) => handleSavePrivacy({
                    ...privacySettings,
                    stabilityModeV090: checked,
                    deterministicDiscoveryV090: checked ? false : privacySettings.deterministicDiscoveryV090,
                  })}
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="space-y-1">
                  <Label className="font-semibold text-base">Deterministic Discovery (v0.9 Wave B)</Label>
                  <p className="text-xs text-zinc-500">
                    Resolver + request outbox experimental flow. Requires Rust protocol core and stability mode disabled.
                  </p>
                </div>
                <SettingsToggle
                  checked={privacySettings.deterministicDiscoveryV090}
                  onChange={(checked) => handleSavePrivacy({
                    ...privacySettings,
                    deterministicDiscoveryV090: checked,
                    stabilityModeV090: checked ? false : privacySettings.stabilityModeV090,
                  })}
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="space-y-1">
                  <Label className="font-semibold text-base">Rust Protocol Core (v0.9 Wave B)</Label>
                  <p className="text-xs text-zinc-500">
                    Enables runtime adapters backed by Rust protocol contracts for identity/session/outbox paths.
                  </p>
                </div>
                <SettingsToggle
                  checked={privacySettings.protocolCoreRustV090}
                  onChange={(checked) => handleSavePrivacy({
                    ...privacySettings,
                    protocolCoreRustV090: checked,
                    x3dhRatchetV090: checked ? privacySettings.x3dhRatchetV090 : false,
                    stabilityModeV090: checked ? false : privacySettings.stabilityModeV090,
                  })}
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="space-y-1">
                  <Label className="font-semibold text-base">X3DH + Ratchet (v0.9 Wave C)</Label>
                  <p className="text-xs text-zinc-500">
                    Enables the full rewritten E2EE handshake/session path. Keep off until Wave C gates pass.
                  </p>
                </div>
                <SettingsToggle
                  checked={privacySettings.x3dhRatchetV090}
                  onChange={(checked) => handleSavePrivacy({
                    ...privacySettings,
                    x3dhRatchetV090: checked,
                    protocolCoreRustV090: checked ? true : privacySettings.protocolCoreRustV090,
                    stabilityModeV090: checked ? false : privacySettings.stabilityModeV090,
                  })}
                />
              </div>

              <div className="rounded-2xl border border-black/5 p-5 dark:border-white/5 bg-white dark:bg-black/20 space-y-4">
                <div className="space-y-1">
                  <Label className="font-semibold text-base">Discovery Rollout Flags</Label>
                  <p className="text-xs text-zinc-500">
                    Guard incremental discovery lanes while keeping deterministic add as the canonical path.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-black/5 p-3 dark:border-white/10 bg-zinc-50/60 dark:bg-zinc-900/40">
                  <div>
                    <p className="text-sm font-semibold">Invite Code Lookup</p>
                    <p className="text-xs text-zinc-500">Allow `OBSCUR-*` code resolution in Add Friend.</p>
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
                    <p className="text-sm font-semibold">Deep-Link Contact Import</p>
                    <p className="text-xs text-zinc-500">Route `obscur://contact?...` links to deterministic Add Friend resolve.</p>
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
                    <p className="text-sm font-semibold">Local Friend Suggestions</p>
                    <p className="text-xs text-zinc-500">Show local-cache candidate suggestions on empty Add Friend search.</p>
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
                    <p className="text-sm font-semibold">TanStack Query Adapter (Phase 1)</p>
                    <p className="text-xs text-zinc-500">Enable guarded Query adapters for discovery, identity resolve, relay diagnostics, and account-sync readers.</p>
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
                        setStorageStatsTick((prev) => prev + 1);
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
                </div>

                <div className="rounded-xl border border-black/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-900/40">
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
                          setStorageStatsTick((prev) => prev + 1);
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
                      <Button
                        type="button"
                        variant="outline"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900/30"
                        onClick={async () => {
                          await purgeLocalMediaCache();
                          toast.success(t("settings.storage.cacheCleared", "Local media cache cleared."));
                          setStorageStatsTick((prev) => prev + 1);
                          setStorageActionPhase("success");
                          setStorageActionMessage("Local cache cleared.");
                          void refreshLocalMediaAbsolutePath();
                        }}
                      >
                        {t("settings.storage.clearCache", "Clear Local Cache")}
                      </Button>
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
        )
      }

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
        isOpen={isDeleteAccountDialogOpen}
        onClose={() => setIsDeleteAccountDialogOpen(false)}
        onConfirm={handleDeleteAccount}
        title={t("settings.dialogs.deleteAccountTitle", "Wipe Profile & Delete Account")}
        description={t("settings.dialogs.deleteAccountDesc", "Are you sure you want to completely erase your network profile and local data? This action will overwrite your public profile and remove your key from this device.")}
        confirmLabel={t("settings.actions.delete", "Wipe & Delete Account")}
        variant="danger"
      />
    </div >
  );
}


