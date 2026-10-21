"use client";

import { useState } from "react";
import { RefreshCcw, FlaskConical } from "lucide-react";
import { Button } from "@dweb/ui-kit/button";
import { cn } from "@/app/lib/utils";
import { useRelay } from "../providers/relay-provider";
import { useRelayPoolDiagnosis } from "../hooks/use-relay-pool-diagnosis";
import {
  getRelayReadinessBannerCopy,
  getRelayReadinessDetailCopy,
  getRelayReadinessTone,
} from "../services/relay-readiness-copy";
import { buildTrackLPrivateTrustRelayPlan } from "../services/relay-track-l-private-trust-plan";

/**
 * Settings → Network → Relays: surfaces relay recovery readiness when transport is not healthy.
 * Suppress offline during startup warmup / booting (parity with RelayReadinessInlineBanner).
 * Slice C: one-tap Track L private-trust layout (local on · publics off · primary local).
 */
export function RelayReadinessSettingsBanner() {
  const {
    relayRecovery,
    relayRuntime,
    triggerRelayRecovery,
    relayList,
    setPrimaryRelay,
  } = useRelay();
  const poolDiagnosis = useRelayPoolDiagnosis();
  const [trackLMessage, setTrackLMessage] = useState<string | null>(null);
  const bannerCopy = getRelayReadinessBannerCopy(relayRecovery, poolDiagnosis);
  const detailCopy = getRelayReadinessDetailCopy(relayRecovery, poolDiagnosis);
  const suppressStartupOffline = (
    relayRecovery.readiness === "offline"
    && (
      relayRecovery.recoveryReasonCode === "startup_warmup"
      || relayRuntime.phase === "booting"
      || relayRecovery.writableRelayCount > 0
      || relayRuntime.writableRelayCount > 0
    )
  );

  const showTrackLCta = (
    poolDiagnosis.loopbackDisabledCount > 0
    || poolDiagnosis.enabledRemoteDisconnectedCount > 0
    || relayRecovery.readiness === "offline"
    || relayRecovery.readiness === "degraded"
  );

  const applyTrackLPrivateTrust = (): void => {
    const plan = buildTrackLPrivateTrustRelayPlan(relayList.state.relays);
    relayList.replaceRelays({ relays: plan.relays });
    setPrimaryRelay(plan.primaryUrl);
    setTrackLMessage(
      plan.changed
        ? `Private-trust layout applied: ${plan.primaryUrl} enabled · ${plan.disabledRemoteCount} public disabled · Tor stays off for this soak.`
        : `Already on private-trust layout (${plan.primaryUrl}). Confirm Docker :7000 is up.`,
    );
    void triggerRelayRecovery("manual");
  };

  if (!bannerCopy || relayRecovery.readiness === "healthy" || suppressStartupOffline) {
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
      {trackLMessage ? (
        <p className="text-xs leading-relaxed opacity-90" data-testid="track-l-private-trust-result">
          {trackLMessage}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {showTrackLCta ? (
          <Button
            type="button"
            size="sm"
            variant="primary"
            className="w-fit"
            onClick={applyTrackLPrivateTrust}
            data-testid="track-l-private-trust-cta"
          >
            <FlaskConical className="mr-2 h-3.5 w-3.5" />
            Use local relay (Track L)
          </Button>
        ) : null}
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
    </div>
  );
}
