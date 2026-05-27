import type {
  CommunityControlEvent,
  CommunityMemberExpelledEvent,
  CommunityMemberJoinedEvent,
  CommunityMemberLeftEvent,
} from "@dweb/core/community-control-event-contracts";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { SemanticCommunityMemberEvent } from "@dweb/transport-contracts";

export type CommunityMembershipScope = Readonly<{
  groupId: string;
  communityId: string;
  relayUrl: string;
  myPublicKeyHex: PublicKeyHex | null;
  profileId?: string;
}>;

export type MembershipControlEventInput = Readonly<{
  eventType: CommunityMemberJoinedEvent["eventType"]
    | CommunityMemberLeftEvent["eventType"]
    | CommunityMemberExpelledEvent["eventType"];
  logicalEventId: string;
  createdAtUnixMs: number;
  subjectPublicKeyHex: PublicKeyHex;
}>;

export type MembershipStateSnapshot = Readonly<{
  leftMembers: ReadonlyArray<PublicKeyHex>;
  expelledMembers: ReadonlyArray<PublicKeyHex>;
  membershipStatus: "unknown" | "member" | "none" | "not_member";
  disbandedAtUnixMs?: number;
}>;

export type MembershipStatePatch = Readonly<{
  leftMembers?: ReadonlyArray<PublicKeyHex>;
  expelledMembers?: ReadonlyArray<PublicKeyHex>;
  membershipStatus?: MembershipStateSnapshot["membershipStatus"];
  disbandedAtUnixMs?: number;
}>;

export type MembershipControlApplyResult = Readonly<{
  suppressed: boolean;
  crdtAddMember?: PublicKeyHex;
  crdtRemoveMember?: PublicKeyHex;
  crdtRemoveAllMembers?: boolean;
  statePatch?: MembershipStatePatch;
}>;

export type CommunityMessageParticipationRow = Readonly<{
  pubkey?: string | null;
  created_at?: number;
}>;

/**
 * Canonical membership control owner (v1.9.1 B1).
 * App binds `communityMembershipPortOwner` at gateway install time.
 */
export type CommunityMembershipPort = Readonly<{
  readonly ownerId: string;
  createMembershipControlEvent(
    scope: CommunityMembershipScope,
    input: MembershipControlEventInput,
  ): Extract<CommunityControlEvent, Readonly<{ eventFamily: "membership" }>>;
  applyMembershipControlEvent(params: Readonly<{
    event: Extract<CommunityControlEvent, Readonly<{ eventFamily: "membership" }>>;
    prev: MembershipStateSnapshot;
    myPublicKeyHex: PublicKeyHex | null;
    communityMessages: ReadonlyArray<CommunityMessageParticipationRow>;
    disbandedAtUnixMs?: number;
  }>): MembershipControlApplyResult;
  applyDisbandedControlEvent(params: Readonly<{
    createdAtUnixMs: number;
  }>): Readonly<{ crdtRemoveAllMembers: true; statePatch: MembershipStatePatch }>;
  applySemanticMemberEvent(params: Readonly<{
    semantic: SemanticCommunityMemberEvent;
    scope: CommunityMembershipScope;
    prev: MembershipStateSnapshot;
    myPublicKeyHex: PublicKeyHex | null;
    communityMessages: ReadonlyArray<CommunityMessageParticipationRow>;
    disbandedAtUnixMs?: number;
  }>): Readonly<{
    suppressed: boolean;
    event: Extract<CommunityControlEvent, Readonly<{ eventFamily: "membership" }>> | null;
    deferKey: string | null;
    apply: MembershipControlApplyResult;
  }>;
  persistTerminalMembershipSnapshot(params: Readonly<{
    scope: CommunityMembershipScope;
    leftMembers: ReadonlyArray<PublicKeyHex>;
    expelledMembers: ReadonlyArray<PublicKeyHex>;
    disbandedAtUnixMs?: number | null;
  }>): void;
  clearTerminalMembershipSnapshot(scope: CommunityMembershipScope): void;
}>;
