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
import { TrustSettingsPanel } from "@/app/features/messaging/components/trust-settings-panel";
import { PasswordResetPanel } from "@/app/features/settings/components/password-reset-panel";
import { AutoLockSettingsPanel } from "@/app/features/settings/components/auto-lock-settings-panel";
import { useBlocklist } from "@/app/features/network/hooks/use-blocklist";
import type { Nip96Config } from "@/app/features/messaging/lib/nip96-upload-service";
import { STORAGE_KEY_NIP96 } from "@/app/features/messaging/lib/nip96-upload-service";
import { resolveNip05 } from "@/app/features/profile/utils/nip05-resolver";
import { PrivacySettingsService, type PrivacySettings } from "@/app/features/settings/services/privacy-settings-service";
import { invoke } from "@tauri-apps/api/core";
import { useUserInviteCode } from "@/app/features/invites/hooks/use-user-invite-code";
import { NATIVE_KEY_SENTINEL } from "@/app/features/crypto/crypto-service";
import {
  getLocalMediaStorageConfig,
  getLocalMediaStorageAbsolutePath,
  openLocalMediaStoragePath,
  pickLocalMediaStorageRootPath,
  purgeLocalMediaCache,
  saveLocalMediaStorageConfig,
  type LocalMediaStorageConfig
} from "@/app/features/vault/services/local-media-store";
import { useSearchParams } from "next/navigation";

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
  const { t } = useTranslation();
  const identity = useIdentity();
  const displayPublicKeyHex: string = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? "";
  const publicKeyHex: PublicKeyHex | null = (displayPublicKeyHex as PublicKeyHex | null) ?? null;
  const profile = useProfile();
  const notificationPreference = useNotificationPreference();
  const { publishProfile, isPublishing } = useProfilePublisher();
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
  const [isClearDataDialogOpen, setIsClearDataDialogOpen] = useState(false);
  const [isDeleteAccountDialogOpen, setIsDeleteAccountDialogOpen] = useState(false);

  const handleClearData = async () => {
    try {
      localStorage.clear();
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }
      if (typeof window !== "undefined") window.location.reload();
    } catch (e) {
      console.error(e);
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
    }
  };

  const handleRevealToggle = async () => {
    if (!isPrivateKeyVisible) {
      // If we have a native key, we might need biometrics/native challenge
      if (identity.state.privateKeyHex === NATIVE_KEY_SENTINEL) {
        try {
          const nsec = await invoke<string>("get_session_nsec");
          setNsecKey(nsec);
          setIsPrivateKeyVisible(true);
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

  const saveNip96Config = (newConfig: Nip96Config) => {
    setNip96Config(newConfig);
    localStorage.setItem(STORAGE_KEY_NIP96, JSON.stringify(newConfig));
  };

  const saveLocalMediaConfig = (newConfig: LocalMediaStorageConfig): void => {
    const normalized = saveLocalMediaStorageConfig(newConfig);
    setLocalMediaConfig(normalized);
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

  const handleSavePrivacy = (newSettings: PrivacySettings) => {
    setPrivacySettings(newSettings);
    PrivacySettingsService.saveSettings(newSettings);
  };

  const handleVerifyNip05 = async () => {
    const identifier = profile.state.profile.nip05;
    if (!identifier || !identifier.includes('@')) {
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

  const relayConnectionMap = useMemo(() => {
    return new Map(pool.connections.map((connection) => [connection.url, connection]));
  }, [pool.connections]);

  const relayRuntimeStatus = useMemo(() => {
    const totalCount = relayList.state.relays.filter((relay) => relay.enabled).length;
    const openCount = pool.connections.filter((connection) => connection.status === "open").length;
    return deriveRelayRuntimeStatus({ openCount, totalCount });
  }, [pool.connections, relayList.state.relays]);

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
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-username">{t("profile.usernameLabel")}</Label>
                <Input
                  id="profile-username"
                  value={profile.state.profile.username}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => profile.setUsername({ username: e.target.value })}
                  placeholder={t("profile.usernamePlaceholder")}
                />
                <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("profile.usernameHelp")}</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-nip05">{t("profile.nip05Label")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="profile-nip05"
                    value={profile.state.profile.nip05 || ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => profile.setNip05({ nip05: e.target.value })}
                    placeholder={t("profile.nip05Placeholder")}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleVerifyNip05}
                    disabled={isVerifyingNip05}
                  >
                    {isVerifyingNip05 ? <Loader2 className="h-4 w-4 animate-spin" /> : t("profile.verifyNip05")}
                  </Button>
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("profile.nip05Help")}</div>
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
                  onClick={async () => {
                    const success = await publishProfile({
                      username: profile.state.profile.username,
                      about: profile.state.profile.about,
                      avatarUrl: profile.state.profile.avatarUrl,
                      nip05: profile.state.profile.nip05,
                      inviteCode: profile.state.profile.inviteCode
                    });
                    if (success) {
                      profile.save();
                      toast.success(t("settings.profileSaved"));
                    } else {
                      toast.error(t("settings.profilePublishFailed"));
                    }
                  }}
                  disabled={isPublishing}
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
            </div>
          </Card>
        </div>
      )}

      {activeTab === "appearance" && (
        <Card title={t("settings.appearance.title")} description={t("settings.appearance.desc")} className="w-full">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("settings.language")}</Label>
              <LanguageSelector />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.appearance.theme")}</Label>
              <ThemeToggle />
            </div>
          </div>
        </Card>
      )}

      {activeTab === "updates" && (
        <Card title={t("settings.updates.title")} description={t("settings.updates.desc")} className="w-full">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <span className="text-sm font-medium">{t("settings.updates.currentVersion")}</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
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
            <div className="space-y-4">
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
                      >
                        <Lock className="mr-2 h-4 w-4 text-zinc-400 group-hover:text-purple-500" />
                        Reveal & Export Private Key
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

            <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/30 dark:bg-red-950/10">
              <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">{t("settings.dangerZone", "Danger Zone")}</h3>
              <p className="mt-1 text-xs text-red-700 dark:text-red-300 font-medium">
                {t("settings.deleteAccountDesc", "This will permanently remove your account key from this device and wipe your public profile.")}
              </p>
              <p className="mt-2 text-[10px] text-red-600/80 dark:text-red-400/80 leading-relaxed italic">
                Note on Decentralized Identity: Your cryptographic private key is a mathematical concept and cannot be "destroyed." While this action will overwrite your public profile with a "Deleted Account" status and erase all local data, anyone possessing the exact private key string could technically log in again.
              </p>
              <Button
                type="button"
                variant="danger"
                className="mt-4"
                disabled={isPublishing}
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
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={async () => {
                  const success = await requestNotificationPermission();
                  if (success) {
                    toast.success("Notifications enabled!");
                  } else {
                    toast.error("Permission denied");
                  }
                }}
              >
                {t("settings.notifications.enable")}
              </Button>
            </div>
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
                        <Button type="button" variant="ghost" size="sm" onClick={() => relayList.resetRelays()} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                          Reset
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      {relayList.state.relays.map((relay, index) => {
                        const connection = relayConnectionMap.get(relay.url);
                        const status = connection?.status ?? "connecting";
                        const isOpen = status === "open";
                        const isError = status === "error";

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
          </div>
        </Card>
      )}

      {activeTab === "blocklist" && (
        <Card title={t("settings.tabs.blocklist")} description={t("settings.blocklist.desc")} className="w-full">
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">{t("settings.blocklist.blockedUsers")} ({blocklist.state.blockedPublicKeys.length})</h4>
              {blocklist.state.blockedPublicKeys.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">{t("settings.blocklist.empty")}</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {blocklist.state.blockedPublicKeys.map((pubkey) => (
                    <div key={pubkey} className="flex items-center justify-between p-3 rounded-xl border border-black/5 bg-zinc-50 dark:bg-zinc-900/40 dark:border-white/5">
                      <span className="font-mono text-[10px] truncate flex-1">{pubkey}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => blocklist.removeBlocked({ publicKeyHex: pubkey as PublicKeyHex })}
                      >
                        Unblock
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      )
      }

      {
        activeTab === "privacy" && (
          <div className="space-y-6">
            <TrustSettingsPanel />
            <Card title={t("settings.privacy.global")} description={t("settings.privacy.globalDesc")} className="w-full">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-black/5 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/50">
                  <Label className="flex-1 font-medium">Enable Modern DMs (Gift Wraps)</Label>
                  <SettingsToggle
                    checked={privacySettings.useModernDMs}
                    onChange={(checked) => handleSavePrivacy({ ...privacySettings, useModernDMs: checked })}
                  />
                </div>
              </div>
            </Card>
          </div>
        )
      }

      {
        activeTab === "security" && (
          <div className="space-y-6">
            <PasswordResetPanel />
            <AutoLockSettingsPanel />
            <Card title="Session Management" description="Security settings for your current session." className="w-full">
              <div className="space-y-4">
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-900/20"
                  onClick={() => setIsClearDataDialogOpen(true)}
                >
                  {t("settings.actions.clearData", "Clear All Local Data")}
                </Button>
              </div>
            </Card>
          </div>
        )
      }

      {
        activeTab === "storage" && (
          <Card title={t("settings.tabs.storage")} description={t("settings.storage.desc")} className="w-full">
            <div className="space-y-8">

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
                        <Button type="button" variant="secondary" size="sm" onClick={() => void openLocalMediaStoragePath()}>
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
                          void refreshLocalMediaAbsolutePath();
                        }}
                      >
                        {t("settings.storage.clearCache", "Clear Local Cache")}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

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


