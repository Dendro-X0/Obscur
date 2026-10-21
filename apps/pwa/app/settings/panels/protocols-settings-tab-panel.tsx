"use client";

import { useCallback, useState } from "react";
import type React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@dweb/ui-kit/button";
import { Input } from "@dweb/ui-kit/input";
import { Label } from "@dweb/ui-kit/label";
import { cn } from "@/app/lib/utils";
import {
  SettingsCompactCard,
  SettingsCompactSection,
} from "@/app/features/settings/components/settings-compact-card";
import { useMobileCompactLayout } from "@/app/features/runtime/use-mobile-compact-layout";
import {
  SELECTABLE_PROTOCOL_IDS,
  ProtocolAdaptationLayer,
  PROTOCOL_IDS,
  TRANSPORT_IDS,
  hasMatrixSession,
  matrixLogin,
  matrixLoginAccessToken,
  matrixLogout,
  readMatrixSession,
  getProtocolSwitchSummary,
  type ProtocolId,
  type TransportId,
} from "@/app/features/protocol-adaptation";
import { ProtocolCapabilityChips } from "@/app/features/protocol-adaptation/components/protocol-capability-chips";
import { ProtocolMigrationHints } from "@/app/features/protocol-adaptation/components/protocol-migration-hints";

const PROTOCOL_LABEL_KEY: Record<ProtocolId, string> = {
  nostr: "settings.protocols.protocol.nostr",
  matrix: "settings.protocols.protocol.matrix",
};

const TRANSPORT_LABEL_KEY: Record<TransportId, string> = {
  clearnet: "settings.protocols.transport.clearnet",
  tor: "settings.protocols.transport.tor",
  quiet: "settings.protocols.transport.quiet",
};

