/**
 * TI-3: Security / Relays Tor lifecycle UX copy — maps dial phases to user-visible honesty.
 */

import {
  resolveTorDialPolicyPhase,
  type TorDialPolicyPhase,
  type TorDialPolicySnapshot,
} from "./relay-tor-dial-policy";

export type TorLifecycleUxPhase = "off" | "warming" | "ready" | "degraded";

export const dialPhaseToLifecycleUxPhase = (
  dialPhase: TorDialPolicyPhase,
): TorLifecycleUxPhase => {
  switch (dialPhase) {
    case "clearnet":
      return "off";
    case "warming":
      return "warming";
    case "tor_armed":
      return "ready";
    case "degraded":
      return "degraded";
  }
};

export const resolveTorLifecycleUxPhase = (
  snapshot: TorDialPolicySnapshot,
): TorLifecycleUxPhase => (
  dialPhaseToLifecycleUxPhase(resolveTorDialPolicyPhase(snapshot))
);

/** i18n keys under settings.security.tor.phase.* */
export const torLifecycleUxI18nKey = (
  phase: TorLifecycleUxPhase,
): string | null => {
  switch (phase) {
    case "warming":
      return "settings.security.tor.phase.warming";
    case "ready":
      return "settings.security.tor.phase.ready";
    case "degraded":
      return "settings.security.tor.phase.degraded";
    case "off":
      return null;
  }
};

/** English defaults — must match TI-0 §4 / TI-3 design. */
export const TOR_LIFECYCLE_UX_DEFAULTS: Readonly<Record<
  Exclude<TorLifecycleUxPhase, "off">,
  string
>> = {
  warming:
    "Tor is starting — clearnet relays still in use until bootstrap finishes.",
  ready: "Tor ready — dialing Tor-viable relays only.",
  degraded:
    "Tor gateway unavailable — temporarily using clearnet. Restart Tor or check gateway.",
};

/** When preference ON failed but control plane is up (e.g. tor.exe exited / bootstrap stuck). */
export const TOR_BOOTSTRAP_FAILED_COPY =
  "Tor bootstrap not Ready — temporarily using clearnet. See the stuck reason below, or turn Tor off.";

export const getTorLifecycleUxDefaultCopy = (
  phase: TorLifecycleUxPhase,
  options?: Readonly<{
    gatewayReachable?: boolean;
    startFailed?: boolean;
    /** Operator-facing stall reason from gateway detail (TLS_ERROR / Stuck at N%). */
    stallReason?: string | null;
  }>,
): string | null => {
  if (phase === "off") {
    return null;
  }
  const stall = options?.stallReason?.trim();
  if (phase === "degraded" && stall && stall.length > 0) {
    return stall;
  }
  if (
    phase === "degraded"
    && options?.startFailed
    && options.gatewayReachable
  ) {
    return TOR_BOOTSTRAP_FAILED_COPY;
  }
  return TOR_LIFECYCLE_UX_DEFAULTS[phase];
};

/** Relays panel: Warming honesty (preference ON, dials still clearnet). */
export const getTorWarmingHonestyCopy = (): string => TOR_LIFECYCLE_UX_DEFAULTS.warming;

/** Relays panel: Degraded honesty (clearnet restored after Ready loss / start fail). */
export const getTorDegradedHonestyCopy = (): string => TOR_LIFECYCLE_UX_DEFAULTS.degraded;

/** Stale R4 string that must never ship in UI defaults. */
export const STALE_TOR_WS_CLEARNET_NOTE =
  "relay WS still clearnet until later";

export const TOR_GATEWAY_OWNERSHIP_NOTE_DEFAULT =
  "Gateway owns tor.exe and SOCKS. This app never opens SOCKS sockets.";
