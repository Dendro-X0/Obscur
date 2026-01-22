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
  | "invites"
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
      title="Settings"
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
            <TabButton active={activeTab === "profile"} onClick={() => setActiveTab("profile")}>Profile</TabButton>
            <TabButton active={activeTab === "identity"} onClick={() => setActiveTab("identity")}>Identity</TabButton>
            <TabButton active={activeTab === "relays"} onClick={() => setActiveTab("relays")}>Relays</TabButton>
            <TabButton active={activeTab === "notifications"} onClick={() => setActiveTab("notifications")}>Notifications</TabButton>
            <TabButton active={activeTab === "appearance"} onClick={() => setActiveTab("appearance")}>Appearance</TabButton>
            <TabButton active={activeTab === "blocklist"} onClick={() => setActiveTab("blocklist")}>Blocklist</TabButton>
            <TabButton active={activeTab === "invites"} onClick={() => setActiveTab("invites")}>Invites</TabButton>
            <TabButton active={activeTab === "updates"} onClick={() => setActiveTab("updates")}>Updates</TabButton>
            <TabButton active={activeTab === "health"} onClick={() => setActiveTab("health")}>Health</TabButton>
          </div>
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 gap-4">
          {activeTab === "profile" && (
            <Card title="Profile" description="Local profile shown on this device." className="w-full">
              <div id="profile" className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="profile-username">Username</Label>
                  <Input
                    id="profile-username"
                    value={profile.state.profile.username}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => profile.setUsername({ username: e.target.value })}
                    placeholder="Optional"
                  />
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">Stored locally. Not published to relays.</div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-avatar">Avatar URL</Label>
                  <Input
                    id="profile-avatar"
                    value={profile.state.profile.avatarUrl}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => profile.setAvatarUrl({ avatarUrl: e.target.value })}
                    placeholder="https://..."
                  />
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">Tip: use a stable HTTPS URL. Leave blank for the default icon.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => profile.reset()}>
                    Reset
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {activeTab === "health" && (
            <Card title="Health" description="Quick diagnostics for API, identity, and relays." className="w-full">
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">API</div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">Base URL: {getApiBaseUrl()}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="secondary" onClick={handleCheckApi} disabled={apiHealth.status === "checking"}>
                      {apiHealth.status === "checking" ? "Checking…" : "Check API"}
                    </Button>
                    {apiHealth.status === "ok" ? (
                      <div className="text-sm text-emerald-700 dark:text-emerald-300">
                        OK ({apiHealth.latencyMs}ms)
                      </div>
                    ) : apiHealth.status === "error" ? (
                      <div className="text-sm text-red-700 dark:text-red-300">Error: {apiHealth.message}</div>
                    ) : (
                      <div className="text-sm text-zinc-600 dark:text-zinc-400">Not checked</div>
                    )}
                  </div>
                  {apiHealth.status === "ok" ? (
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">Server time: {apiHealth.timeIso}</div>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-medium">Identity</div>
                  <div className="text-sm text-zinc-700 dark:text-zinc-300">
                    {identity.state.status === "unlocked" ? "Unlocked" : identity.state.status === "locked" ? "Locked" : identity.state.status}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-medium">Relays</div>
                  <div className="text-sm text-zinc-700 dark:text-zinc-300">
                    Open: <span className={getRelayStatusClassName("open")}>{relayCounts.open}</span>, Connecting:{" "}
                    <span className={getRelayStatusClassName("connecting")}>{relayCounts.connecting}</span>, Error:{" "}
                    <span className={getRelayStatusClassName("error")}>{relayCounts.error}</span>, Closed:{" "}
                    <span className={getRelayStatusClassName("closed")}>{relayCounts.closed}</span>
                  </div>
                  {enabledRelayUrls.length === 0 ? <div className="text-xs text-zinc-600 dark:text-zinc-400">No enabled relays.</div> : null}
                </div>
              </div>
            </Card>
          )}

          {activeTab === "appearance" && (
            <Card title="Appearance" description="Theme affects this device only." className="w-full">
              <div className="space-y-2">
                <Label>Theme</Label>
                <ThemeToggle />
                <div className="text-xs text-zinc-600 dark:text-zinc-400">System follows your OS setting.</div>
              </div>
            </Card>
          )}

          {activeTab === "updates" && (
            <Card title="Desktop Updates" description="Check for and install desktop app updates." className="w-full">
              <div className="space-y-3">
                <DesktopUpdater />
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  Updates are automatically checked on startup. You can also check manually here.
                </div>
              </div>
            </Card>
          )}

          {activeTab === "identity" && (
            <Card title="Identity" description="Local-only identity used for encryption." className="w-full">
              <div className="space-y-2">
                <Label>Public Key</Label>
                <Input value={displayPublicKeyHex} readOnly className="font-mono text-xs" />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={(): void => void navigator.clipboard.writeText(displayPublicKeyHex)}
                    disabled={!displayPublicKeyHex}
                  >
                    Copy
                  </Button>
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">Your private key remains local. DMs use NIP-04 encryption.</div>
              </div>
            </Card>
          )}

          {activeTab === "notifications" && (
            <Card title="Notifications" description="Desktop notifications for new messages." className="w-full">
              <div className="space-y-3">
                <div className="text-sm text-zinc-700 dark:text-zinc-300">
                  {notificationPreference.state.permission === "unsupported"
                    ? "Your browser does not support notifications."
                    : notificationPreference.state.permission === "denied"
                      ? "Notifications are blocked in your browser settings."
                      : "Notifications only show when this tab is not active."}
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
                    Enable
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => notificationPreference.setEnabled({ enabled: false })}
                  >
                    Disable
                  </Button>
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  Status: {notificationPreference.state.enabled ? "enabled" : "disabled"} · Permission: {notificationPreference.state.permission}
                </div>
              </div>
            </Card>
          )}

          {activeTab === "relays" && (
            <Card title="Relays" description="Per-identity relay list and live connection status." className="w-full">
              {identity.state.status !== "unlocked" ? (
                <div className="text-sm text-zinc-700 dark:text-zinc-300">Unlock your identity to manage relays.</div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="relay-url">Add relay</Label>
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
                        Add
                      </Button>
                    </div>
                    {!canAddRelay && trimmedRelayUrl.length > 0 ? (
                      <div className="text-xs text-red-600 dark:text-red-400">Invalid relay URL (must be wss:// and parseable)</div>
                    ) : (
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">Only wss:// relays are supported.</div>
                    )}
                  </div>

                  <ul className="space-y-2">
                    {relayList.state.relays.length === 0 ? (
                      <div className="py-4">
                        <EmptyState
                          type="relays"
                          title="No relays configured"
                          description="Add your first relay to connect to the network and start messaging."
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
                                {relay.enabled ? "Disable" : "Enable"}
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                disabled={index === 0}
                                onClick={() => relayList.moveRelay({ url: relay.url, direction: "up" })}
                              >
                                Up
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                disabled={index === relayList.state.relays.length - 1}
                                onClick={() => relayList.moveRelay({ url: relay.url, direction: "down" })}
                              >
                                Down
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => relayList.removeRelay({ url: relay.url })}
                              >
                                Remove
                              </Button>
                            </div>
                          </li>
                        );
                      })
                    )}
                  </ul>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">Metadata is visible to relays; message content is encrypted.</div>
                </div>
              )}
            </Card>
          )}

          {activeTab === "blocklist" && (
            <Card title="Blocklist" description="Ignore DMs from these public keys." className="w-full">
              {identity.state.status !== "unlocked" ? (
                <div className="text-sm text-zinc-700 dark:text-zinc-300">Unlock your identity to manage the blocklist.</div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="blocked-pubkey">Add blocked pubkey</Label>
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
                        Add
                      </Button>
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">Accepts npub or hex. Changes are local to this device.</div>
                  </div>

                  {blocklist.state.blockedPublicKeys.length === 0 ? (
                    <div className="text-sm text-zinc-700 dark:text-zinc-300">No blocked keys.</div>
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
                              Remove
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

          {activeTab === "invites" && (
            <Card title="Invite System" description="Manage your invite and contact settings." className="w-full">
              {identity.state.status !== "unlocked" ? (
                <div className="text-sm text-zinc-700 dark:text-zinc-300">Unlock your identity to manage invite settings.</div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Quick Actions</div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() => window.location.href = "/invites"}
                      >
                        Open Invite System
                      </Button>
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      Generate QR codes, create invite links, and manage contacts.
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Privacy Settings</div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      Control what information is shared when you create invites. These settings are managed in the Profile section of the Invite System.
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Contact Requests</div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      Manage incoming and outgoing contact requests in the Invite System. You can accept, decline, or block requests.
                    </div>
                  </div>
                </div>
              )}
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
