"use client";

import { useRelay } from "../providers/relay-provider";
import { cn } from "@/app/lib/utils";
import { Radio } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RelayReadinessState } from "../services/relay-recovery-policy";

export const resolveRelayStatusPresentation = (params: Readonly<{
  readiness: RelayReadinessState;
  phase: string;
  writableRelayCount: number;
  isRecovering: boolean;
}>): Readonly<{ labelKey: string; labelFallback: string; toneClass: string; showPulse: boolean }> => {
  const { readiness, phase, writableRelayCount, isRecovering } = params;

  if (readiness === "offline" || (writableRelayCount === 0 && !isRecovering)) {
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
  if (isRecovering || readiness === "recovering" || phase === "recovering" || phase === "connecting") {
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

export function RelayStatusIndicator() {
  const { t } = useTranslation();
  const { relayPool: pool, relayRuntime, relayRecovery } = useRelay();

  const totalCount = pool.connections.length;
  const isRecovering = relayRuntime.phase === "recovering"
    || relayRuntime.phase === "connecting"
    || relayRecovery.readiness === "recovering";
  const presentation = resolveRelayStatusPresentation({
    readiness: relayRecovery.readiness,
    phase: relayRuntime.phase,
    writableRelayCount: relayRuntime.writableRelayCount,
    isRecovering,
  });
  const statusLabel = t(presentation.labelKey, presentation.labelFallback);

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="relative">
        <Radio className={cn("h-3.5 w-3.5", presentation.toneClass)} />
        {presentation.showPulse && (
          <span className="absolute -right-0.5 -top-0.5 flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 leading-none">
          {statusLabel}
        </span>
        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-0.5">
          {relayRuntime.writableRelayCount}/{Math.max(totalCount, relayRuntime.enabledRelayUrls.length)} {t("relays.active_relays")}
        </span>
      </div>
    </div>
  );
}
