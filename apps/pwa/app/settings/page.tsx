"use client";

import type React from "react";
import { useMemo, useState, useEffect } from "react";
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
import { toast } from "@dweb/ui-kit";
import { DesktopUpdater } from "@/app/components/desktop-updater";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { LanguageSelector } from "@/app/components/language-selector";
import useNavBadges from "@/app/features/main-shell/hooks/use-nav-badges";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useProfile } from "@/app/features/profile/hooks/use-profile";
import { useNotificationPreference } from "@/app/features/notifications/hooks/use-notification-preference";
import { useProfilePublisher } from "@/app/features/profile/hooks/use-profile-publisher";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { deriveRelayRuntimeStatus } from "@/app/features/relays/lib/relay-runtime-status";
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
import { STORAGE_KEY_NIP96 } from "@/app/features/messaging/lib/nip96-upload-service";
import { resolveNip05 } from "@/app/features/profile/utils/nip05-resolver";
import { PrivacySettingsService, type PrivacySettings } from "@/app/features/settings/services/privacy-settings-service";
import { invoke } from "@tauri-apps/api/core";
import { useUserInviteCode } from "@/app/features/invites/hooks/use-user-invite-code";
import { NATIVE_KEY_SENTINEL } from "@/app/features/crypto/crypto-service";
import type { ProfilePublishPhase } from "@/app/features/profile/hooks/use-profile-publisher";
import { SettingsActionStatus, type SettingsActionPhase } from "@/app/features/settings/components/settings-action-status";
import {
  getLocalMediaStorageConfig,
  getLocalMediaIndexSnapshot,
  getLocalMediaStorageAbsolutePath,
  openLocalMediaStoragePath,
  pickLocalMediaStorageRootPath,
  purgeLocalMediaCache,
  saveLocalMediaStorageConfig,
  DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG,
  type LocalMediaStorageConfig
} from "@/app/features/vault/services/local-media-store";
import { useSearchParams } from "next/navigation";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";

const APP_VERSION: string = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

type ApiHealthState = Readonly<
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok"; latencyMs: number; timeIso: string; baseUrl: string }
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
  nip05Error?: string;
  avatarUrlError?: string;
  isValid: boolean;
}>;

const NIP05_IDENTIFIER_PATTERN = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const DEFAULT_APP_LANGUAGE = "en";
const DEFAULT_THEME_PREFERENCE = "system" as const;
const TEXT_SCALE_OPTIONS: ReadonlyArray<TextScale> = [90, 100, 110, 120];
const PRIVATE_KEY_REVEAL_WINDOW_MS = 20_000;
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

