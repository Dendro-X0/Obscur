import { isExperimentOfflineStubEnabled } from "@/app/features/runtime/experiment-shell-policy";
import type { RelayReadinessState, RelayRecoverySnapshot } from "./relay-recovery-types";

export const getRelayReadinessBannerCopy = (snapshot: RelayRecoverySnapshot): string | null => {
  if (isExperimentOfflineStubEnabled()) {
    return "Relay transport is disabled in offline mode. Run pnpm dev:desktop:online for live relays and messaging, or enable relays in Settings.";
  }
  if (snapshot.recoveryReasonCode === "startup_warmup") {
    return null;
  }
  if (snapshot.recoveryReasonCode === "recovery_exhausted") {
    return "Could not connect to relays. Automatic retries are paused — use the relay badge to retry or check relay settings.";
  }
  switch (snapshot.readiness) {
    case "recovering":
      return "Obscur is recovering the relay connection. Delivery can resume once writable relays are back.";
    case "degraded":
      return "Relay connection is degraded. Delivery may be partial, but Obscur will only show success with relay evidence.";
    case "offline":
      return "Relay transport is offline. You can still read messages; sends are queued until relays return.";
    default:
      return null;
  }
};

/** Non-blocking hint when publish will queue until relays recover. */
export const getRelayTransportQueueHint = (
  snapshot: Pick<RelayRecoverySnapshot, "readiness" | "writableRelayCount">,
): string | null => {
  if (snapshot.writableRelayCount > 0) {
    return null;
  }
  switch (snapshot.readiness) {
    case "recovering":
      return "Relay connection is recovering. Your message will queue and send when writable relays return.";
    case "offline":
      return "Relay transport is offline. Your message is queued and will send automatically when relays return.";
    case "degraded":
      return "Writable relays are unavailable. Your message is queued until relay evidence is available.";
    default:
      return "No writable relays right now. Your message is queued and will retry when the connection returns.";
  }
};

/** @deprecated Use {@link getRelayTransportQueueHint} — compose is never blocked on relay state. */
export const getRelaySendBlockCopy = getRelayTransportQueueHint;

export const getRelayReadinessDetailCopy = (
  snapshot: RelayRecoverySnapshot,
): string | null => {
  if (snapshot.readiness === "healthy") {
    return null;
  }

  const writableLabel = `${snapshot.writableRelayCount} writable · ${snapshot.subscribableRelayCount} subscribable`;
  if (snapshot.recoveryReasonCode === "recovery_exhausted") {
    const failureDetail = snapshot.lastFailureReason ? ` Last error: ${snapshot.lastFailureReason}.` : "";
    return `Relay connection failed (${writableLabel}). Automatic recovery paused.${failureDetail}`;
  }
  switch (snapshot.readiness) {
    case "recovering":
      return `Obscur is reconnecting relays (${writableLabel}). Delivery may resume shortly.`;
    case "offline":
      return `Relay transport is offline (${writableLabel}). Sends queue locally; background sync resumes when online.`;
    case "degraded":
      return `Relay transport is degraded (${writableLabel}). Obscur will only treat delivery as successful with relay evidence.`;
    default:
      return null;
  }
};

export const getRelayReadinessTone = (readiness: RelayReadinessState): string => {
  switch (readiness) {
    case "recovering":
      return "border-blue-500/20 bg-blue-500/5 text-blue-700 dark:text-blue-300";
    case "offline":
      return "border-rose-500/20 bg-rose-500/5 text-rose-700 dark:text-rose-300";
    case "degraded":
      return "border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-300";
    default:
      return "border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300";
  }
};
