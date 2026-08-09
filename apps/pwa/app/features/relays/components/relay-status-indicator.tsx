"use client";

import { useEffect, useMemo, useState } from "react";
import { useRelay } from "../providers/relay-provider";
import { cn } from "@/app/lib/utils";
import { Radio } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RelayReadinessState } from "../services/relay-recovery-types";
import { resolveShellRelayActiveCounts } from "../services/resolve-shell-relay-active-counts";

const OFFLINE_STATUS_GRACE_MS = 1200;

/**
 * Shell Connected/Offline label — open sockets only.
 * Writable/publish-ready must not claim Connected when openCount is 0.
 */
export const resolveRelayStatusPresentation = (params: Readonly<{
  readiness: RelayReadinessState;
  phase: string;
  openRelayCount: number;
  isRecovering: boolean;
}>): Readonly<{ labelKey: string; labelFallback: string; toneClass: string; showPulse: boolean }> => {
  const { readiness, phase, openRelayCount, isRecovering } = params;

  if (openRelayCount === 0 && !isRecovering) {
    return {
      labelKey: "relays.offline",
      labelFallback: "Offline",
      toneClass: "text-zinc-400",
      showPulse: false,
    };
  }
  if (readiness === "degraded" || phase === "degraded") {
    return {
      labelKey: "relays.degraded",
      labelFallback: "Degraded",
      toneClass: "text-amber-500",
      showPulse: false,
    };
  }
  if (
    openRelayCount === 0
    && (isRecovering || readiness === "recovering" || phase === "recovering" || phase === "connecting")
  ) {
    return {
      labelKey: "relays.connecting",
      labelFallback: "Connecting",
      toneClass: "text-sky-500",
      showPulse: false,
    };
  }
  return {
    labelKey: "relays.connected",
    labelFallback: "Connected",
    toneClass: "text-emerald-500",
    showPulse: true,
  };
};

export function RelayStatusIndicator({ embedded = false }: Readonly<{ embedded?: boolean }>) {
  const { t } = useTranslation();
  const { relayPool: pool, relayRuntime, relayRecovery, enabledRelayUrls } = useRelay();
  const [offlineStatusVisible, setOfflineStatusVisible] = useState(false);

  const { openCount, totalCount } = useMemo(() => (
    resolveShellRelayActiveCounts({
      connections: pool.connections,
      enabledRelayUrls: enabledRelayUrls ?? relayRuntime.enabledRelayUrls,
    })
  ), [pool.connections, enabledRelayUrls, relayRuntime.enabledRelayUrls]);

  useEffect(() => {
    if (relayRecovery.readiness !== "offline") {
      setOfflineStatusVisible(false);
      return;
    }
    if (relayRecovery.recoveryReasonCode === "startup_warmup" || relayRuntime.phase === "booting") {
      setOfflineStatusVisible(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setOfflineStatusVisible(true);
    }, OFFLINE_STATUS_GRACE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [relayRecovery.readiness, relayRecovery.recoveryReasonCode, relayRuntime.phase]);

  const effectiveReadiness: RelayReadinessState = (
    relayRecovery.readiness === "offline" && !offlineStatusVisible
      ? "recovering"
      : relayRecovery.readiness
  );
  const isRecovering = relayRuntime.phase === "recovering"
    || relayRuntime.phase === "connecting"
    || effectiveReadiness === "recovering";
  const presentation = resolveRelayStatusPresentation({
    readiness: effectiveReadiness,
    phase: relayRuntime.phase,
    openRelayCount: openCount,
    isRecovering,
  });
  const statusLabel = t(presentation.labelKey, presentation.labelFallback);

  return (
    <div className={cn("flex items-center gap-2.5", embedded ? undefined : "px-4 py-2")}>
      <div className="relative">
        <Radio className={cn("h-4 w-4", presentation.toneClass)} />
        {presentation.showPulse && (
          <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 leading-none">
          {statusLabel}
        </span>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
          {openCount}/{totalCount} {t("relays.active_relays")}
        </span>
      </div>
    </div>
  );
}
