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
  LogOut
} from "lucide-react";
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
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";
import { useRelayList } from "@/app/features/relays/hooks/use-relay-list";
import { useRelayPool } from "@/app/features/relays/hooks/use-relay-pool";
import type { RelayConnection } from "@/app/features/relays/utils/relay-connection";
import { ThemeToggle } from "../components/theme-toggle";
import { useHorizontalScroll } from "@/app/features/messaging/hooks/use-horizontal-scroll";
import useNavBadges from "@/app/features/main-shell/hooks/use-nav-badges";
import { useNotificationPreference } from "@/app/features/notifications/hooks/use-notification-preference";
import { requestNotificationPermission } from "@/app/features/notifications/utils/request-notification-permission";
import { getApiBaseUrl } from "@/app/features/relays/utils/api-base-url";
import { useProfile } from "@/app/features/profile/hooks/use-profile";
import { useProfilePublisher } from "@/app/features/profile/hooks/use-profile-publisher";
import { DesktopUpdater } from "../components/desktop-updater";
import { KeyboardShortcutsHelp } from "../components/desktop/keyboard-shortcuts-help";
import { ShareInviteCard } from "../components/share-invite-card";
import { LanguageSelector } from "../components/language-selector";
import { useTranslation } from "react-i18next";
import { TrustSettingsPanel } from "../features/messaging/components/trust-settings-panel";
import { AutoLockSettingsPanel } from "../features/settings/components/auto-lock-settings-panel";
import { STORAGE_KEY_NIP96, Nip96Config } from "@/app/features/messaging/lib/nip96-upload-service";
import { AvatarUpload } from "../components/avatar-upload";
import { resolveNip05 } from "@/app/features/profile/utils/nip05-resolver";
import { PrivacySettingsService, type PrivacySettings } from "@/app/features/settings/services/privacy-settings-service";

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
  const relayList = useRelayList({ publicKeyHex });
  const blocklist = useBlocklist({ publicKeyHex });
  const enabledRelayUrls: ReadonlyArray<string> = useMemo((): ReadonlyArray<string> => {
    return relayList.state.relays
      .filter((relay: Readonly<{ url: string; enabled: boolean }>): boolean => relay.enabled)
      .map((relay: Readonly<{ url: string; enabled: boolean }>): string => relay.url);
  }, [relayList.state.relays]);
  const pool = useRelayPool(enabledRelayUrls);
  const [newRelayUrl, setNewRelayUrl] = useState<string>("");
  const [apiHealth, setApiHealth] = useState<ApiHealthState>({ status: "idle" });
  const [activeTab, setActiveTab] = useState<SettingsTabType>("profile");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isVerifyingNip05, setIsVerifyingNip05] = useState(false);
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>(() => PrivacySettingsService.getSettings());
  const [nip96Config, setNip96Config] = useState<Nip96Config>(() => {
    const fallback: Nip96Config = { apiUrl: "", enabled: false };
    if (typeof window === "undefined") {
      return fallback;
    }
    try {
      const stored: string | null = localStorage.getItem(STORAGE_KEY_NIP96);
      if (!stored) {
        return fallback;
      }
      const parsed: unknown = JSON.parse(stored);
      if (!parsed || typeof parsed !== "object") {
        return fallback;
      }
      const record = parsed as Readonly<Record<string, unknown>>;
      const apiUrl: unknown = record.apiUrl;
      const enabled: unknown = record.enabled;
      return {
        apiUrl: typeof apiUrl === "string" ? apiUrl : "",
        enabled: typeof enabled === "boolean" ? enabled : false,
      };
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
    } catch (error) {
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

  const relayCounts = useMemo((): Readonly<Record<RelayConnectionStatus, number>> => {
    const base: Record<RelayConnectionStatus, number> = { connecting: 0, open: 0, error: 0, closed: 0 };
    Object.values(relayStatusByUrl).forEach((status: RelayConnectionStatus): void => {
      base[status] += 1;
    });
    return base;
  }, [relayStatusByUrl]);

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
  const canAddRelay: boolean = validatedRelayUrl !== null;

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
                            className="items-start"
                          />
                          <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("profile.avatarHelp")}</div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="profile-nip05">{t("profile.nip05Label", "NIP-05 Identifier")}</Label>
                          <div className="flex gap-2">
                            <Input
                              id="profile-nip05"
                              value={profile.state.profile.nip05 || ""}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => profile.setNip05({ nip05: e.target.value })}
                              placeholder="name@domain.tld"
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={handleVerifyNip05}
                              disabled={isVerifyingNip05 || !profile.state.profile.nip05}
                            >
                              {isVerifyingNip05 ? <Loader2 className="h-4 w-4 animate-spin" /> : t("profile.verifyNip05", "Verify")}
                            </Button>
                          </div>
                          <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("profile.nip05Help", "Connect your identity to a domain.")}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            onClick={async () => {
                              const success = await publishProfile({
                                username: profile.state.profile.username,
                                avatarUrl: profile.state.profile.avatarUrl,
                                nip05: profile.state.profile.nip05
                              });
                              if (success) {
                                toast.success(t("settings.profileSaved", "Profile published to network!"));
                              } else {
                                toast.error(t("settings.profilePublishFailed", "Failed to publish. Check relay connections."));
                              }
                            }}
                            disabled={isPublishing}
                          >
                            {isPublishing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.publishing", "Publishing...")}</> : t("settings.saveAndPublish", "Save & Publish")}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              profile.reset();
                              toast.info(t("settings.changesReset", "Changes reset"));
                            }}
                          >
                            {t("profile.reset")}
                          </Button>
                        </div>
                        <div className="mt-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                          <p className="font-semibold mb-1">Tip: Ghost Account?</p>
                          <p>If others can't find you, click <strong>Save & Publish</strong> to broadcast your profile to all connected relays.</p>
                        </div>
                      </div>
                    </Card>
                    <ShareInviteCard />
                  </div>
                )}

                {activeTab === "health" && (
                  <Card title={t("settings.health.title")} description={t("settings.health.desc")} className="w-full">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{t("settings.health.api")}</div>
                        <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("settings.health.baseUrl")} {getApiBaseUrl()}</div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="button" variant="secondary" onClick={handleCheckApi} disabled={apiHealth.status === "checking"}>
                            {apiHealth.status === "checking" ? t("settings.health.checking") : t("settings.health.check")}
                          </Button>
                          {apiHealth.status === "ok" ? (
                            <div className="text-sm text-emerald-700 dark:text-emerald-300">
                              OK ({apiHealth.latencyMs}ms)
                            </div>
                          ) : apiHealth.status === "error" ? (
                            <div className="text-sm text-red-700 dark:text-red-300">{t("settings.health.error")}: {apiHealth.message}</div>
                          ) : (
                            <div className="text-sm text-zinc-600 dark:text-zinc-400">{t("settings.health.notChecked")}</div>
                          )}
                        </div>
                        {apiHealth.status === "ok" ? (
                          <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("settings.health.serverTime")} {apiHealth.timeIso}</div>
                        ) : null}
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm font-medium">{t("settings.health.identity")}</div>
                        <div className="text-sm text-zinc-700 dark:text-zinc-300">
                          {identity.state.status === "unlocked" ? "Unlocked" : identity.state.status === "locked" ? "Locked" : identity.state.status}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm font-medium">{t("settings.health.relays")}</div>
                        <div className="text-sm text-zinc-700 dark:text-zinc-300">
                          {t("settings.health.open")}: <span className={getRelayStatusClassName("open")}>{relayCounts.open}</span>, {t("settings.health.connecting")}:{" "}
                          <span className={getRelayStatusClassName("connecting")}>{relayCounts.connecting}</span>, {t("settings.health.error")}:{" "}
                          <span className={getRelayStatusClassName("error")}>{relayCounts.error}</span>, {t("settings.health.closed")}:{" "}
                          <span className={getRelayStatusClassName("closed")}>{relayCounts.closed}</span>
                        </div>
                        {enabledRelayUrls.length === 0 ? <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("settings.health.noRelays")}</div> : null}
                      </div>
                    </div>
                  </Card>
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
                          <Label htmlFor="profile-pubkey">{t("identity.publicKeyHex") || "Public Key (Hex)"}</Label>
                          <Input id="profile-pubkey" value={displayPublicKeyHex} readOnly className="font-mono text-xs" />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={(): void => {
                                void navigator.clipboard.writeText(displayPublicKeyHex);
                                toast.success(t("common.copied", "Copied to clipboard"));
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
                              {t("common.disconnect", "Disconnect")}
                            </Button>
                          </div>
                          <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("messaging.nip04Desc")}</div>
                        </div>
                      </div>
                    </Card>

                    <Card title={t("settings.dangerZone", "Danger Zone")} tone="danger" className="mt-8 border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/10">
                      <div className="space-y-4">
                        <div className="flex items-start gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                            <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                          </div>
                          <div className="space-y-1">
                            <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">{t("settings.deleteAccount", "Delete Account")}</h3>
                            <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                              {t("settings.deleteAccountDesc", "This will permanently remove your account key from this device and reset all local data. This action cannot be undone.")}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="danger"
                          className="w-full sm:w-auto px-8"
                          onClick={() => setIsDeleteDialogOpen(true)}
                        >
                          {t("settings.deleteAccount", "Delete Account & Reset Data")}
                        </Button>
                      </div>

                      <ConfirmDialog
                        isOpen={isDeleteDialogOpen}
                        onClose={() => setIsDeleteDialogOpen(false)}
                        onConfirm={async () => {
                          await identity.forgetIdentity();
                          localStorage.clear();
                          toast.success(t("settings.accountDeleted", "Account deleted successfully"));
                          setTimeout(() => {
                            window.location.href = "/";
                          }, 1000);
                        }}
                        title={t("settings.deleteAccountConfirmTitle", "Delete Account?")}
                        description={t("settings.deleteAccountConfirm", "Are you sure you want to delete your account and reset all data? This cannot be undone.")}
                        confirmLabel={t("settings.deleteConfirm", "Yes, delete everything")}
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
                        <div className="space-y-2">
                          <Label htmlFor="relay-url">{t("settings.relays.addRelay")}</Label>
                          <div className="flex gap-2">
                            <Input
                              id="relay-url"
                              value={newRelayUrl}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRelayUrl(e.target.value)}
                              placeholder="wss://relay.example.com"
                            />
                            <Button
                              type="button"
                              disabled={!canAddRelay}
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
                          {!canAddRelay && trimmedRelayUrl.length > 0 ? (
                            <div className="text-xs text-red-600 dark:text-red-400">{t("settings.relays.invalidUrl")}</div>
                          ) : (
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("settings.relays.supportOnlyWss")}</div>
                          )}
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
                            relayList.state.relays.map((relay, index: number) => {
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
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      onClick={() => relayList.setRelayEnabled({ url: relay.url, enabled: !relay.enabled })}
                                    >
                                      {relay.enabled ? t("settings.relays.disable") : t("settings.relays.enable")}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      disabled={index === 0}
                                      onClick={() => relayList.moveRelay({ url: relay.url, direction: "up" })}
                                    >
                                      {t("settings.relays.up")}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      disabled={index === relayList.state.relays.length - 1}
                                      onClick={() => relayList.moveRelay({ url: relay.url, direction: "down" })}
                                    >
                                      {t("settings.relays.down")}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="secondary"
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

                        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                          <Button
                            type="button"
                            variant="secondary"
                            className="w-full sm:w-auto"
                            onClick={() => {
                              relayList.resetRelays();
                              toast.success(t("settings.relays.resetSuccess", "Relays reset to defaults"));
                            }}
                          >
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            {t("settings.relays.resetToDefaults", "Reset to Recommended Relays")}
                          </Button>
                          <p className="mt-2 text-[10px] text-zinc-500">
                            {t("settings.relays.resetHelp", "Use this if you are having trouble connecting or finding users.")}
                          </p>
                        </div>
                      </div>
                    )}
                  </Card>
                )}


                {activeTab === "blocklist" && (
                  <Card title={t("settings.tabs.blocklist", "Blocklist")} description={t("settings.blocklist.desc", "Managing blocked users. You won't receive messages from anyone on this list.")} className="w-full">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="block-pubkey">{t("settings.blocklist.addLabel", "Block a Public Key")}</Label>
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
                                  toast.success(t("settings.blocklist.added", "User blocked"));
                                }
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">{t("settings.blocklist.blockedUsers", "Blocked Users")} ({blocklist.state.blockedPublicKeys.length})</h4>
                        {blocklist.state.blockedPublicKeys.length === 0 ? (
                          <p className="text-xs text-zinc-500 italic">{t("settings.blocklist.empty", "No users blocked yet.")}</p>
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
                                    toast.info(t("settings.blocklist.removed", "User unblocked"));
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


                <Card title="Privacy & Trust" description="Manage who you trust and who can reach you directly." className="w-full">
                  <div className="mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
                    <Label className="text-sm font-semibold mb-3 block">Direct Message Privacy</Label>
                    <div className="flex flex-col gap-2">
                      <p className="text-xs text-zinc-500 mb-2">Control who can send you direct messages.</p>
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
                          Everyone
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
                          Contacts Only
                        </button>
                      </div>
                      {privacySettings.dmPrivacy === 'contacts-only' && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-1 flex items-center gap-1">
                          <ShieldAlert className="h-3 w-3" />
                          Stranger messages will be filtered out.
                        </p>
                      )}
                    </div>
                  </div>
                  <TrustSettingsPanel />
                </Card>

                {activeTab === "security" && (
                  <div className="max-w-3xl w-full">
                    <AutoLockSettingsPanel />
                  </div>
                )}

                {activeTab === "storage" && (
                  <Card title="File Storage" description="Configure where your file attachments are uploaded." className="w-full">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-xl border border-black/10 bg-zinc-50 dark:border-white/10 dark:bg-zinc-950/60">
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium">External Storage (NIP-96)</div>
                          <div className="text-xs text-zinc-500">Upload files directly to a Nostr storage provider.</div>
                        </div>
                        <Button
                          variant={nip96Config.enabled ? "primary" : "secondary"}
                          onClick={() => saveNip96Config({ ...nip96Config, enabled: !nip96Config.enabled })}
                        >
                          {nip96Config.enabled ? "Enabled" : "Disabled"}
                        </Button>
                      </div>

                      {nip96Config.enabled && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="space-y-2">
                            <Label htmlFor="nip96-url">NIP-96 API URL</Label>
                            <Input
                              id="nip96-url"
                              placeholder="https://nostr.build/api/v2/upload/files"
                              value={nip96Config.apiUrl}
                              onChange={(e) => saveNip96Config({ ...nip96Config, apiUrl: e.target.value })}
                            />
                            <p className="text-[10px] text-zinc-500">
                              The endpoint where files will be POSTed. Requires NIP-98 support for auth.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs font-semibold">Recommended Providers</Label>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { name: "nostr.build", url: "https://nostr.build/api/v2/upload/files" },
                                { name: "void.cat", url: "https://void.cat/api/v1/nip96" },
                                { name: "pixel.fed", url: "https://pixel.fed/api/v1/media" },
                                { name: "sovbit", url: "https://sovbit.host/api/v2/upload/files" }
                              ].map((provider) => (
                                <Button
                                  key={provider.name}
                                  variant="secondary"
                                  size="sm"
                                  className={cn(
                                    "text-[10px] h-7 px-2",
                                    nip96Config.apiUrl === provider.url && "border-purple-500 bg-purple-500/5 text-purple-600"
                                  )}
                                  onClick={() => saveNip96Config({ ...nip96Config, apiUrl: provider.url })}
                                >
                                  {provider.name}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {!nip96Config.enabled && (
                        <div className="space-y-3">
                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                            <p className="font-bold mb-1 flex items-center gap-1">
                              <ShieldAlert className="h-3 w-3" />
                              Local Upload Limitations
                            </p>
                            Currently using <strong>Local API</strong>. On serverless platforms like Vercel, local file uploads are <strong>permanently disabled</strong> because there is no persistent disk.
                            <br /><br />
                            <strong>Solution:</strong> Enable <i>External Storage (NIP-96)</i> above and select a provider like <u>nostr.build</u> to enable file sharing in this browser.
                          </div>
                          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-700 dark:text-blue-400">
                            <strong>Desktop User?</strong> The desktop version will soon support true local persistence. For now, we recommend using a NIP-96 provider for the best experience across all devices.
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </main>
        </div>
      </div >
    </PageShell >
  );
}
