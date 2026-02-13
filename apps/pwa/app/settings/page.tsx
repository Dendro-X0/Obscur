"use client";

import type React from "react";
import { useMemo, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  User,
  Shield,
  Network,
  Palette,
  Lock,
  Database,
  EyeOff,
  RefreshCcw,
  Activity,
  Bell,
  ShieldAlert,
  Loader2,
  Trash2,
  LogOut,
  Wifi,
  Copy
} from "lucide-react";
import { RelayDashboard } from "../components/relay-dashboard";
import { Button } from "../components/ui/button";
import { toast } from "../components/ui/toast";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { Card } from "../components/ui/card";
import { EmptyState } from "../components/ui/empty-state";
import { PageShell } from "../components/page-shell";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { cn } from "@/app/lib/utils";
import { validateRelayUrl } from "@/app/features/relays/utils/validate-relay-url";
import { useBlocklist } from "@/app/features/contacts/hooks/use-blocklist";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
// unused import removed
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import type { RelayConnection } from "@/app/features/relays/utils/relay-connection";
import { ThemeToggle } from "../components/theme-toggle";
// unused import removed
import useNavBadges from "@/app/features/main-shell/hooks/use-nav-badges";
import { useNotificationPreference } from "@/app/features/notifications/hooks/use-notification-preference";
import { requestNotificationPermission } from "@/app/features/notifications/utils/request-notification-permission";
import { getApiBaseUrl } from "@/app/features/relays/utils/api-base-url";
import { useProfile } from "@/app/features/profile/hooks/use-profile";
import { useProfilePublisher } from "@/app/features/profile/hooks/use-profile-publisher";
import { DesktopUpdater } from "../components/desktop-updater";
// unused import removed
import { ShareInviteCard } from "../components/share-invite-card";
import { LanguageSelector } from "../components/language-selector";
import { useTranslation } from "react-i18next";
import { TrustSettingsPanel } from "../features/messaging/components/trust-settings-panel";
import { AutoLockSettingsPanel } from "../features/settings/components/auto-lock-settings-panel";
import { STORAGE_KEY_NIP96, Nip96Config } from "@/app/features/messaging/lib/nip96-upload-service";
import packageJson from "@/package.json";
import { RECOMMENDED_STORAGE_PROVIDERS } from "@/app/features/messaging/lib/storage-providers";
import { Check, Info } from "lucide-react";
import { AvatarUpload } from "../components/avatar-upload";
import { resolveNip05 } from "@/app/features/profile/utils/nip05-resolver";
import { PrivacySettingsService, type PrivacySettings } from "@/app/features/settings/services/privacy-settings-service";
import { invoke } from "@tauri-apps/api/core";
import { useUserInviteCode } from "@/app/features/invites/hooks/use-user-invite-code";

type RelayConnectionStatus = "connecting" | "open" | "error" | "closed";

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
  | "updates"
  | "health";

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
      { id: "health", labelKey: "settings.tabs.health", icon: Activity },
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

const getRelayStatusClassName = (status: RelayConnectionStatus): string => {
  if (status === "open") {
    return "text-emerald-700 dark:text-emerald-300";
  }
  if (status === "connecting") {
    return "text-amber-700 dark:text-amber-300";
  }
  return "text-red-700 dark:text-red-300";
};

