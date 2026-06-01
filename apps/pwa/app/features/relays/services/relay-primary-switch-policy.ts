import type { RelayHealthHint } from "./relay-primary-selector";

/** Minimum gap between non-emergency primary switches (prevents reconcile/failover ping-pong). */
export const RELAY_PRIMARY_SWITCH_MIN_INTERVAL_MS = 4000;

const findHint = (
  url: string,
  hints: ReadonlyArray<RelayHealthHint>,
): RelayHealthHint | undefined => hints.find((hint) => hint.url === url);

export const isEmergencyRelayPrimarySwitch = (
  primaryUrl: string | null,
  hints: ReadonlyArray<RelayHealthHint>,
): boolean => {
  if (!primaryUrl) {
    return true;
  }
  const hint = findHint(primaryUrl, hints);
  if (!hint || hint.isCircuitOpen) {
    return true;
  }
  if (!hint.isOpen && !hint.isWritable) {
    return true;
  }
  return false;
};

export const shouldAllowRelayPrimarySwitch = (params: Readonly<{
  nowUnixMs: number;
  lastSwitchAtUnixMs: number;
  emergency: boolean;
}>): boolean => {
  if (params.emergency) {
    return true;
  }
  return params.nowUnixMs - params.lastSwitchAtUnixMs >= RELAY_PRIMARY_SWITCH_MIN_INTERVAL_MS;
};
