import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  materializeCoordinationMembershipFromDeltas,
  type CoordinationMembershipMaterialization,
} from "@/app/features/groups/services/community-coordination-membership-materializer";
import type { CoordinationMembershipDeltaRecord } from "@/app/features/groups/services/community-coordination-membership-client";
import { buildWorkspaceKernelRosterProjection } from "./workspace-kernel-roster-port";
import type { GroupConversation } from "@/app/features/messaging/types";
import { readCommunityMembershipTruthSnapshot } from "@/app/features/groups/services/community-membership-truth";

export type ComRosterGateEvaluation = Readonly<{
  passed: boolean;
  reason: string;
  afterJoin: CoordinationMembershipMaterialization;
  afterLeave: CoordinationMembershipMaterialization;
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

const stubGroup = (communityId: string): GroupConversation => ({
  kind: "group",
  id: `community:${communityId}`,
  communityId,
  groupId: "group-1",
  relayUrl: "ws://localhost:7000",
  communityMode: "managed_workspace",
  displayName: "Ops",
  memberPubkeys: [],
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(),
  access: "invite-only",
  memberCount: 1,
  adminPubkeys: [],
});

/** COM-ROSTER: coordination directory roster matches join/leave materialization. */
export const evaluateComRosterTwoProfileGate = (params: Readonly<{
  communityId: string;
  creatorPubkey: PublicKeyHex;
  joinerPubkey: PublicKeyHex;
}>): ComRosterGateEvaluation => {
  const joinDeltas = [
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
  ];
  const leaveDeltas = [
    ...joinDeltas,
    buildDelta({
      seq: 3,
      communityId: params.communityId,
      action: "leave",
      subjectPubkey: params.joinerPubkey,
      actorPubkey: params.joinerPubkey,
    }),
  ];

  const afterJoin = materializeCoordinationMembershipFromDeltas(joinDeltas);
  const afterLeave = materializeCoordinationMembershipFromDeltas(leaveDeltas);
  const group = stubGroup(params.communityId);

  const joinProjection = buildWorkspaceKernelRosterProjection(group, {
    syncStatus: "fresh",
    coordinationDirectory: afterJoin,
    activeMemberPubkeys: afterJoin.activeMemberPubkeys,
    leftMemberPubkeys: afterJoin.leftMemberPubkeys,
    expelledMemberPubkeys: afterJoin.expelledMemberPubkeys,
    inviteBlocklistPubkeys: afterJoin.activeMemberPubkeys,
  });

  const leaveProjection = buildWorkspaceKernelRosterProjection(group, {
    syncStatus: "fresh",
    coordinationDirectory: afterLeave,
    activeMemberPubkeys: afterLeave.activeMemberPubkeys,
    leftMemberPubkeys: afterLeave.leftMemberPubkeys,
    expelledMemberPubkeys: afterLeave.expelledMemberPubkeys,
    inviteBlocklistPubkeys: afterLeave.activeMemberPubkeys,
  });

  const creatorNorm = params.creatorPubkey.trim().toLowerCase();
  const joinerNorm = params.joinerPubkey.trim().toLowerCase();

  const joinOk = joinProjection.activeMemberPubkeys.some((pk) => pk.toLowerCase() === creatorNorm)
    && joinProjection.activeMemberPubkeys.some((pk) => pk.toLowerCase() === joinerNorm);

  const leaveOk = leaveProjection.activeMemberPubkeys.some((pk) => pk.toLowerCase() === creatorNorm)
    && !leaveProjection.activeMemberPubkeys.some((pk) => pk.toLowerCase() === joinerNorm);

  if (!joinOk) {
    return { passed: false, reason: "roster_join_phase_failed", afterJoin, afterLeave };
  }
  if (!leaveOk) {
    return { passed: false, reason: "roster_leave_phase_failed", afterJoin, afterLeave };
  }

  const truthAfterLeave = readCommunityMembershipTruthSnapshot({
    communityId: params.communityId,
    communityMode: "managed_workspace",
  });
  void truthAfterLeave;

  return { passed: true, reason: "com_roster_ok", afterJoin, afterLeave };
};