export default function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation();
  const identity = useIdentity();
  const displayPublicKeyHex: string = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? "";
  const publicKeyHex: PublicKeyHex | null = (displayPublicKeyHex as PublicKeyHex | null) ?? null;
  const navBadges = useNavBadges({ publicKeyHex });
  const profile = useProfile();
  const notificationPreference = useNotificationPreference();
  const { publishProfile, isPublishing } = useProfilePublisher();
  const { relayList, relayPool: pool } = useRelay();
  const blocklist = useBlocklist({ publicKeyHex });

  // Ensure we have an invite code generated
  useUserInviteCode({
    publicKeyHex,
    privateKeyHex: identity.state.privateKeyHex || null
  });

  const [newRelayUrl, setNewRelayUrl] = useState<string>("");
  const [apiHealth, setApiHealth] = useState<ApiHealthState>({ status: "idle" });
  const [activeTab, setActiveTab] = useState<SettingsTabType>("profile");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isVerifyingNip05, setIsVerifyingNip05] = useState(false);
  const [savedInviteCode, setSavedInviteCode] = useState<string>(profile.state.profile.inviteCode || "");
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>(() => PrivacySettingsService.getSettings());
  const [nip96Config, setNip96Config] = useState<Nip96Config>(() => {
    const fallback: Nip96Config = { apiUrl: "", enabled: false };
    if (typeof window === "undefined") {
      return fallback;
    }
    try {
      const stored: string | null = localStorage.getItem(STORAGE_KEY_NIP96);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          const record = parsed as Readonly<Record<string, unknown>>;
          const apiUrl: unknown = record.apiUrl;
          const enabled: unknown = record.enabled;
          return {
            apiUrl: typeof apiUrl === "string" ? apiUrl : "",
            enabled: typeof enabled === "boolean" ? enabled : false,
          };
        }
      }

      // Auto-enable on Vercel or Tauri (Desktop)
      if (typeof window !== "undefined" && (window.location.hostname.includes("vercel.app") || "__TAURI__" in window)) {
        return {
          apiUrl: "https://nostr.build/api/v2/upload/files",
          enabled: true
        };
      }

      return fallback;
    } catch {
      return fallback;
    }
  });

  const saveNip96Config = (newConfig: Nip96Config) => {
    setNip96Config(newConfig);
    localStorage.setItem(STORAGE_KEY_NIP96, JSON.stringify(newConfig));
  };

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

  const relayStatusByUrl = useMemo((): Readonly<Record<string, RelayConnectionStatus>> => {
    const result: Record<string, RelayConnectionStatus> = {};
    pool.connections.forEach((connection: RelayConnection): void => {
      result[connection.url] = connection.status;
    });
    return result;
  }, [pool.connections]);



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
        const data: unknown = await response.json();
        if (!data || typeof data !== "object") {
          setApiHealth({ status: "error", message: "Invalid JSON response", baseUrl });
          return;
        }
        const timeIso: unknown = (data as Readonly<Record<string, unknown>>).timeIso;
        if (typeof timeIso !== "string") {
          setApiHealth({ status: "error", message: "Missing timeIso", baseUrl });
          return;
        }
        setApiHealth({ status: "ok", latencyMs, timeIso, baseUrl });
      })
      .catch((error: unknown): void => {
        const baseUrlForError: string = baseUrl;
        const message: string = error instanceof Error ? error.message : "Unknown error";
        setApiHealth({ status: "error", message, baseUrl: baseUrlForError });
      });
  };

  const trimmedRelayUrl: string = newRelayUrl.trim();
  const validatedRelayUrl: Readonly<{ normalizedUrl: string }> | null = validateRelayUrl(trimmedRelayUrl);


  const canEnableNotifications: boolean = notificationPreference.state.permission !== "denied";

  return (
    <PageShell
      title={t("settings.title")}
      navBadgeCounts={navBadges.navBadgeCounts}
    >
      <div className="mx-auto w-full max-w-6xl p-4">
        <div className="flex flex-col gap-8 md:flex-row">
          {/* Sidebar Navigation */}
          <aside className="w-full shrink-0 md:w-64">
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
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all text-left",
                            active
                              ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                              : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900/40"
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

          {/* Main Content Area */}
          <main className="min-w-0 flex-1">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 gap-4">
                {activeTab === "profile" && (
                  <div className="space-y-4">
                    <Card title={t("profile.title")} description={t("profile.description")} className="w-full">
                      <div id="profile" className="space-y-3">
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
                        <div className="space-y-4">
                          <Label className="text-sm font-semibold">{t("profile.avatarLabel")}</Label>
                          <AvatarUpload
                            currentAvatarUrl={profile.state.profile.avatarUrl}
                            onUploadSuccess={(url) => profile.setAvatarUrl({ avatarUrl: url })}
                            onClear={() => profile.setAvatarUrl({ avatarUrl: "" })}
                            className="items-start"
                          />
                          <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("profile.avatarHelp")}</div>
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
                              disabled={isVerifyingNip05 || !profile.state.profile.nip05}
                            >
                              {isVerifyingNip05 ? <Loader2 className="h-4 w-4 animate-spin" /> : t("profile.verifyNip05")}
                            </Button>
                          </div>
                          <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("profile.nip05Help")}</div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="profile-invite-code">{t("profile.inviteCodeLabel", "Personal Invite Code")}</Label>
                            {profile.state.profile.inviteCode !== savedInviteCode ? (
                              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-[9px] font-black uppercase tracking-tighter text-amber-600 dark:text-amber-500 border border-amber-500/20 animate-pulse">
                                <ShieldAlert className="h-3 w-3" />
                                {t("profile.unsavedChanges", "Unsaved Changes")}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-[9px] font-black uppercase tracking-tighter text-emerald-600 dark:text-emerald-500 border border-emerald-500/20">
                                <Check className="h-3 w-3" />
                                {t("profile.searchable", "Active & Searchable")}
                              </div>
                            )}
                          </div>
                          <div className="relative">
                            <Input
                              id="profile-invite-code"
                              value={profile.state.profile.inviteCode || ""}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const val = e.target.value.toUpperCase();
                                if (val.length <= 13) { // OBSCUR- + 6 chars
                                  profile.setInviteCode({ inviteCode: val });
                                }
                              }}
                              placeholder="OBSCUR-XXXXXX"
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
                              disabled={!profile.state.profile.inviteCode}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="text-xs text-zinc-600 dark:text-zinc-400">
                            {t("profile.inviteCodeHelp", "Share this code with others so they can find you. Format: OBSCUR-XXXXXX")}
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
                                setSavedInviteCode(profile.state.profile.inviteCode);
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
                              profile.reset();
                              toast.info(t("settings.changesReset"));
                            }}
                          >
                            {t("profile.reset")}
                          </Button>
                        </div>
                        <div className="mt-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                          <p className="font-semibold mb-1">{t("profile.ghostAccountTip")}</p>
                          <p>{t("profile.ghostAccountDesc")}</p>
                        </div>
                      </div>
                    </Card>
                    <ShareInviteCard />
                  </div>
                )}

                {activeTab === "health" && (
                  <div className="space-y-6">
                    <Card title={t("settings.health.title")} description={t("settings.health.desc")} className="w-full">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="text-sm font-semibold flex items-center gap-2">
                            <Activity className="h-4 w-4 text-purple-500" />
                            {t("settings.health.api")}
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-black/5 dark:border-white/5">
                            <div className="space-y-0.5">
                              <div className="text-xs font-mono opacity-60 truncate max-w-[250px]">{getApiBaseUrl()}</div>
                              {apiHealth.status === "ok" ? (
                                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                  Server Connected ({apiHealth.latencyMs}ms)
                                </div>
                              ) : apiHealth.status === "error" ? (
                                <div className="text-sm font-bold text-red-600 dark:text-red-400">Connection Failed</div>
                              ) : (
                                <div className="text-sm font-bold opacity-40">Not Checked</div>
                              )}
                            </div>
                            <Button type="button" variant="secondary" size="sm" onClick={handleCheckApi} disabled={apiHealth.status === "checking"}>
                              {apiHealth.status === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check Health"}
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm font-semibold flex items-center gap-2">
                            <Shield className="h-4 w-4 text-blue-500" />
                            {t("settings.health.identity")}
                          </div>
                          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-black/5 dark:border-white/5">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "h-2 w-2 rounded-full",
                                identity.state.status === "unlocked" ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                              )} />
                              <span className="text-sm font-bold">
                                {identity.state.status === "unlocked" ? "Securely Initialized" : "Locked / Unavailable"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>

                    <div className="space-y-2">
                      <div className="px-1 text-sm font-bold flex items-center gap-2 opacity-60">
                        <Wifi className="h-4 w-4" />
                        Relay Performance Monitor
                      </div>
                      <RelayDashboard />
                    </div>
                  </div>
                )}

                {activeTab === "appearance" && (
                  <Card title={t("settings.appearance.title")} description={t("settings.appearance.desc")} className="w-full">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>{t("settings.language")}</Label>
                        <LanguageSelector />
                        <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("settings.selectLanguageDesc")}</div>
                      </div>
                      <div className="space-y-2">
                        <Label>{t("settings.appearance.theme")}</Label>
                        <ThemeToggle />
                        <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("settings.appearance.themeDesc")}</div>
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
                          v{packageJson.version}
                        </span>
                      </div>
                      <DesktopUpdater />
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">
                        {t("settings.updates.help")}
                      </div>
                    </div>
                  </Card>
                )}

                {activeTab === "identity" && (
                  <>
                    <Card title={t("identity.title")} description={t("identity.description")} className="w-full">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="profile-pubkey">{t("identity.publicKeyHex")}</Label>
                          <Input id="profile-pubkey" value={displayPublicKeyHex} readOnly className="font-mono text-xs" />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={(): void => {
                                void navigator.clipboard.writeText(displayPublicKeyHex);
                                toast.success(t("common.copied"));
                              }}
                              disabled={!displayPublicKeyHex}
                            >
                              {t("common.copy")}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              onClick={() => setIsDeleteDialogOpen(true)}
                            >
                              <LogOut className="mr-2 h-4 w-4" />
                              {t("common.disconnect")}
                            </Button>
                          </div>
                          <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("messaging.nip04Desc")}</div>
                        </div>
                      </div>
                    </Card>

                    <Card title={t("settings.dangerZone")} tone="danger" className="mt-8 border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/10">
                      <div className="space-y-4">
                        <div className="flex items-start gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                            <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                          </div>
                          <div className="space-y-1">
                            <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">{t("settings.deleteAccount")}</h3>
                            <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                              {t("settings.deleteAccountDesc")}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="danger"
                          className="w-full sm:w-auto px-8"
                          onClick={() => setIsDeleteDialogOpen(true)}
                        >
                          {t("settings.deleteAccountFull")}
                        </Button>
                      </div>

                      <ConfirmDialog
                        isOpen={isDeleteDialogOpen}
                        onClose={() => setIsDeleteDialogOpen(false)}
                        onConfirm={async () => {
                          await identity.forgetIdentity();
                          localStorage.clear();
                          toast.success(t("settings.accountDeleted"));

                          // Check if running in Tauri (Desktop/Mobile)
                          if (typeof window !== "undefined" && "__TAURI__" in window) {
                            try {
                              await invoke("restart_app");
                            } catch (e) {
                              console.error("Failed to restart app:", e);
                              // Fallback to reload if restart fails
                              window.location.reload();
                            }
                          } else {
                            setTimeout(() => {
                              window.location.href = "/";
                            }, 1000);
                          }
                        }}
                        title={t("settings.deleteAccountConfirmTitle")}
                        description={t("settings.deleteAccountConfirm")}
                        confirmLabel={t("settings.deleteConfirm")}
                        variant="danger"
                      />
                    </Card>
                  </>
                )}

                {activeTab === "notifications" && (
                  <Card title={t("settings.notifications.title")} description={t("settings.notifications.desc")} className="w-full">
                    <div className="space-y-3">
                      <div className="text-sm text-zinc-700 dark:text-zinc-300">
                        {notificationPreference.state.permission === "unsupported"
                          ? t("settings.notifications.unsupported")
                          : notificationPreference.state.permission === "denied"
                            ? t("settings.notifications.blocked")
                            : t("settings.notifications.backgroundDesc")}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          disabled={!canEnableNotifications}
                          onClick={() => {
                            void requestNotificationPermission().then((result): void => {
                              if (result.permission !== "granted") {
                                notificationPreference.setEnabled({ enabled: false });
                                return;
                              }
                              notificationPreference.setEnabled({ enabled: true });
                            });
                          }}
                        >
                          {t("settings.notifications.enable")}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => notificationPreference.setEnabled({ enabled: false })}
                        >
                          {t("settings.notifications.disable")}
                        </Button>
                      </div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">
                        {t("settings.notifications.status")}: {notificationPreference.state.enabled ? t("settings.notifications.enabled") : t("settings.notifications.disabled")} · {t("settings.notifications.permission")}: {notificationPreference.state.permission}
                      </div>
                    </div>
                  </Card>
                )}

                {activeTab === "relays" && (
                  <Card title={t("settings.relays.title")} description={t("settings.relays.desc")} className="w-full">
                    {identity.state.status === "loading" ? (
                      <div className="p-4 text-sm text-zinc-500">{t("common.loading")}</div>
                    ) : !displayPublicKeyHex ? (
                      <div className="text-sm text-zinc-700 dark:text-zinc-300">{t("settings.relays.unlockToManage")}</div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-2 opacity-60">
                          <Label htmlFor="relay-url">{t("settings.relays.addRelay")}</Label>
                          <div className="flex gap-2">
                            <Input
                              id="relay-url"
                              value={newRelayUrl}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRelayUrl(e.target.value)}
                              placeholder="wss://relay.example.com"
                              disabled={true}
                            />
                            <Button
                              type="button"
                              disabled={true}
                              onClick={() => {
                                if (validatedRelayUrl) {
                                  relayList.addRelay({ url: validatedRelayUrl.normalizedUrl });
                                }
                                setNewRelayUrl("");
                              }}
                            >
                              {t("settings.relays.add")}
                            </Button>
                          </div>
                          <div className="text-[10px] text-amber-600 dark:text-amber-500 font-medium">
                            {t("settings.relays.disabledForStabilization", "Custom relay editing is disabled for v0.7 stabilization.")}
                          </div>
                        </div>

                        <ul className="space-y-2">
                          {relayList.state.relays.length === 0 ? (
                            <div className="py-4">
                              <EmptyState
                                type="relays"
                                title={t("settings.relays.noRelaysTitle")}
                                description={t("settings.relays.noRelaysDesc")}
                                className="min-h-[200px]"
                              />
                            </div>
                          ) : (
                            relayList.state.relays.map((relay) => {
                              const status: RelayConnectionStatus = relayStatusByUrl[relay.url] ?? "closed";
                              return (
                                <li
                                  key={relay.url}
                                  className="rounded-xl border border-black/10 bg-zinc-50 px-3 py-2 dark:border-white/10 dark:bg-zinc-950/60"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="min-w-0 flex-1 truncate text-xs font-mono">{relay.url}</span>
                                    <span className={cn("shrink-0 text-xs font-medium", getRelayStatusClassName(status))}>{status}</span>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2 opacity-50">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      disabled={true}
                                      onClick={() => relayList.setRelayEnabled({ url: relay.url, enabled: !relay.enabled })}
                                    >
                                      {relay.enabled ? t("settings.relays.disable") : t("settings.relays.enable")}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      disabled={true}
                                      onClick={() => relayList.moveRelay({ url: relay.url, direction: "up" })}
                                    >
                                      {t("settings.relays.up")}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      disabled={true}
                                      onClick={() => relayList.moveRelay({ url: relay.url, direction: "down" })}
                                    >
                                      {t("settings.relays.down")}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      disabled={true}
                                      onClick={() => relayList.removeRelay({ url: relay.url })}
                                    >
                                      {t("settings.relays.remove")}
                                    </Button>
                                  </div>
                                </li>
                              );
                            })
                          )}
                        </ul>
                        <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("settings.relays.metadataWarning")}</div>

                        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 opacity-60">
                          <Button
                            type="button"
                            variant="secondary"
                            className="w-full sm:w-auto"
                            disabled={true}
                            onClick={() => {
                              relayList.resetRelays();
                              toast.success(t("settings.relays.resetSuccess"));
                            }}
                          >
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            {t("settings.relays.resetToDefaults")}
                          </Button>
                          <p className="mt-2 text-[10px] text-zinc-500 italic">
                            {t("settings.relays.disabledForStabilization", "Custom relay editing is disabled for v0.7 stabilization.")}
                          </p>
                        </div>
                      </div>
                    )}
                  </Card>
                )}


                {activeTab === "blocklist" && (
                  <Card title={t("settings.tabs.blocklist")} description={t("settings.blocklist.desc")} className="w-full">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="block-pubkey">{t("settings.blocklist.addLabel")}</Label>
                        <div className="flex gap-2">
                          <Input
                            id="block-pubkey"
                            placeholder="npub... or hex"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = (e.target as HTMLInputElement).value;
                                if (val) {
                                  blocklist.addBlocked({ publicKeyInput: val });
                                  (e.target as HTMLInputElement).value = "";
                                  toast.success(t("settings.blocklist.added"));
                                }
                              }
                            }}
                          />
                        </div>
                      </div>

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
                                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                  onClick={() => {
                                    blocklist.removeBlocked({ publicKeyHex: pubkey });
                                    toast.info(t("settings.blocklist.removed"));
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                )}


                <Card title={t("settings.tabs.privacyTrust")} description={t("settings.tabs.privacyTrustDesc")} className="w-full">
                  <div className="mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
                    <Label className="text-sm font-semibold mb-3 block">{t("groups.directMessagePrivacy")}</Label>
                    <div className="flex flex-col gap-2">
                      <p className="text-xs text-zinc-500 mb-2">{t("settings.dmPrivacy.desc")}</p>
                      <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl w-fit">
                        <button
                          onClick={() => handleSavePrivacy({ ...privacySettings, dmPrivacy: 'everyone' })}
                          className={cn(
                            "px-4 py-1.5 rounded-lg text-xs font-medium transition-all",
                            privacySettings.dmPrivacy === 'everyone'
                              ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm"
                              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                          )}
                        >
                          {t("settings.dmPrivacy.everyone")}
                        </button>
                        <button
                          onClick={() => handleSavePrivacy({ ...privacySettings, dmPrivacy: 'contacts-only' })}
                          className={cn(
                            "px-4 py-1.5 rounded-lg text-xs font-medium transition-all",
                            privacySettings.dmPrivacy === 'contacts-only'
                              ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm"
                              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                          )}
                        >
                          {t("settings.dmPrivacy.contactsOnly")}
                        </button>
                      </div>
                      {privacySettings.dmPrivacy === 'contacts-only' && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-1 flex items-center gap-1">
                          <ShieldAlert className="h-3 w-3" />
                          {t("settings.dmPrivacy.filterNote")}
                        </p>
                      )}
                    </div>
                  </div>
                  <TrustSettingsPanel />
                </Card>

                {activeTab === "security" && (
                  <div className="max-w-3xl w-full space-y-6">
                    <AutoLockSettingsPanel />
                    <Card title="Data & Cache" description="Manage your local data and session cache." className="w-full">
                      <div className="space-y-4">
                        <div className="flex items-start gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <Database className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                          </div>
                          <div className="space-y-1">
                            <h3 className="text-sm font-semibold">Clear Local Cache</h3>
                            <p className="text-xs text-zinc-500 leading-relaxed">
                              This will wipe your local message cache and temporary icons. Your identity (private key) will remain safe.
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            // Clear everything except identity keys
                            const nsec = localStorage.getItem('obscur_nsec');
                            const salt = localStorage.getItem('obscur_salt');
                            const iv = localStorage.getItem('obscur_iv');
                            const hint = localStorage.getItem('obscur_hint');

                            localStorage.clear();

                            if (nsec) localStorage.setItem('obscur_nsec', nsec);
                            if (salt) localStorage.setItem('obscur_salt', salt);
                            if (iv) localStorage.setItem('obscur_iv', iv);
                            if (hint) localStorage.setItem('obscur_hint', hint);

                            toast.success("Cache cleared. Reloading...");
                            setTimeout(() => window.location.reload(), 1500);
                          }}
                        >
                          Clear Cache & Reload
                        </Button>
                      </div>
                    </Card>
                  </div>
                )}

                {activeTab === "storage" && (
                  <Card title={t("settings.tabs.storageTitle")} description={t("settings.tabs.storageDesc")} className="w-full">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-xl border border-black/10 bg-zinc-50 dark:border-white/10 dark:bg-zinc-950/60 opacity-60">
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium">{t("settings.storage.externalTitle")}</div>
                          <div className="text-xs text-zinc-500">{t("settings.storage.externalDesc")}</div>
                        </div>
                        <Button
                          variant={nip96Config.enabled ? "primary" : "secondary"}
                          disabled={true}
                          onClick={() => saveNip96Config({ ...nip96Config, enabled: !nip96Config.enabled })}
                        >
                          {nip96Config.enabled ? t("settings.storage.enabled") : t("settings.storage.disabled")}
                        </Button>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2 opacity-60">
                          <Label htmlFor="nip96-url">{t("settings.storage.apiUrlLabel")}</Label>
                          <Input
                            id="nip96-url"
                            placeholder="https://nostr.build/api/v2/upload/files"
                            value={nip96Config.apiUrl}
                            disabled={true}
                            onChange={(e) => saveNip96Config({ ...nip96Config, apiUrl: e.target.value })}
                          />
                          <p className="text-[10px] text-amber-600 dark:text-amber-500 font-medium">
                            {t("settings.storage.disabledForStabilization", "Custom storage editing is disabled for v0.7 stabilization.")}
                          </p>
                        </div>

                        <div className="space-y-3 opacity-60">
                          <Label className="text-xs font-semibold flex items-center gap-1.5">
                            <Check className="h-3 w-3 text-emerald-500" />
                            {t("settings.storage.recommended")}
                          </Label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {RECOMMENDED_STORAGE_PROVIDERS.map((provider) => (
                              <button
                                key={provider.name}
                                type="button"
                                disabled={true}
                                onClick={() => {
                                  saveNip96Config({ apiUrl: provider.url, enabled: true });
                                  toast.success(`${provider.name} selected and enabled`);
                                }}
                                className={cn(
                                  "text-left p-3 rounded-xl border transition-all cursor-not-allowed",
                                  nip96Config.apiUrl === provider.url
                                    ? "border-purple-500 bg-purple-500/5 ring-1 ring-purple-500/20"
                                    : "border-black/5 dark:border-white/5 bg-white dark:bg-zinc-900/40"
                                )}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-bold">{provider.name}</span>
                                  {provider.maxSize && (
                                    <span className="text-[9px] font-medium text-zinc-500 uppercase px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-white/10">
                                      {provider.maxSize}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">
                                  {provider.description}
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {!nip96Config.enabled && (
                          <div className="space-y-3 pt-2">
                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                              <p className="font-bold mb-1 flex items-center gap-1">
                                <ShieldAlert className="h-3 w-3" />
                                {t("settings.storage.localMode")}
                              </p>
                              {t("settings.storage.localModeDesc")}
                            </div>
                          </div>
                        )}

                        <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest">
                            <Info className="h-3.5 w-3.5" />
                            {t("settings.storage.guidance")}
                          </div>
                          <ul className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-2 list-disc pl-4">
                            <li>{t("settings.storage.guidanceWhy")}</li>
                            <li>{t("settings.storage.guidancePrivacy")}</li>
                            <li>{t("settings.storage.guidanceCapacity")}</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </main>
        </div >
      </div >
    </PageShell >
  );
}
