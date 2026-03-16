import type { RelayReadinessState, RelayRecoverySnapshot } from "./relay-recovery-policy";

export const getRelayReadinessBannerCopy = (snapshot: RelayRecoverySnapshot): string | null => {
  switch (snapshot.readiness) {
    case "recovering":
      return "Obscur is recovering the relay connection. Delivery can resume once writable relays are back.";
    case "degraded":
      return "Relay connection is degraded. Delivery may be partial, but Obscur will only show success with relay evidence.";
    case "offline":
      return "Relay connection is offline. Relay-dependent actions are temporarily unavailable.";
    default:
      return null;
  }
};

export const getRelaySendBlockCopy = (snapshot: Pick<RelayRecoverySnapshot, "readiness" | "writableRelayCount">): string | null => {
  if (snapshot.writableRelayCount > 0) {
    return null;
  }
  switch (snapshot.readiness) {
    case "recovering":
      return "Obscur is still recovering the connection. You can queue this now and it will retry as soon as relays come back.";
    case "offline":
      return "No writable relays are available right now. Queue the invitation and Obscur will retry automatically after recovery.";
    case "degraded":
      return "Writable relays are unavailable right now. Obscur can queue the invitation and wait for stronger relay evidence.";
    default:
      return "No writable relays are available right now. Obscur can retry automatically once the connection returns.";
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
