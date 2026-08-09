/**
 * TI-1: Tor dial policy phase — Ready-gate for Tor-viable pool subtraction.
 * Preference ON alone must never empty the clearnet dial pool.
 */

export type TorDialPolicyPhase =
  | "clearnet"
  | "warming"
  | "tor_armed"
  | "degraded";

export type TorDialPolicySnapshot = Readonly<{
  /** User Tor preference (native `configured`). */
  preferenceOn: boolean;
  /** Gateway Bootstrapped 100%. */
  lifecycleReady: boolean;
  /** Gateway HTTP control plane answered. */
  gatewayReachable: boolean;
  /** Sticky: true after this session observed lifecycleReady while preference ON. */
  everReadyWhilePreferred: boolean;
  /** Native start failed / error state while preference ON. */
  startFailed: boolean;
}>;

/**
 * Resolve dial policy phase from Tor lifecycle snapshot.
 *
 * - clearnet: preference OFF
 * - warming: preference ON, not Ready yet, no prior Ready / start failure
 * - tor_armed: preference ON + Ready + gateway reachable → Tor-viable subtract
 * - degraded: preference ON, lost Ready or start failed → restore clearnet (D1)
 */
export const resolveTorDialPolicyPhase = (
  snapshot: TorDialPolicySnapshot,
): TorDialPolicyPhase => {
  if (!snapshot.preferenceOn) {
    return "clearnet";
  }

  const armed = snapshot.lifecycleReady && snapshot.gatewayReachable;
  if (armed) {
    return "tor_armed";
  }

  if (snapshot.everReadyWhilePreferred || snapshot.startFailed) {
    return "degraded";
  }

  return "warming";
};

/** True only when NativeRelay must dial Tor-viable endpoints (subtract CF). */
export const shouldUseTorViableDialPool = (phase: TorDialPolicyPhase): boolean => (
  phase === "tor_armed"
);

export const resolveDmUrlsForTorDialPhase = <T,>(params: Readonly<{
  phase: TorDialPolicyPhase;
  clearnetUrls: ReadonlyArray<T>;
  torViableUrls: ReadonlyArray<T>;
}>): ReadonlyArray<T> => (
  shouldUseTorViableDialPool(params.phase)
    ? params.torViableUrls
    : params.clearnetUrls
);
