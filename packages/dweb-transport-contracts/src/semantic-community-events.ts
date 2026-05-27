export type TransportKind = "nostr" | "obscur_coordination" | "team_relay";

export type SemanticCommunityMemberEventType =
  | "COMMUNITY_MEMBER_JOINED"
  | "COMMUNITY_MEMBER_LEFT"
  | "COMMUNITY_MEMBER_EXPELLED";

export type SemanticCommunityMemberEvent = Readonly<{
  type: SemanticCommunityMemberEventType;
  communityId: string;
  subjectPublicKeyHex: string;
  actorPublicKeyHex: string;
  createdAtUnixMs: number;
  logicalEventId: string;
  source: TransportKind;
}>;

export type SemanticCommunityDirectoryHintEvent = Readonly<{
  type: "COMMUNITY_DIRECTORY_HINT";
  communityId: string;
  pubkeys: readonly string[];
  confidence: "hint";
  source: TransportKind;
}>;

export type SemanticCommunityEvent =
  | SemanticCommunityMemberEvent
  | SemanticCommunityDirectoryHintEvent;

export const isSemanticCommunityMemberEvent = (
  event: SemanticCommunityEvent,
): event is SemanticCommunityMemberEvent => (
  event.type === "COMMUNITY_MEMBER_JOINED"
  || event.type === "COMMUNITY_MEMBER_LEFT"
  || event.type === "COMMUNITY_MEMBER_EXPELLED"
);
