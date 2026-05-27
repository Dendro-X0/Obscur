"use client";

import { RefreshCcw } from "lucide-react";
import { Button } from "@dweb/ui-kit";
import { cn } from "@/app/lib/utils";
import { useRelay } from "../providers/relay-provider";
import {
  getRelayReadinessBannerCopy,
  getRelayReadinessDetailCopy,
  getRelayReadinessTone,
} from "../services/relay-readiness-copy";

/**
 * Settings → Network → Relays: surfaces relay recovery readiness when transport is not healthy.
 */
export function RelayReadinessSettingsBanner() {
  const { relayRecovery, triggerRelayRecovery } = useRelay();
  const bannerCopy = getRelayReadinessBannerCopy(relayRecovery);
  const detailCopy = getRelayReadinessDetailCopy(relayRecovery);

  if (!bannerCopy || relayRecovery.readiness === "healthy") {
    return null;
  }

  const isRecoveryExhausted = relayRecovery.recoveryReasonCode === "recovery_exhausted";
  const retryLabel = isRecoveryExhausted
    ? "Switch relay and retry"
    : "Retry relay recovery";

  return (
    <div
      className={cn(
        "space-y-3 rounded-2xl border p-4",
        getRelayReadinessTone(relayRecovery.readiness),
      )}
      role="status"
    >
      <p className="text-sm font-semibold leading-snug">{bannerCopy}</p>
      {detailCopy ? (
        <p className="text-xs leading-relaxed opacity-90">{detailCopy}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider opacity-80">
        <span>Transport: {relayRecovery.readiness}</span>
        {relayRecovery.recoveryReasonCode ? (
          <span className="rounded-full bg-black/5 px-2 py-0.5 dark:bg-white/10">
            {relayRecovery.recoveryReasonCode.replaceAll("_", " ")}
          </span>
        ) : null}
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="w-fit"
        onClick={() => void triggerRelayRecovery("manual")}
      >
        <RefreshCcw className="mr-2 h-3.5 w-3.5" />
        {retryLabel}
      </Button>
    </div>
  );
}
