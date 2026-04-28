import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityRoomKeyRotationReason } from "./community-sendability-contracts";

export type CommunityControlEventSource =
  | "relay_live"
  | "relay_sync"
  | "backup_import"
  | "legacy_bridge";

export type CommunityEventFamily =
  | "descriptor"
  | "membership"
  | "governance"
  | "room_key_lifecycle"
  | "terminal_lifecycle";

export type CommunityGovernanceActionType =
  | "expel_member"
  | "restore_member"
  | "update_descriptor"
  | "rotate_room_key"
  | "policy_change";

export type CommunityGovernanceVote = "approve" | "reject" | "abstain";

export type CommunityGovernanceResolution = "accepted" | "rejected" | "expired";

export type CommunityTerminalReasonCode =
  | "disbanded"
  | "tombstoned"
  | "security_reset"
  | "manual_cleanup";

export type CommunityControlEventCommon = Readonly<{
  eventFamily: CommunityEventFamily;
  eventType: string;
  logicalEventId: string;
  idempotencyKey: string;
  communityId: string;
  groupId: string;
  relayScope: string;
  actorPublicKeyHex: PublicKeyHex;
  createdAtUnixMs: number;
  source: CommunityControlEventSource;
}>;

export type CommunityDescriptorCreatedEvent = CommunityControlEventCommon & Readonly<{
  eventFamily: "descriptor";
  eventType: "COMMUNITY_CREATED";
  descriptorVersion: number;
  metadata: Readonly<{
    displayName: string;
    about?: string;
    avatarUrl?: string;
    policyVersion?: string;
  }>;
}>;

export type CommunityDescriptorUpdatedEvent = CommunityControlEventCommon & Readonly<{
  eventFamily: "descriptor";
  eventType: "COMMUNITY_DESCRIPTOR_UPDATED";
  descriptorVersion: number;
  metadata: Readonly<{
    displayName?: string;
    about?: string;
    avatarUrl?: string;
    policyVersion?: string;
  }>;
}>;

export type CommunityMemberInvitedEvent = CommunityControlEventCommon & Readonly<{
  eventFamily: "membership";
  eventType: "COMMUNITY_MEMBER_INVITED";
  membershipVersion: number;
  subjectPublicKeyHex: PublicKeyHex;
}>;

export type CommunityMemberJoinedEvent = CommunityControlEventCommon & Readonly<{
  eventFamily: "membership";
  eventType: "COMMUNITY_MEMBER_JOINED";
  membershipVersion: number;
  subjectPublicKeyHex: PublicKeyHex;
}>;

export type CommunityMemberLeftEvent = CommunityControlEventCommon & Readonly<{
  eventFamily: "membership";
  eventType: "COMMUNITY_MEMBER_LEFT";
  membershipVersion: number;
  subjectPublicKeyHex: PublicKeyHex;
}>;

export type CommunityMemberExpelledEvent = CommunityControlEventCommon & Readonly<{
  eventFamily: "membership";
  eventType: "COMMUNITY_MEMBER_EXPELLED";
  membershipVersion: number;
  subjectPublicKeyHex: PublicKeyHex;
}>;

export type CommunityMembershipRestatedEvent = CommunityControlEventCommon & Readonly<{
  eventFamily: "membership";
  eventType: "COMMUNITY_MEMBERSHIP_RESTATED";
  membershipVersion: number;
  members: ReadonlyArray<Readonly<{
    memberPublicKeyHex: PublicKeyHex;
    status: "joined" | "left" | "expelled";
  }>>;
}>;

export type CommunityGovernanceProposedEvent = CommunityControlEventCommon & Readonly<{
  eventFamily: "governance";
  eventType: "COMMUNITY_GOVERNANCE_PROPOSED";
  governanceProposalId: string;
  governanceActionType: CommunityGovernanceActionType;
  quorumThreshold: number;
  proposalExpiresAtUnixMs?: number;
  targetPublicKeyHex?: PublicKeyHex;
  targetMetadataField?: string;
}>;

export type CommunityGovernanceVoteCastEvent = CommunityControlEventCommon & Readonly<{
  eventFamily: "governance";
  eventType: "COMMUNITY_GOVERNANCE_VOTE_CAST";
  governanceProposalId: string;
  governanceActionType: CommunityGovernanceActionType;
  voterPublicKeyHex: PublicKeyHex;
  vote: CommunityGovernanceVote;
}>;

export type CommunityGovernanceResolvedEvent = CommunityControlEventCommon & Readonly<{
  eventFamily: "governance";
  eventType: "COMMUNITY_GOVERNANCE_RESOLVED";
  governanceProposalId: string;
  governanceActionType: CommunityGovernanceActionType;
  resolution: CommunityGovernanceResolution;
  appliedEffects?: ReadonlyArray<string>;
}>;

export type CommunityRoomKeyRotationRequestedEvent = CommunityControlEventCommon & Readonly<{
  eventFamily: "room_key_lifecycle";
  eventType: "COMMUNITY_ROOM_KEY_ROTATION_REQUESTED";
  keyEpoch: number;
  rotationReason: CommunityRoomKeyRotationReason;
}>;

export type CommunityRoomKeyRotationActivatedEvent = CommunityControlEventCommon & Readonly<{
  eventFamily: "room_key_lifecycle";
  eventType: "COMMUNITY_ROOM_KEY_ROTATION_ACTIVATED";
  keyEpoch: number;
  rotationReason: CommunityRoomKeyRotationReason;
}>;

export type CommunityRoomKeySupersededEvent = CommunityControlEventCommon & Readonly<{
  eventFamily: "room_key_lifecycle";
  eventType: "COMMUNITY_ROOM_KEY_SUPERSEDED";
  keyEpoch: number;
  rotationReason: CommunityRoomKeyRotationReason;
}>;

export type CommunityDisbandedEvent = CommunityControlEventCommon & Readonly<{
  eventFamily: "terminal_lifecycle";
  eventType: "COMMUNITY_DISBANDED";
  reasonCode: CommunityTerminalReasonCode;
}>;

export type CommunityTombstonedEvent = CommunityControlEventCommon & Readonly<{
  eventFamily: "terminal_lifecycle";
  eventType: "COMMUNITY_TOMBSTONED";
  reasonCode: CommunityTerminalReasonCode;
}>;

export type CommunityControlEvent =
  | CommunityDescriptorCreatedEvent
  | CommunityDescriptorUpdatedEvent
  | CommunityMemberInvitedEvent
  | CommunityMemberJoinedEvent
  | CommunityMemberLeftEvent
  | CommunityMemberExpelledEvent
  | CommunityMembershipRestatedEvent
  | CommunityGovernanceProposedEvent
  | CommunityGovernanceVoteCastEvent
  | CommunityGovernanceResolvedEvent
  | CommunityRoomKeyRotationRequestedEvent
  | CommunityRoomKeyRotationActivatedEvent
  | CommunityRoomKeySupersededEvent
  | CommunityDisbandedEvent
  | CommunityTombstonedEvent;
