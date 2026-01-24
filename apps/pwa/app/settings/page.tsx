"use client";

import type React from "react";
import { useMemo, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { EmptyState } from "../components/ui/empty-state";
import { PageShell } from "../components/page-shell";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { cn } from "../lib/cn";
import { validateRelayUrl } from "../lib/validate-relay-url";
import { useBlocklist } from "../lib/use-blocklist";
import { useIdentity } from "../lib/use-identity";
import { parsePublicKeyInput } from "../lib/parse-public-key-input";
import { useRelayList } from "../lib/use-relay-list";
import { useRelayPool } from "../lib/use-relay-pool";
import type { RelayConnection } from "../lib/relay-connection";
import { ThemeToggle } from "../components/theme-toggle";
import { useHorizontalScroll } from "../lib/use-horizontal-scroll";
import useNavBadges from "../lib/use-nav-badges";
import { useNotificationPreference } from "../lib/notifications/use-notification-preference";
import { requestNotificationPermission } from "../lib/notifications/request-notification-permission";
import { getApiBaseUrl } from "../lib/api-base-url";
import { useProfile } from "../lib/use-profile";
import { DesktopUpdater } from "../components/desktop-updater";
import { KeyboardShortcutsHelp } from "../components/desktop/keyboard-shortcuts-help";
import { ShareInviteCard } from "../components/share-invite-card";
import { LanguageSelector } from "../components/language-selector";
import { useTranslation } from "react-i18next";
import { TrustSettingsPanel } from "../features/messaging/components/trust-settings-panel";

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
  | "updates"
  | "health";

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
  const relayList = useRelayList({ publicKeyHex });
  const blocklist = useBlocklist({ publicKeyHex });
  const enabledRelayUrls: ReadonlyArray<string> = useMemo((): ReadonlyArray<string> => {
    return relayList.state.relays
      .filter((relay: Readonly<{ url: string; enabled: boolean }>): boolean => relay.enabled)
      .map((relay: Readonly<{ url: string; enabled: boolean }>): string => relay.url);
  }, [relayList.state.relays]);
  const pool = useRelayPool(enabledRelayUrls);
  const [newRelayUrl, setNewRelayUrl] = useState<string>("");
  const [newBlockedPubkey, setNewBlockedPubkey] = useState<string>("");
  const [apiHealth, setApiHealth] = useState<ApiHealthState>({ status: "idle" });
  const [activeTab, setActiveTab] = useState<SettingsTabType>("profile");
  const tabRef = useHorizontalScroll<HTMLDivElement>();

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

  const trimmedBlockedPubkey: string = newBlockedPubkey.trim();
  const parsedBlocked = parsePublicKeyInput(trimmedBlockedPubkey);
  const canAddBlocked: boolean = parsedBlocked.ok;

  const canEnableNotifications: boolean = notificationPreference.state.permission !== "denied";

  return (
    <PageShell
      title={t("settings.title")}
      navBadgeCounts={navBadges.navBadgeCounts}
      rightContent={
        <div className="flex items-center gap-2">
          <KeyboardShortcutsHelp />
        </div>
      }
    >
      <div className="mx-auto w-full max-w-4xl p-4">
        {/* Tab Navigation */}
        <div
          ref={tabRef}
          className="mb-6 overflow-x-auto scrollbar-immersive pb-2"
        >
          <div className="flex gap-2 min-w-max">
            <TabButton active={activeTab === "profile"} onClick={() => setActiveTab("profile")}>{t("settings.tabs.profile")}</TabButton>
            <TabButton active={activeTab === "identity"} onClick={() => setActiveTab("identity")}>{t("settings.tabs.identity")}</TabButton>
            <TabButton active={activeTab === "relays"} onClick={() => setActiveTab("relays")}>{t("settings.tabs.relays")}</TabButton>
            <TabButton active={activeTab === "notifications"} onClick={() => setActiveTab("notifications")}>{t("settings.tabs.notifications")}</TabButton>
            <TabButton active={activeTab === "appearance"} onClick={() => setActiveTab("appearance")}>{t("settings.tabs.appearance")}</TabButton>
            <TabButton active={activeTab === "blocklist"} onClick={() => setActiveTab("blocklist")}>{t("settings.tabs.blocklist")}</TabButton>
            <TabButton active={activeTab === "privacy"} onClick={() => setActiveTab("privacy")}>Privacy & Trust</TabButton>
            <TabButton active={activeTab === "updates"} onClick={() => setActiveTab("updates")}>{t("settings.tabs.updates")}</TabButton>
            <TabButton active={activeTab === "health"} onClick={() => setActiveTab("health")}>{t("settings.tabs.health")}</TabButton>
          </div>
        </div>

        {/* Tab Content */}
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
                  <div className="space-y-2">
                    <Label htmlFor="profile-avatar">{t("profile.avatarLabel")}</Label>
                    <Input
                      id="profile-avatar"
                      value={profile.state.profile.avatarUrl}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => profile.setAvatarUrl({ avatarUrl: e.target.value })}
                      placeholder={t("profile.avatarPlaceholder")}
                    />
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("profile.avatarHelp")}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={() => profile.reset()}>
                      {t("profile.reset")}
                    </Button>
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
            <Card title={t("identity.title")} description={t("identity.description")} className="w-full">
              <div className="space-y-2">
                <Label>{t("identity.publicKeyHex")}</Label>
                <Input value={displayPublicKeyHex} readOnly className="font-mono text-xs" />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={(): void => void navigator.clipboard.writeText(displayPublicKeyHex)}
                    disabled={!displayPublicKeyHex}
                  >
                    {t("common.copy")}
                  </Button>
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("messaging.nip04Desc")}</div>
              </div>
            </Card>
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
                      void requestNotificationPermission().then((result: Readonly<{ permission: NotificationPermission | "unsupported" }>): void => {
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
              ) : identity.state.status !== "unlocked" ? (
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
                </div>
              )}
            </Card>
          )}

          {activeTab === "blocklist" && (
            <Card title={t("settings.blocklist.title")} description={t("settings.blocklist.desc")} className="w-full">
              {identity.state.status === "loading" ? (
                <div className="p-4 text-sm text-zinc-500">{t("common.loading")}</div>
              ) : identity.state.status !== "unlocked" ? (
                <div className="text-sm text-zinc-700 dark:text-zinc-300">{t("settings.blocklist.unlockToManage")}</div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="blocked-pubkey">{t("settings.blocklist.addBlocked")}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="blocked-pubkey"
                        value={newBlockedPubkey}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewBlockedPubkey(e.target.value)}
                        placeholder="npub... or 64-hex"
                      />
                      <Button
                        type="button"
                        disabled={!canAddBlocked}
                        onClick={() => {
                          blocklist.addBlocked({ publicKeyInput: trimmedBlockedPubkey });
                          setNewBlockedPubkey("");
                        }}
                      >
                        {t("settings.blocklist.add")}
                      </Button>
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">{t("settings.blocklist.help")}</div>
                  </div>

                  {blocklist.state.blockedPublicKeys.length === 0 ? (
                    <div className="text-sm text-zinc-700 dark:text-zinc-300">{t("settings.blocklist.noBlocked")}</div>
                  ) : (
                    <ul className="space-y-2">
                      {blocklist.state.blockedPublicKeys.map((pubkey: string) => (
                        <li
                          key={pubkey}
                          className="rounded-xl border border-black/10 bg-zinc-50 px-3 py-2 dark:border-white/10 dark:bg-zinc-950/60"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="min-w-0 flex-1 truncate font-mono text-xs">{pubkey}</span>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => blocklist.removeBlocked({ publicKeyHex: pubkey as PublicKeyHex })}
                            >
                              {t("settings.blocklist.remove")}
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          )}

          {activeTab === "privacy" && (
            <Card title="Privacy & Trust" description="Manage who you trust and who can reach you directly." className="w-full">
              <TrustSettingsPanel />
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}

const TabButton = ({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex-shrink-0 px-4 py-2 text-sm font-medium rounded-xl border transition-colors",
      active
        ? "border-black/10 bg-zinc-100 text-zinc-900 dark:border-white/10 dark:bg-zinc-900/40 dark:text-zinc-100"
        : "border-transparent text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900/20"
    )}
  >
    {children}
  </button>
);