export default function ProtocolsSettingsTabPanel(): React.JSX.Element {
  const { t } = useTranslation();
  const compact = useMobileCompactLayout();
  const [protocolId, setProtocolId] = useState<ProtocolId>(() => (
    ProtocolAdaptationLayer.getActiveProtocolId()
  ));
  const [transportId, setTransportId] = useState<TransportId>(() => (
    ProtocolAdaptationLayer.getActiveTransportId()
  ));
  const [matrixSessionUser, setMatrixSessionUser] = useState<string | null>(() => (
    readMatrixSession()?.userId ?? null
  ));
  const [homeserverUrl, setHomeserverUrl] = useState("https://matrix.org");
  const [matrixUserId, setMatrixUserId] = useState("");
  const [matrixPassword, setMatrixPassword] = useState("");
  const [matrixAccessToken, setMatrixAccessToken] = useState("");
  const [matrixBusy, setMatrixBusy] = useState(false);
  const [matrixMessage, setMatrixMessage] = useState<string | null>(null);
  const [protocolMessage, setProtocolMessage] = useState<string | null>(null);

  const selectProtocol = useCallback((next: ProtocolId): void => {
    setProtocolMessage(null);
    if (!SELECTABLE_PROTOCOL_IDS.includes(next)) {
      return;
    }
    if (next === "matrix" && !hasMatrixSession()) {
      setProtocolMessage(t("settings.protocols.matrix.loginRequired", {
        defaultValue: "Log in to a homeserver below before switching to Matrix.",
      }));
      window.requestAnimationFrame(() => {
        document.getElementById("matrix-login")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }
    try {
      ProtocolAdaptationLayer.setActiveProtocolId(next);
      setProtocolId(next);
      setProtocolMessage(getProtocolSwitchSummary(next));
    } catch (error) {
      setProtocolMessage(error instanceof Error ? error.message : String(error));
    }
  }, [t]);

  const [transportApplying, setTransportApplying] = useState(false);
  const [transportMessage, setTransportMessage] = useState<string | null>(null);

  const selectTransport = useCallback(async (next: TransportId): Promise<void> => {
    setTransportApplying(true);
    setTransportMessage(null);
    try {
      await ProtocolAdaptationLayer.applyTransport(next);
      setTransportId(ProtocolAdaptationLayer.getActiveTransportId());
      if (next === "tor") {
        setTransportMessage(t("settings.protocols.transport.torApplied", {
          defaultValue: "Tor selected — gateway starting; clearnet dials until Ready.",
        }));
      } else if (next === "quiet") {
        setTransportMessage(t("settings.protocols.transport.quietApplied", {
          defaultValue: "Quiet selected — dial caps unchanged (uncapped Quiet stays paused).",
        }));
      } else {
        setTransportMessage(t("settings.protocols.transport.clearnetApplied", {
          defaultValue: "Clearnet selected — Tor preference off.",
        }));
      }
    } catch (error) {
      setTransportMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setTransportApplying(false);
    }
  }, [t]);

  const handleMatrixLogin = useCallback(async (): Promise<void> => {
    setMatrixBusy(true);
    setMatrixMessage(null);
    try {
      const session = await matrixLogin({
        homeserverUrl,
        userId: matrixUserId,
        password: matrixPassword,
      });
      setMatrixSessionUser(session.userId);
      setMatrixPassword("");
      setMatrixAccessToken("");
      setMatrixMessage(t("settings.protocols.matrix.loginOk", {
        defaultValue: "Logged in — you can switch Protocol to Matrix.",
      }));
    } catch (error) {
      setMatrixMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setMatrixBusy(false);
    }
  }, [homeserverUrl, matrixPassword, matrixUserId, t]);

  const handleMatrixAccessTokenLogin = useCallback(async (): Promise<void> => {
    setMatrixBusy(true);
    setMatrixMessage(null);
    try {
      const session = await matrixLoginAccessToken({
        homeserverUrl,
        accessToken: matrixAccessToken,
        userId: matrixUserId.trim() || undefined,
      });
      setMatrixSessionUser(session.userId);
      setMatrixPassword("");
      setMatrixAccessToken("");
      setMatrixMessage(t("settings.protocols.matrix.tokenLoginOk", {
        defaultValue: "Access token accepted — you can switch Protocol to Matrix.",
      }));
    } catch (error) {
      setMatrixMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setMatrixBusy(false);
    }
  }, [homeserverUrl, matrixAccessToken, matrixUserId, t]);

  const handleMatrixLogout = useCallback((): void => {
    matrixLogout();
    setMatrixSessionUser(null);
    if (ProtocolAdaptationLayer.getActiveProtocolId() === "matrix") {
      ProtocolAdaptationLayer.setActiveProtocolId("nostr");
      setProtocolId("nostr");
    }
    setMatrixMessage(t("settings.protocols.matrix.loggedOut", {
      defaultValue: "Matrix session cleared.",
    }));
  }, [t]);

  return (
    <SettingsCompactCard
      title={t("settings.protocols.title", { defaultValue: "Protocols & network" })}
      description={t("settings.protocols.desc", {
        defaultValue: "Messaging protocol, network path, then Matrix homeserver login when you need it.",
      })}
      className="w-full"
    >
      <div id="protocols-selectors" data-testid="protocols-selectors" className={compact ? "space-y-4" : "space-y-6"}>
        <SettingsCompactSection
          title={t("settings.protocols.protocolSection", { defaultValue: "Protocol" })}
          hint={t("settings.protocols.protocolHint", {
            defaultValue: "One active messaging stack — no dual-write. Matrix needs a homeserver session first.",
          })}
        >
          <div className={cn(compact ? "grid grid-cols-2 gap-1.5" : "flex flex-wrap gap-2")}>
            {PROTOCOL_IDS.map((id) => {
              const selectable = SELECTABLE_PROTOCOL_IDS.includes(id);
              const active = protocolId === id;
              const matrixNeedsLogin = id === "matrix" && !hasMatrixSession();
              return (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={active ? "primary" : "outline"}
                  disabled={!selectable}
                  data-testid={`protocol-option-${id}`}
                  className={cn(
                    "font-black transition-all",
                    compact ? "h-9 px-2 text-xs" : "h-10 px-4",
                    !selectable && "opacity-50",
                  )}
                  onClick={() => selectProtocol(id)}
                >
                  {t(PROTOCOL_LABEL_KEY[id], {
                    defaultValue: id === "nostr" ? "Nostr" : "Matrix",
                  })}
                  {matrixNeedsLogin ? (
                    <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                      {t("settings.protocols.matrix.needsLogin", { defaultValue: "Login" })}
                    </span>
                  ) : null}
                </Button>
              );
            })}
          </div>
          {protocolMessage ? (
            <p data-testid="protocol-select-message" className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {protocolMessage}
            </p>
          ) : null}
          <ProtocolCapabilityChips className="mt-3" />
          <ProtocolMigrationHints className="mt-3" protocolId={protocolId} compact />
        </SettingsCompactSection>

        <SettingsCompactSection
          title={t("settings.protocols.transportSection", { defaultValue: "Network path" })}
          hint={t("settings.protocols.transportHint", {
            defaultValue: "How traffic leaves this device (Clearnet, Tor gateway, or Quiet dial caps).",
          })}
        >
          <div className={cn(compact ? "grid grid-cols-3 gap-1.5" : "flex flex-wrap gap-2")}>
            {TRANSPORT_IDS.map((id) => {
              const active = transportId === id;
              return (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={active ? "primary" : "outline"}
                  disabled={transportApplying}
                  data-testid={`transport-option-${id}`}
                  className={cn(
                    "font-black transition-all",
                    compact ? "h-9 px-0 text-xs" : "h-10 px-4",
                  )}
                  onClick={() => {
                    void selectTransport(id);
                  }}
                >
                  {t(TRANSPORT_LABEL_KEY[id], {
                    defaultValue: id === "clearnet" ? "Clearnet" : id === "tor" ? "Tor" : "Quiet",
                  })}
                </Button>
              );
            })}
          </div>
          {transportMessage ? (
            <p
              data-testid="transport-apply-message"
              className="mt-2 text-xs text-zinc-500 dark:text-zinc-400"
            >
              {transportMessage}
            </p>
          ) : null}
        </SettingsCompactSection>

        <SettingsCompactSection
          title={t("settings.protocols.matrix.section", { defaultValue: "Matrix homeserver" })}
          hint={t("settings.protocols.matrix.hint", {
            defaultValue: "Password or access token (SSO/Element). Token stored on this profile. Cleartext rooms only in this MVP.",
          })}
        >
          <div id="matrix-login" data-testid="matrix-login" className="space-y-3">
            {matrixSessionUser ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-zinc-700 dark:text-zinc-200">
                  {t("settings.protocols.matrix.signedInAs", {
                    defaultValue: "Signed in as {{user}}",
                    user: matrixSessionUser,
                  })}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid="matrix-logout"
                  onClick={handleMatrixLogout}
                >
                  {t("settings.protocols.matrix.logout", { defaultValue: "Log out" })}
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <Label htmlFor="matrix-homeserver">
                    {t("settings.protocols.matrix.homeserver", { defaultValue: "Homeserver URL" })}
                  </Label>
                  <Input
                    id="matrix-homeserver"
                    data-testid="matrix-homeserver"
                    value={homeserverUrl}
                    onChange={(event) => setHomeserverUrl(event.target.value)}
                    autoComplete="url"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="matrix-user">
                    {t("settings.protocols.matrix.userId", { defaultValue: "User ID (optional with token)" })}
                  </Label>
                  <Input
                    id="matrix-user"
                    data-testid="matrix-user"
                    value={matrixUserId}
                    onChange={(event) => setMatrixUserId(event.target.value)}
                    placeholder="@user:matrix.org"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="matrix-password">
                    {t("settings.protocols.matrix.password", { defaultValue: "Password" })}
                  </Label>
                  <Input
                    id="matrix-password"
                    data-testid="matrix-password"
                    type="password"
                    value={matrixPassword}
                    onChange={(event) => setMatrixPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  data-testid="matrix-login-submit"
                  disabled={matrixBusy || !homeserverUrl.trim() || !matrixUserId.trim() || !matrixPassword}
                  onClick={() => {
                    void handleMatrixLogin();
                  }}
                >
                  {matrixBusy
                    ? t("settings.protocols.matrix.loggingIn", { defaultValue: "Logging in…" })
                    : t("settings.protocols.matrix.login", { defaultValue: "Log in with password" })}
                </Button>
                <div className="space-y-1 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                  <Label htmlFor="matrix-access-token">
                    {t("settings.protocols.matrix.accessToken", {
                      defaultValue: "Access token (SSO / Element)",
                    })}
                  </Label>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {t("settings.protocols.matrix.accessTokenHint", {
                      defaultValue: "Element → Settings → Help & About → Access Token (or account sessions). Validates via whoami.",
                    })}
                  </p>
                  <Input
                    id="matrix-access-token"
                    data-testid="matrix-access-token"
                    type="password"
                    value={matrixAccessToken}
                    onChange={(event) => setMatrixAccessToken(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid="matrix-token-login-submit"
                  disabled={matrixBusy || !homeserverUrl.trim() || !matrixAccessToken.trim()}
                  onClick={() => {
                    void handleMatrixAccessTokenLogin();
                  }}
                >
                  {matrixBusy
                    ? t("settings.protocols.matrix.loggingIn", { defaultValue: "Logging in…" })
                    : t("settings.protocols.matrix.tokenLogin", { defaultValue: "Use access token" })}
                </Button>
              </>
            )}
            {matrixMessage ? (
              <p data-testid="matrix-login-message" className="text-xs text-zinc-500 dark:text-zinc-400">
                {matrixMessage}
              </p>
            ) : null}
          </div>
        </SettingsCompactSection>
      </div>
    </SettingsCompactCard>
  );
}
