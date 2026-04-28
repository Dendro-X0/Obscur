/**
 * Community Relay Evidence Policy
 *
 * Defines when relay-based community membership data can be trusted
 * versus when to wait for more evidence. This prevents the thinner-snapshot
 * guard from rejecting valid member lists during relay warm-up.
 *
 * Per AGENTS.md Rule 3: Local state ≠ network truth; UI success requires
 * evidence-backed outcomes. But we must distinguish between:
 * - "Not enough evidence yet" (relay still warming up)
 * - "Evidence says member left" (legitimate removal)
 *
 * Canonical Owner: Community Ledger Reducer (uses this policy)
 */

export type RelayEvidenceConfidence =
  | "seed_only"           // Only initial seed data, no relay contact
  | "warming_up"          // Relay subscription active, <10s elapsed
  | "partial_eose"        // EOSE received but few events
  | "steady_state";       // Relay evidence stable

export type RelayEvidencePolicyParams = Readonly<{
  subscriptionEstablishedAt: number | null;
  lastEventReceivedAt: number | null;
  eoseReceivedAt: number | null;
  eventCount: number;
  nowMs: number;
}>;

const WARMING_UP_THRESHOLD_MS = 10000; // 10 seconds
const STEADY_STATE_MIN_EVENTS = 3;
const STEADY_STATE_QUIET_PERIOD_MS = 5000; // 5s without events = steady

/**
 * Determines the confidence level of relay evidence.
 *
 * Rules:
 * 1. If no subscription established → seed_only
 * 2. If <10s since subscription → warming_up
 * 3. If EOSE received and >3 events and 5s quiet → steady_state
 * 4. If EOSE received but few events → partial_eose
 */
export const resolveRelayEvidenceConfidence = (
  params: RelayEvidencePolicyParams,
): RelayEvidenceConfidence => {
  if (params.subscriptionEstablishedAt === null) {
    return "seed_only";
  }

  const timeSinceSubscription = params.nowMs - params.subscriptionEstablishedAt;
  if (timeSinceSubscription < WARMING_UP_THRESHOLD_MS) {
    return "warming_up";
  }

  if (params.eoseReceivedAt !== null) {
    const timeSinceLastEvent = params.lastEventReceivedAt !== null
      ? params.nowMs - params.lastEventReceivedAt
      : Infinity;

    if (
      params.eventCount >= STEADY_STATE_MIN_EVENTS &&
      timeSinceLastEvent > STEADY_STATE_QUIET_PERIOD_MS
    ) {
      return "steady_state";
    }

    return "partial_eose";
  }

  return "warming_up";
};

/**
 * Checks if thinner-snapshot guard should be relaxed based on evidence confidence.
 *
 * During warm-up, we allow thinner snapshots to replace seed-only data
 * because the seed may be stale or incomplete. Once we reach steady_state,
 * we enforce strict evidence requirements.
 */
export const shouldRelaxThinnerSnapshotGuard = (
  confidence: RelayEvidenceConfidence,
  currentMemberCount: number,
): boolean => {
  // If we only have seed data, always allow relay snapshot (even if thinner)
  // because seed might be stale and relay is the canonical source
  if (confidence === "seed_only") {
    return true;
  }

  // During warm-up, allow thinner snapshots if current data looks like seed
  // (seed typically only has 1-2 members: creator + local user)
  if (confidence === "warming_up" && currentMemberCount <= 2) {
    return true;
  }

  // Once we have partial or steady state, enforce strict guard
  return false;
};

/**
 * Formats confidence for diagnostics.
 */
export const formatRelayEvidenceConfidence = (
  confidence: RelayEvidenceConfidence,
  params: RelayEvidencePolicyParams,
): string => {
  const timeSinceSubscription = params.subscriptionEstablishedAt !== null
    ? Math.round((params.nowMs - params.subscriptionEstablishedAt) / 1000)
    : null;
  const timeSinceEOSE = params.eoseReceivedAt !== null
    ? Math.round((params.nowMs - params.eoseReceivedAt) / 1000)
    : null;

  return (
    `RelayEvidence[${confidence}]: ` +
    `sub=${timeSinceSubscription}s, ` +
    `eose=${timeSinceEOSE}s, ` +
    `events=${params.eventCount}`
  );
};
