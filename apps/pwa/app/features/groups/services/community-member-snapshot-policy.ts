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
 * The fix: When relay evidence confidence is low (seed_only or warming_up with a
 * seed-sized roster), allow thinner snapshots to replace seed data. Once confidence
 * reaches partial_eose or steady_state, enforce strict evidence requirements.
 * `policyReasonCode` distinguishes confident applies, strict rejects, protected-member
 * blocks, and guard-relaxed applies (for `groups.membership_snapshot_projection_result`).
 *
 * Canonical Owner: **`group-provider.tsx`** (relay snapshot → **`resolveEnhancedSnapshotApplication`**); **`protectRemovalPubkeys`** must match **`mergeKnownParticipantSeedPubkeys`** inputs at that boundary.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  mergeMonotonicActiveCommunityMembers,
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
  /**
   * Pubkeys that must not be dropped from the roster solely because a thin relay
   * snapshot omitted them during low-confidence warm-up (e.g. persisted group
   * members or known-participant directory). Prefer the same union as
   * **`mergeKnownParticipantSeedPubkeys`** (directory ∪ persisted `memberPubkeys`)
   * so snapshot policy matches UI seed contracts.
   */
  protectRemovalPubkeys?: ReadonlyArray<PublicKeyHex> | ReadonlySet<string>;
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
    /** Thinner snapshot would be allowed by confidence, but applying it would drop a protected pubkey. */
    | "relay_evidence_relax_blocked_protected_member"
    | "relay_evidence_warming_up_strict"
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

  const protectRemovalSet = (() => {
    const raw = params.protectRemovalPubkeys;
    if (!raw) {
      return null;
    }
    const list = [...raw];
    return new Set(list.map((p) => p.trim()).filter((p) => p.length > 0));
  })();
  const relaxWouldDropProtectedMember = !!protectRemovalSet
    && baseApplication.removedWithoutEvidence.some((pk) => protectRemovalSet.has(pk.trim()));

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
    && !relaxWouldDropProtectedMember
  ) {
    const reasonCode: EnhancedSnapshotApplicationResult["reasonCode"] =
      confidence === "seed_only"
        ? "relay_evidence_seed_only_allowing_thinner"
        : "relay_evidence_warming_up_allowing_thinner";

    return {
      application: {
        shouldApply: true,
        reasonCode: "apply_snapshot_guard_relaxed",
        nextMemberPubkeys: mergeMonotonicActiveCommunityMembers(
          params.currentMemberPubkeys,
          params.incomingActiveMemberPubkeys,
          {
            excludePubkeys: [
              ...(params.leftMemberPubkeys ?? []),
              ...(params.expelledMemberPubkeys ?? []),
            ],
            additionalPubkeys: params.protectRemovalPubkeys
              ? [...params.protectRemovalPubkeys]
              : undefined,
          },
        ),
        removedWithoutEvidence: [],
      },
      confidence,
      guardRelaxed: true,
      reasonCode,
    };
  }

  // Otherwise, return base application with confidence context
  const reasonCode = resolveEnhancedSnapshotPolicyReasonCode({
    confidence,
    baseReasonCode: baseApplication.reasonCode,
    shouldRelax,
    relaxWouldDropProtectedMember,
  });

  return {
    application: baseApplication,
    confidence,
    guardRelaxed: false,
    reasonCode,
  };
};

type PolicyReasonContext = Readonly<{
  confidence: RelayEvidenceConfidence;
  baseReasonCode: CommunityMemberSnapshotApplication["reasonCode"];
  shouldRelax: boolean;
  relaxWouldDropProtectedMember: boolean;
}>;

const resolveEnhancedSnapshotPolicyReasonCode = (
  ctx: PolicyReasonContext,
): EnhancedSnapshotApplicationResult["reasonCode"] => {
  if (ctx.baseReasonCode !== "missing_removal_evidence") {
    return "relay_evidence_confident";
  }
  if (ctx.shouldRelax && ctx.relaxWouldDropProtectedMember) {
    return "relay_evidence_relax_blocked_protected_member";
  }
  if (!ctx.shouldRelax) {
    if (ctx.confidence === "warming_up") {
      return "relay_evidence_warming_up_strict";
    }
    if (ctx.confidence === "partial_eose") {
      return "relay_evidence_partial_eose_strict";
    }
    if (ctx.confidence === "steady_state") {
      return "relay_evidence_steady_state_strict";
    }
  }
  return "relay_evidence_confident";
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
