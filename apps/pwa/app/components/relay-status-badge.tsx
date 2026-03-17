"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, Loader2, RotateCcw, Wifi, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import type { RelayRecoverySnapshot } from "@/app/features/relays/services/relay-recovery-policy";
import { cn } from "@/app/lib/utils";

type RelayStatusBadgeProps = Readonly<{
  compact?: boolean;
  compactNavigateHref?: string;
}>;

export type BadgePresentation = Readonly<{
  label: string;
  toneClassName: string;
  icon: React.ReactNode;
  detail: string;
}>;

const formatRelativeTime = (unixMs?: number): string | null => {
  if (!unixMs) {
    return null;
  }
  const deltaMs = Math.max(0, Date.now() - unixMs);
  const deltaSeconds = Math.round(deltaMs / 1000);
  if (deltaSeconds < 10) {
    return "just now";
  }
  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`;
  }
  const deltaMinutes = Math.round(deltaSeconds / 60);
  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }
  const deltaHours = Math.round(deltaMinutes / 60);
  return `${deltaHours}h ago`;
};

const describeRecoveryReason = (snapshot: RelayRecoverySnapshot): string | null => {
  switch (snapshot.recoveryReasonCode) {
    case "startup_warmup":
      return "warming up relay access";
    case "no_writable_relays":
      return "no writable relays available";
    case "stale_subscriptions":
      return "subscriptions stopped receiving events";
    case "publish_timeouts":
      return "recent relay publishes timed out";
    case "cooldown_active":
      return "recovery cooldown active";
    case "recovery_exhausted":
      return "automatic recovery budget exhausted";
    case "manual":
      return "manual recovery in progress";
    default:
      return null;
  }
};

export const getRelayStatusBadgePresentation = (snapshot: RelayRecoverySnapshot): BadgePresentation => {
  const activityLabel = formatRelativeTime(snapshot.lastInboundEventAtUnixMs ?? snapshot.lastSuccessfulPublishAtUnixMs);
  const reason = describeRecoveryReason(snapshot) ?? snapshot.lastFailureReason ?? "relay activity unavailable";

  switch (snapshot.readiness) {
    case "healthy":
      return {
        label: "Connected",
        toneClassName: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        icon: <Wifi className="h-3.5 w-3.5 text-emerald-500" />,
        detail: `${snapshot.writableRelayCount} writable / ${snapshot.subscribableRelayCount} readable${activityLabel ? `, active ${activityLabel}` : ""}`,
      };
    case "recovering":
      return {
        label: "Recovering connection",
        toneClassName: "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300",
        icon: <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />,
        detail: `${reason}${snapshot.currentAction ? `, action: ${snapshot.currentAction.replace("_", " ")}` : ""}`,
      };
    case "degraded":
      return {
        label: "Connection degraded",
        toneClassName: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
        detail: `${snapshot.writableRelayCount} writable / ${snapshot.subscribableRelayCount} readable, ${reason}`,
      };
    case "offline":
    default:
      return {
        label: "Offline",
        toneClassName: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
        icon: <WifiOff className="h-3.5 w-3.5 text-rose-500" />,
        detail: reason,
      };
  }
};

export function RelayStatusBadge({ compact = false, compactNavigateHref }: RelayStatusBadgeProps) {
  const router = useRouter();
  const { relayRecovery, triggerRelayRecovery } = useRelay();
  const [isRecovering, setIsRecovering] = useState(false);
  const presentation = useMemo(() => getRelayStatusBadgePresentation(relayRecovery), [relayRecovery]);
  const compactCanNavigate = compact && typeof compactNavigateHref === "string" && compactNavigateHref.length > 0;

  const canTriggerRecovery = !isRecovering && (
    relayRecovery.readiness === "degraded"
    || relayRecovery.readiness === "offline"
  );
  const canClick = compactCanNavigate || canTriggerRecovery;

  const handleRecovery = async (): Promise<void> => {
    if (!canTriggerRecovery) {
      return;
    }
    setIsRecovering(true);
    try {
      await triggerRelayRecovery("manual");
    } finally {
      setIsRecovering(false);
    }
  };

  const handleBadgeClick = async (): Promise<void> => {
    if (compactCanNavigate) {
      void router.push(compactNavigateHref!);
      return;
    }
    await handleRecovery();
  };

  const title = compactCanNavigate
    ? "Open relay settings"
    : `${presentation.label}. ${presentation.detail}`;

  if (compact) {
    return (
      <button
        type="button"
        title={title}
        aria-label={presentation.label}
        onClick={() => void handleBadgeClick()}
        disabled={!canClick}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-2xl border transition-colors",
          presentation.toneClassName,
          canClick ? "cursor-pointer hover:brightness-105" : "cursor-default"
        )}
      >
        {isRecovering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : presentation.icon}
      </button>
    );
  }

  return (
    <button
      type="button"
      title={title}
      onClick={() => void handleRecovery()}
      disabled={!canTriggerRecovery}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black tracking-[0.12em] uppercase transition-colors",
        presentation.toneClassName,
        canTriggerRecovery ? "cursor-pointer hover:brightness-105" : "cursor-default"
      )}
    >
      {isRecovering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : presentation.icon}
      <span className="truncate">{presentation.label}</span>
      <span className="hidden max-w-[14rem] truncate font-semibold normal-case tracking-normal opacity-80 xl:inline">
        {presentation.detail}
      </span>
      {canTriggerRecovery ? <RotateCcw className="h-3.5 w-3.5 opacity-70" /> : null}
    </button>
  );
}
