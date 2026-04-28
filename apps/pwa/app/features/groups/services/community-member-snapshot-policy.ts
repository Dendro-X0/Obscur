/**
 * Community Member Snapshot Policy
 *
 * Enhanced snapshot application policy that considers relay evidence confidence.
 * Fixes the bug where member list reverts to single member on refresh during
 * relay warm-up.
 *
 * The issue: The thinner-snapshot guard in `resolveCommunityMemberSnapshotApplication`
 * rejects incoming snapshots that have fewer members than current state, assuming
 * missing members were "removed without evidence". But during relay warm-up,
 * the initial "current state" may be optimistic seed data, not evidence-based.
 *
 * The fix: When relay evidence confidence is low (seed_only or warming_up),
 * allow thinner snapshots to replace seed data. Once confidence reaches
 * partial_eose or steady_state, enforce strict evidence requirements.
 *
 * Canonical Owner: group-provider.tsx (snapshot application boundary)
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  resolveCommunityMemberSnapshotApplication,
  type CommunityMemberSnapshotApplication,
} from "./community-member-roster-projection";
import {
  resolveRelayEvidenceConfidence,
  shouldRelaxThinnerSnapshotGuard,
  type RelayEvidenceConfidence,
  type RelayEvidencePolicyParams,
} from "./community-relay-evidence-policy";

export type EnhancedSnapshotApplicationParams = Readonly<{
  currentMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  incomingActiveMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  // Relay evidence for confidence assessment
  relayEvidenceParams: RelayEvidencePolicyParams;
  // Source tracking for diagnostics
  sourceHint: "relay_snapshot" | "local_persistence" | "ledger_projection";
}>;

export type EnhancedSnapshotApplicationResult = Readonly<{
  application: CommunityMemberSnapshotApplication;
  confidence: RelayEvidenceConfidence;
  guardRelaxed: boolean;
  reasonCode:
    | "relay_evidence_confident"
    | "relay_evidence_seed_only_allowing_thinner"
    | "relay_evidence_warming_up_allowing_thinner"
    | "relay_evidence_partial_eose_strict"
    | "relay_evidence_steady_state_strict";
}>;

/**
 * Enhanced snapshot application that considers relay evidence confidence.
 *
 * This function wraps the base `resolveCommunityMemberSnapshotApplication`
 * but relaxes the thinner-snapshot guard when:
 * 1. Confidence is "seed_only" (no relay contact yet) → allow any relay data
 * 2. Confidence is "warming_up" AND current members look like seed data (≤2)
 *
 * Once confidence reaches "partial_eose" or "steady_state", the strict guard
 * is enforced to prevent member disappearance without evidence.
 */
export const resolveEnhancedSnapshotApplication = (
  params: EnhancedSnapshotApplicationParams,
): EnhancedSnapshotApplicationResult => {
  const confidence = resolveRelayEvidenceConfidence(params.relayEvidenceParams);
  const baseApplication = resolveCommunityMemberSnapshotApplication({
    currentMemberPubkeys: params.currentMemberPubkeys,
    incomingActiveMemberPubkeys: params.incomingActiveMemberPubkeys,
    leftMemberPubkeys: params.leftMemberPubkeys,
    expelledMemberPubkeys: params.expelledMemberPubkeys,
  });

  // Check if we should relax the guard based on confidence
  const shouldRelax = shouldRelaxThinnerSnapshotGuard(
    confidence,
    params.currentMemberPubkeys.length,
  );

  // If base application was rejected due to thinner snapshot, but we should
  // relax the guard, override the decision
  if (
    shouldRelax &&
    baseApplication.reasonCode === "missing_removal_evidence"
  ) {
    const reasonCode: EnhancedSnapshotApplicationResult["reasonCode"] =
      confidence === "seed_only"
        ? "relay_evidence_seed_only_allowing_thinner"
        : "relay_evidence_warming_up_allowing_thinner";

    return {
      application: {
        shouldApply: true,
        reasonCode: "apply_snapshot", // Override to allow
        nextMemberPubkeys: params.incomingActiveMemberPubkeys,
        removedWithoutEvidence: [], // Clear the "without evidence" list
      },
      confidence,
      guardRelaxed: true,
      reasonCode,
    };
  }

  // Otherwise, return base application with confidence context
  const reasonCode: EnhancedSnapshotApplicationResult["reasonCode"] =
    confidence === "seed_only"
      ? "relay_evidence_seed_only_allowing_thinner"
      : confidence === "warming_up"
        ? "relay_evidence_warming_up_allowing_thinner"
        : confidence === "partial_eose"
          ? "relay_evidence_partial_eose_strict"
          : "relay_evidence_steady_state_strict";

  return {
    application: baseApplication,
    confidence,
    guardRelaxed: false,
    reasonCode,
  };
};

/**
 * Formats the enhanced application result for diagnostics.
 */
export const formatEnhancedSnapshotApplication = (
  result: EnhancedSnapshotApplicationResult,
): string => {
  const app = result.application;
  return (
    `SnapshotApplication[${app.shouldApply ? "APPLY" : "REJECT"}]: ` +
    `reason=${app.reasonCode}, ` +
    `confidence=${result.confidence}, ` +
    `guardRelaxed=${result.guardRelaxed}, ` +
    `policyReason=${result.reasonCode}, ` +
    `nextCount=${app.nextMemberPubkeys.length}, ` +
    `removedWithoutEvidence=${app.removedWithoutEvidence.length}`
  );
};