const validateProfileInput = (profile: Readonly<{ username: string; nip05?: string; avatarUrl?: string }>): ProfileValidationResult => {
  const username = profile.username.trim();
  const nip05 = (profile.nip05 ?? "").trim();
  const avatarUrl = (profile.avatarUrl ?? "").trim();

  let usernameError: string | undefined;
  let nip05Error: string | undefined;
  let avatarUrlError: string | undefined;

  if (username.length < 3) {
    usernameError = "Username must be at least 3 characters.";
  } else if (username.length > 48) {
    usernameError = "Username is too long (max 48 characters).";
  }

  if (nip05.length > 0 && !NIP05_IDENTIFIER_PATTERN.test(nip05)) {
    nip05Error = "NIP-05 must use name@domain.tld format.";
  }

  if (avatarUrl.length > 0) {
    try {
      const parsed = new URL(avatarUrl);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        avatarUrlError = "Avatar URL must start with http:// or https://.";
      }
    } catch {
      avatarUrlError = "Avatar URL is invalid.";
    }
  }

  return {
    usernameError,
    nip05Error,
    avatarUrlError,
    isValid: !usernameError && !nip05Error && !avatarUrlError,
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
          <aside className="hidden w-64 shrink-0 md:block">
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
                            "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all text-left",
                            active
                              ? "bg-zinc-100 border-black/5 text-zinc-900 shadow-sm dark:bg-zinc-900 dark:border-white/5 dark:text-zinc-100"
                              : "border-transparent text-zinc-600 hover:bg-black/5 hover:border-black/5 dark:text-zinc-400 dark:hover:bg-zinc-900/40 dark:hover:border-white/5"
                          )}
                        >
                          <Icon className={cn("h-4 w-4", active ? "text-purple-600 dark:text-purple-400" : "text-zinc-400")} />
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
                      <h3 className="px-1 text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">
                        {t(group.labelKey)}
                      </h3>
                      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white/50 backdrop-blur-sm dark:border-white/5 dark:bg-zinc-900/50">
                        {group.items.map((item, idx) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                setActiveTab(item.id as SettingsTabType);
                                setShowMobileMenu(false);
                              }}
                              className={cn(
                                "flex w-full items-center justify-between px-4 py-4 transition-colors hover:bg-black/5 dark:hover:bg-white/5",
                                idx < group.items.length - 1 && "border-b border-black/5 dark:border-white/5"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                                  <Icon className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                                </div>
                                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{t(item.labelKey)}</span>
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
                  <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-black/5 bg-white/80 p-4 backdrop-blur-md dark:border-white/5 dark:bg-black/80">
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
  const theme = useTheme();
  const accessibility = useAccessibilityPreferences();
  const displayPublicKeyHex: string = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? "";
  const publicKeyHex: PublicKeyHex | null = (displayPublicKeyHex as PublicKeyHex | null) ?? null;
  const profile = useProfile();
  const notificationPreference = useNotificationPreference();
  const { publishProfile, isPublishing, phase: profilePublishPhase, lastReport: profilePublishReport, error: profilePublishError } = useProfilePublisher();
  const { relayPool: pool, relayList } = useRelay();
  const blocklist = useBlocklist({ publicKeyHex });

  // Ensure we have an invite code generated
  useUserInviteCode({
    publicKeyHex,
    privateKeyHex: identity.state.privateKeyHex || null
  });

  const [apiHealth, setApiHealth] = useState<ApiHealthState>({ status: "idle" });
  const [newRelayUrl, setNewRelayUrl] = useState<string>("");
  const [showAdvancedRelays, setShowAdvancedRelays] = useState<boolean>(false);
  const [isVerifyingNip05, setIsVerifyingNip05] = useState(false);
  const [savedInviteCode, setSavedInviteCode] = useState<string>(profile.state.profile.inviteCode || "");
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>(() => PrivacySettingsService.getSettings());
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
  const [blocklistQuery, setBlocklistQuery] = useState<string>("");
  const [blocklistInput, setBlocklistInput] = useState<string>("");
  const [profilePreflightError, setProfilePreflightError] = useState<string | null>(null);
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
    const isTauriRuntime = typeof window !== "undefined" && "__TAURI_INTERNALS__" in (window as unknown as Record<string, unknown>);
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

  const profileValidation = useMemo(() => {
    return validateProfileInput({
      username: profile.state.profile.username,
      nip05: profile.state.profile.nip05,
      avatarUrl: profile.state.profile.avatarUrl
    });
  }, [profile.state.profile.username, profile.state.profile.nip05, profile.state.profile.avatarUrl]);

  useEffect(() => {
    if (profilePreflightError) {
      setProfilePreflightError(null);
    }
    // intentionally keyed to profile validation so field edits clear stale errors
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileValidation.isValid, profile.state.profile.username, profile.state.profile.nip05, profile.state.profile.avatarUrl]);

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
          try {
            const biometricOk = await invoke<boolean>("request_biometric_auth");
            if (!biometricOk) {
              toast.error("Native authentication failed.");
              return;
            }
          } catch {
            // If biometric command is unavailable, fallback to session access path.
          }
          const nsec = await invoke<string>("get_session_nsec");
          setNsecKey(nsec);
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
          keyToCopy = await invoke<string>("get_session_nsec");
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

  useEffect(() => {
    if (profile.state.profile.inviteCode && !savedInviteCode) {
      setSavedInviteCode(profile.state.profile.inviteCode);
    }
  }, [profile.state.profile.inviteCode, savedInviteCode]);

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
    if (typeof window === "undefined") return fallback;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_NIP96);
      if (stored) return JSON.parse(stored);
      if (window.location.hostname.includes("vercel.app") || "__TAURI__" in window) {
        return { apiUrl: "https://nostr.build/api/v2/upload/files", enabled: true };
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
  const [isCheckingProviderReachability, setIsCheckingProviderReachability] = useState<boolean>(false);
  const [providerReachabilityNote, setProviderReachabilityNote] = useState<string>("");

  const saveNip96Config = (newConfig: Nip96Config) => {
    setNip96Config(newConfig);
    localStorage.setItem(STORAGE_KEY_NIP96, JSON.stringify(newConfig));
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
  }, [activeTab]);

  const handleSavePrivacy = (newSettings: PrivacySettings) => {
    setPrivacySettings(newSettings);
    PrivacySettingsService.saveSettings(newSettings);
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

  const handleSendTestNotification = (): void => {
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

    showDesktopNotification({
      title: "Obscur test notification",
      body: "Notification delivery is working correctly.",
      tag: "obscur-settings-test"
    });
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

  const handleSaveAndPublishProfile = async (): Promise<void> => {
    setProfilePreflightError(null);
    if (!profileValidation.isValid) {
      const firstError = profileValidation.usernameError || profileValidation.nip05Error || profileValidation.avatarUrlError || "Please fix profile validation errors.";
      setProfilePreflightError(firstError);
      toast.error(firstError);
      return;
    }

    const success = await publishProfile({
      username: profile.state.profile.username.trim(),
      about: profile.state.profile.about,
      avatarUrl: profile.state.profile.avatarUrl?.trim(),
      nip05: profile.state.profile.nip05?.trim(),
      inviteCode: profile.state.profile.inviteCode
    });
    if (success) {
      profile.save();
      toast.success(t("settings.profileSaved"));
      return;
    }
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
    return deriveRelayRuntimeStatus({ openCount, totalCount });
  }, [pool.connections, relayList.state.relays]);

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

    let recommendation = "Connections look healthy.";
    if (enabledRelays.length === 0) {
      recommendation = "Enable at least one relay or apply a preset.";
    } else if (openCount === 0) {
      recommendation = "No active connections. Try High Redundancy preset.";
    } else if (openCount < enabledRelays.length) {
      recommendation = "Some relays are offline. Consider Default Stable preset.";
    } else if (typeof averageLatencyMs === "number" && averageLatencyMs > 1500) {
      recommendation = "Latency is high. Try Low Latency preset.";
    }

    return {
      openCount,
      enabledCount: enabledRelays.length,
      averageLatencyMs,
      recommendation,
    };
  }, [pool.connections, relayHealthMetricsMap, relayList.state.relays]);

  const storageMode = useMemo<StorageMode>(() => {
    return deriveStorageMode(nip96Config.enabled, localMediaConfig.enabled);
  }, [localMediaConfig.enabled, nip96Config.enabled]);

  const storageStats = useMemo<StorageStats>(() => deriveStorageStats(), [storageStatsTick]);

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
                <div className="flex items-center justify-between">
                  <Label htmlFor="profile-invite-code">{t("profile.inviteCodeLabel", "Personal Invite Code")}</Label>
                </div>
                <div className="relative">
                  <Input
                    id="profile-invite-code"
                    value={profile.state.profile.inviteCode || ""}
                    readOnly
                    className="pr-12"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    onClick={() => {
                      if (profile.state.profile.inviteCode) {
                        void navigator.clipboard.writeText(profile.state.profile.inviteCode);
                        toast.success(t("common.copied"));
                      }
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={handleSaveAndPublishProfile}
                  disabled={isPublishing || !profileValidation.isValid}
                >
                  {isPublishing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.publishing")}</> : t("settings.saveAndPublish")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    profile.revert();
                    toast.info(t("settings.changesReset"));
                  }}
                >
                  {t("profile.reset")}
                </Button>
              </div>
              <SettingsActionStatus
                title="Publish Status"
                phase={toSettingsActionPhase(profilePublishPhase)}
                message={
                  profilePreflightError
                    ? profilePreflightError
                    : profilePublishReport?.message
                    ? profilePublishReport.message
                    : profilePublishError
                      ? profilePublishError
                      : undefined
                }
                summary={
                  profilePublishReport?.phase === "success" && typeof profilePublishReport.successCount === "number" && typeof profilePublishReport.totalRelays === "number"
                    ? `Published to ${profilePublishReport.successCount}/${profilePublishReport.totalRelays} relays.`
                    : "Ready to publish your profile."
                }
              />
            </div>
          </Card>
        </div>
      )}

      {activeTab === "appearance" && (
        <Card title={t("settings.appearance.title")} description={t("settings.appearance.desc")} className="w-full">
          <div className="space-y-4">
            <div className="space-y-3 rounded-xl border border-black/5 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-900/50">
              <div className="flex items-center justify-between gap-3">
                <Label>{t("settings.language")}</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => void handleResetLanguage()}>
                  {t("settings.appearance.resetLanguage", "Reset")}
                </Button>
              </div>
              <LanguageSelector />
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {t("settings.appearance.currentLanguage", "Current language")}: {i18n.language}
              </div>
            </div>
            <div className="space-y-3 rounded-xl border border-black/5 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-900/50">
              <div className="flex items-center justify-between gap-3">
                <Label>{t("settings.appearance.theme")}</Label>
                <Button type="button" variant="ghost" size="sm" onClick={handleResetTheme}>
                  {t("settings.appearance.resetTheme", "Reset")}
                </Button>
              </div>
              <ThemeToggle />
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {t("settings.appearance.currentTheme", "Current theme preference")}: {theme.preference}
              </div>
            </div>
            <div className="space-y-3 rounded-xl border border-black/5 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-900/50">
              <div className="flex items-center justify-between gap-3">
                <Label>{t("settings.appearance.accessibility", "Accessibility")}</Label>
                <Button type="button" variant="ghost" size="sm" onClick={handleResetAccessibility}>
                  {t("settings.appearance.resetAccessibility", "Reset")}
                </Button>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t("settings.appearance.textScale", "Text Scale")}: {accessibility.preferences.textScale}%
                </div>
                <div className="flex flex-wrap gap-2">
                  {TEXT_SCALE_OPTIONS.map((scale) => (
                    <Button
                      key={scale}
                      type="button"
                      size="sm"
                      variant="secondary"
                      className={cn(accessibility.preferences.textScale === scale ? "border-black/20 bg-zinc-100 dark:border-white/20 dark:bg-zinc-800" : "")}
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
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-black/5 p-3 dark:border-white/10">
                <div>
                  <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    {t("settings.appearance.reducedMotion", "Reduced Motion")}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t("settings.appearance.reducedMotionDesc", "Reduce animations and transitions across the app.")}
                  </div>
                </div>
                <SettingsToggle
                  checked={accessibility.preferences.reducedMotion}
                  onChange={(checked) => {
                    accessibility.setReducedMotion(checked);
                    setAppearanceActionPhase("success");
                    setAppearanceActionMessage(checked ? "Reduced motion enabled." : "Reduced motion disabled.");
                  }}
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-black/5 p-3 dark:border-white/10">
                <div>
                  <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    {t("settings.appearance.contrastAssist", "Contrast Assist")}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t("settings.appearance.contrastAssistDesc", "Increase visual contrast for text and UI surfaces.")}
                  </div>
                </div>
                <SettingsToggle
                  checked={accessibility.preferences.contrastAssist}
                  onChange={(checked) => {
                    accessibility.setContrastAssist(checked);
                    setAppearanceActionPhase("success");
                    setAppearanceActionMessage(checked ? "Contrast assist enabled." : "Contrast assist disabled.");
                  }}
                />
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
                  <h4 className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">Update Status</h4>
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
          <Card title={t("identity.title")} description={t("identity.description")} className="w-full">
            <div className="space-y-6">
              <div className="rounded-xl border border-black/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-900/50">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Identity Overview</span>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    identityStorageMode === "native" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                    identityStorageMode === "encrypted_local" && "bg-blue-500/15 text-blue-600 dark:text-blue-400",
                    identityStorageMode === "session_only" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                    identityStorageMode === "unknown" && "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
                  )}>
                    {identityStorageMode.replace("_", " ")}
                  </span>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    identityIntegrityState === "ok" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                    identityIntegrityState === "mismatch" && "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                    identityIntegrityState === "unknown" && "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
                  )}>
                    integrity {identityIntegrityState}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="profile-pubkey">{t("identity.publicKeyHex")}</Label>
                    <div className="flex gap-2">
                      <Input id="profile-pubkey" value={displayPublicKeyHex} readOnly className="font-mono text-xs flex-1" />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={(): void => {
                          void navigator.clipboard.writeText(displayPublicKeyHex);
                          toast.success(t("common.copied"));
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        {t("common.copy")}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Public Key (npub)</Label>
                    <div className="flex gap-2">
                      <Input value={npubValue} readOnly className="font-mono text-xs flex-1" />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={(): void => {
                          void navigator.clipboard.writeText(npubValue);
                          toast.success(t("common.copied"));
                        }}
                        disabled={!npubValue}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        {t("common.copy")}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <details className="rounded-xl border border-black/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-900/50">
                <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                  Identity Diagnostics (Advanced)
                </summary>
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">Stored: {identity.state.stored?.publicKeyHex || "-"}</div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">Derived: {derivedPublicKeyHex || "-"}</div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">Native session: {identityDiagnostics?.nativeSessionPublicKeyHex || "-"}</div>
                  {identityDiagnostics?.message ? (
                    <div className="text-xs text-rose-600 dark:text-rose-400">{identityDiagnostics.message}</div>
                  ) : (
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">What this means: mismatches usually indicate key/session inconsistency and should be resolved before export.</div>
                  )}
                </div>
              </details>

              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2">
                  <Label htmlFor="profile-nsec" className="text-sm font-bold uppercase tracking-wider text-zinc-500">{t("identity.privateKey")}</Label>
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
                        className="w-full h-14 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-500/5 group"
                        onClick={handleRevealToggle}
                        disabled={identityIntegrityState === "mismatch"}
                      >
                        <Lock className="mr-2 h-4 w-4 text-zinc-400 group-hover:text-purple-500" />
                        Reveal Private Key (20s)
                      </Button>
                    </motion.div>
                  ) : isChallenging ? (
                    <motion.div
                      key="challenging"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4"
                    >
                      <div className="flex items-center gap-3">
                        <Shield className="h-5 w-5 text-purple-500" />
                        <span className="text-sm font-bold">Authentication Required</span>
                      </div>
                      <p className="text-xs text-zinc-500">Please enter your master password to reveal your secret key.</p>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          placeholder="Master Password"
                          value={challangePassword}
                          onChange={(e) => setChallengePassword(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleVerifyChallenge()}
                          autoFocus
                          className="h-10 text-sm"
                        />
                        <Button size="sm" onClick={handleVerifyChallenge}>Unlock</Button>
                        <Button variant="ghost" size="sm" onClick={() => setIsChallenging(false)}>Cancel</Button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="revealed"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="space-y-4"
                    >
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="profile-nsec"
                            type="text"
                            value={nsecKey || "Loading..."}
                            readOnly
                            className="font-mono text-xs pr-10 h-12 bg-white/50 dark:bg-zinc-900/50 border-purple-500/30"
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
                  {apiHealth.status === "checking" ? <Loader2 className="h-3 w-3 animate-spin" /> : t("settings.health.check", "Test Connection")}
                </Button>
              </div>

              <AnimatePresence mode="wait">
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
                    : relayRuntimeStatus.status === "degraded"
                      ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300 shadow-[0_0_15px_-5px_rgba(245,158,11,0.1)]"
                      : "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300 shadow-[0_0_15px_-5px_rgba(244,63,94,0.1)]"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-2.5 w-2.5 rounded-full shadow-sm animate-pulse",
                    relayRuntimeStatus.status === "healthy" ? "bg-emerald-500" : relayRuntimeStatus.status === "degraded" ? "bg-amber-500" : "bg-rose-500"
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
                        const status = connection?.status ?? "connecting";
                        const isOpen = status === "open";
                        const isError = status === "error";
                        const hintType = classifyRelayFailureHint(connection?.errorMessage ?? health?.lastError);
                        const hintText = hintType === "timeout"
                          ? "Timeout, retrying."
                          : hintType === "network"
                            ? "Network unreachable."
                            : hintType === "tls"
                              ? "TLS/handshake issue."
                              : hintType === "rate_limited"
                                ? "Rate-limited by relay."
                                : "Unknown error.";

                        return (
                          <div
                            key={relay.url}
                            className="group flex items-center justify-between gap-4 rounded-xl border border-black/5 dark:border-white/5 p-4 bg-white dark:bg-black/40 transition-all hover:shadow-sm"
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <SettingsToggle
                                checked={relay.enabled}
                                onChange={(enabled) => relayList.setRelayEnabled({ url: relay.url, enabled })}
                              />
                              <div className="min-w-0 space-y-1">
                                <p className={cn("font-mono text-xs truncate transition-opacity", !relay.enabled && "opacity-40")}>
                                  {relay.url}
                                </p>
                                <div className="flex items-center gap-1.5 ring-0">
                                  <div className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    isOpen ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : isError ? "bg-rose-500" : "bg-zinc-400"
                                  )} />
                                  <span className={cn(
                                    "text-[10px] font-bold uppercase tracking-widest leading-none",
                                    isOpen ? "text-emerald-600/80 dark:text-emerald-400/80" : isError ? "text-rose-600/80 dark:text-rose-400/80" : "text-zinc-500/80"
                                  )}>
                                    {status}
                                  </span>
                                </div>
                                {isError && (
                                  <div className="text-[10px] text-rose-600/90 dark:text-rose-300/90">{hintText}</div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => relayList.moveRelay({ url: relay.url, direction: "up" })}
                                disabled={index === 0}
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => relayList.moveRelay({ url: relay.url, direction: "down" })}
                                disabled={index === relayList.state.relays.length - 1}
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                onClick={() => relayList.removeRelay({ url: relay.url })}
                              >
                                <X className="h-3.5 w-3.5" />
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
            <div className="relative overflow-hidden rounded-2xl border border-black/5 bg-gradient-to-br from-zinc-50 via-white to-zinc-100 p-5 shadow-sm dark:border-white/10 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950">
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-indigo-500/10 blur-2xl dark:bg-indigo-400/10" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Moderation Overview</div>
                  <h4 className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">Blocklist Control Center</h4>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                    Blocked users cannot send messages or invites to you.
                  </p>
                </div>
                <div className="rounded-xl border border-black/5 bg-white/70 p-2 dark:border-white/10 dark:bg-black/20">
                  <ShieldAlert className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  Blocked users: {blocklist.state.blockedPublicKeys.length}
                </span>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  Filtered: {filteredBlockedKeys.length}
                </span>
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
                <Button type="button" onClick={handleAddBlockedKey} className="h-10 px-5 font-semibold">Block</Button>
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
                <div className="relative overflow-hidden rounded-2xl border border-black/5 bg-gradient-to-br from-zinc-50 via-white to-zinc-100 p-5 shadow-sm dark:border-white/10 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950">
                  <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-500/10 blur-2xl dark:bg-cyan-400/10" />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Privacy Policy</div>
                      <h4 className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">Direct Message Policy</h4>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
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
                            const selected = await pickLocalMediaStorageRootPath();
                            if (!selected) return;
                            saveLocalMediaConfig({ ...localMediaConfig, customRootPath: selected });
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


