import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CoordinationMembershipDeltaRecord } from "@/app/features/groups/services/community-coordination-membership-client";
import {
  materializeCoordinationMembershipFromDeltas,
  type CoordinationMembershipMaterialization,
} from "@/app/features/groups/services/community-coordination-membership-materializer";

export type ComMemGateEvaluation = Readonly<{
  passed: boolean;
  reason: string;
  creatorView: CoordinationMembershipMaterialization;
  joinerView: CoordinationMembershipMaterialization;
}>;

const buildDelta = (params: Readonly<{
  seq: number;
  communityId: string;
  action: "join" | "leave";
  subjectPubkey: PublicKeyHex;
  actorPubkey: PublicKeyHex;
}>): CoordinationMembershipDeltaRecord => ({
  deltaId: `delta-${params.seq}`,
  communityId: params.communityId,
  seq: params.seq,
  action: params.action,
  subjectPubkey: params.subjectPubkey,
  actorPubkey: params.actorPubkey,
  createdAtUnixMs: 1_700_000_000_000 + params.seq,
  signature: "test-signature",
});

/** Programmatic COM-MEM scenario: creator join → peer join → peer leave. */
export const buildComMemTwoProfileScenarioDeltas = (params: Readonly<{
  communityId: string;
  creatorPubkey: PublicKeyHex;
  joinerPubkey: PublicKeyHex;
}>): ReadonlyArray<CoordinationMembershipDeltaRecord> => [
  buildDelta({
    seq: 1,
    communityId: params.communityId,
    action: "join",
    subjectPubkey: params.creatorPubkey,
    actorPubkey: params.creatorPubkey,
  }),
  buildDelta({
    seq: 2,
    communityId: params.communityId,
    action: "join",
    subjectPubkey: params.joinerPubkey,
    actorPubkey: params.joinerPubkey,
  }),
  buildDelta({
    seq: 3,
    communityId: params.communityId,
    action: "leave",
    subjectPubkey: params.joinerPubkey,
    actorPubkey: params.joinerPubkey,
  }),
];

export const evaluateComMemTwoProfileGate = (params: Readonly<{
  deltas: ReadonlyArray<CoordinationMembershipDeltaRecord>;
  creatorPubkey: PublicKeyHex;
  joinerPubkey: PublicKeyHex;
}>): ComMemGateEvaluation => {
  const afterJoin = materializeCoordinationMembershipFromDeltas(
    params.deltas.filter((delta) => delta.seq <= 2),
  );
  const afterLeave = materializeCoordinationMembershipFromDeltas(params.deltas);

  const creatorNormalized = params.creatorPubkey.trim().toLowerCase();
  const joinerNormalized = params.joinerPubkey.trim().toLowerCase();

  const joinPhaseOk = afterJoin.activeMemberPubkeys.some((pk) => pk.toLowerCase() === creatorNormalized)
    && afterJoin.activeMemberPubkeys.some((pk) => pk.toLowerCase() === joinerNormalized);

  const leavePhaseOk = afterLeave.activeMemberPubkeys.some((pk) => pk.toLowerCase() === creatorNormalized)
    && !afterLeave.activeMemberPubkeys.some((pk) => pk.toLowerCase() === joinerNormalized)
    && afterLeave.leftMemberPubkeys.some((pk) => pk.toLowerCase() === joinerNormalized);

  if (!joinPhaseOk) {
    return {
      passed: false,
      reason: "join_phase_failed",
      creatorView: afterJoin,
      joinerView: afterJoin,
    };
  }
  if (!leavePhaseOk) {
    return {
      passed: false,
      reason: "leave_phase_failed",
      creatorView: afterLeave,
      joinerView: afterLeave,
    };
  }

  return {
    passed: true,
    reason: "com_mem_ok",
    creatorView: afterLeave,
    joinerView: afterLeave,
  };
};
