import type { MembershipDeltaAction } from "@dweb/coordination-contracts";
import type { SemanticCommunityMemberEvent } from "@dweb/transport-contracts";

export type CoordinationMembershipDelta = Readonly<{
  communityId: string;
  seq: number;
  action: MembershipDeltaAction;
  subjectPubkey: string;
  actorPubkey: string;
  createdAtUnixMs: number;
}>;

const toSemanticType = (
  action: MembershipDeltaAction,
): SemanticCommunityMemberEvent["type"] | null => {
  switch (action) {
    case "join":
      return "COMMUNITY_MEMBER_JOINED";
    case "leave":
      return "COMMUNITY_MEMBER_LEFT";
    case "expel":
      return "COMMUNITY_MEMBER_EXPELLED";
    default:
      return null;
  }
};

export const mapCoordinationDeltaToSemanticCommunityEvent = (
  delta: CoordinationMembershipDelta,
): SemanticCommunityMemberEvent | null => {
  const type = toSemanticType(delta.action);
  if (!type) {
    return null;
  }
  return {
    type,
    communityId: delta.communityId,
    subjectPublicKeyHex: delta.subjectPubkey,
    actorPublicKeyHex: delta.actorPubkey,
    createdAtUnixMs: delta.createdAtUnixMs,
    logicalEventId: `coord:${delta.communityId}:${delta.seq}`,
    source: "obscur_coordination",
  };
};
