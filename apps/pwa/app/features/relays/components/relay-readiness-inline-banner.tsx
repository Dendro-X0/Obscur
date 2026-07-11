"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { useRelay } from "../providers/relay-provider";
import {
  getRelayReadinessBannerCopy,
  getRelayReadinessTone,
} from "../services/relay-readiness-copy";

type RelayReadinessInlineBannerProps = Readonly<{
  className?: string;
}>;

const OFFLINE_BANNER_GRACE_MS = 1200;

/**
 * Conversation-level relay transport notice when publish path is degraded or offline.
 */
export function RelayReadinessInlineBanner({ className }: RelayReadinessInlineBannerProps = {}) {
  const { relayRecovery, relayRuntime } = useRelay();
  const [offlineBannerVisible, setOfflineBannerVisible] = useState(false);
  const copy = getRelayReadinessBannerCopy(relayRecovery);

  useEffect(() => {
    if (relayRecovery.readiness !== "offline") {
      setOfflineBannerVisible(false);
      return;
    }
    if (relayRecovery.recoveryReasonCode === "startup_warmup" || relayRuntime.phase === "booting") {
      setOfflineBannerVisible(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setOfflineBannerVisible(true);
    }, OFFLINE_BANNER_GRACE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [relayRecovery.readiness, relayRecovery.recoveryReasonCode, relayRuntime.phase]);

  if (!copy || relayRecovery.readiness === "healthy") {
    return null;
  }

  if (relayRecovery.readiness === "offline" && !offlineBannerVisible) {
    return null;
  }

  return (
    <div
      role="status"
      className={cn(
        "mx-4 mt-2 mb-0 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-snug",
        getRelayReadinessTone(relayRecovery.readiness),
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      <p>{copy}</p>
    </div>
  );
}
