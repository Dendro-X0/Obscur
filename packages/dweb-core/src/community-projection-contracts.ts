import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type {
  CommunityRoomKeyProjection,
  CommunitySendability,
  CommunitySendBlockReasonCode,
} from "./community-sendability-contracts";

export type CommunityLifecycleState =
  | "active"
  | "left"
  | "expelled"
  | "disbanded"
  | "tombstoned";

export type CommunityVisibilityState =
  | "visible"
  | "recovering"
  | "hidden_by_terminal_state";

export type CommunityMembershipStatus =
  | "joined"
  | "invited"
  | "pending"
  | "left"
  | "expelled"
  | "unknown";

export type CommunityMembershipSourceOfTruth =
  | "tombstone"
  | "ledger"
  | "reducer_replay"
  | "persisted_fallback";

export type CommunityContentState =
  | "visible"
  | "pending_key"
  | "quarantined"
  | "deleted";

export type CommunityDescriptorProjection = Readonly<{
  communityId: string;
  groupId: string;
  conversationId: string;
  relayScope: string;
  displayName: string;
  about?: string;
  avatarUrl?: string;
  lifecycleState: CommunityLifecycleState;
  visibilityState: CommunityVisibilityState;
  lastDescriptorEventId: string;
  lastDescriptorAtUnixMs: number;
}>;

export type CommunityMembershipProjection = Readonly<{
  communityId: string;
  status: CommunityMembershipStatus;
  sourceOfTruth: CommunityMembershipSourceOfTruth;
  joinedAtUnixMs?: number;
  leftAtUnixMs?: number;
  expelledAtUnixMs?: number;
  lastMembershipEventId?: string;
  lastMembershipEvidenceAtUnixMs?: number;
}>;

export type CommunityMemberProjection = Readonly<{
  memberPublicKeyHex: PublicKeyHex;
  status: "joined" | "left" | "expelled";
  lastEvidenceAtUnixMs: number;
  lastEventId?: string;
}>;

export type CommunityMembersProjection = Readonly<{
  communityId: string;
  members: ReadonlyArray<CommunityMemberProjection>;
  rosterVersion: number;
  lastRosterEvidenceAtUnixMs: number;
}>;

export type CommunityGovernanceProjection = Readonly<{
  communityId: string;
  activeVotes: ReadonlyArray<string>;
  resolvedVotes: ReadonlyArray<string>;
  policyState: Readonly<Record<string, string>>;
  moderationState: Readonly<Record<string, string>>;
  lastGovernanceEventId?: string;
  lastGovernanceAtUnixMs?: number;
}>;

export type CommunityContentTimelineEntry = Readonly<{
  logicalMessageId: string;
  communityId: string;
  keyEpoch: number | null;
  contentState: CommunityContentState;
  plaintextPreview: string;
  senderPublicKeyHex: PublicKeyHex;
  createdAtUnixMs: number;
  lastObservedAtUnixMs: number;
  sourceEventId: string;
  attachmentDescriptorIds: ReadonlyArray<string>;
}>;

export type CommunityMediaProjection = Readonly<{
  mediaDescriptorId: string;
  communityId: string;
  sourceLogicalMessageId: string;
  storageUrl: string;
  encryptedMetadataState: "unknown" | "available" | "missing";
  localCacheState: "uncached" | "cached" | "failed";
  contentAvailabilityState: "available" | "pending_key" | "quarantined" | "deleted";
}>;

export type RemovedCommunityProjection = Readonly<{
  communityId: string;
  removedAtUnixMs: number;
  reasonCode: string;
}>;

export type CommunityProjectionSnapshot = Readonly<{
  communitiesById: Readonly<Record<string, CommunityDescriptorProjection>>;
  membershipByCommunityId: Readonly<Record<string, CommunityMembershipProjection>>;
  membersByCommunityId: Readonly<Record<string, CommunityMembersProjection>>;
  governanceByCommunityId: Readonly<Record<string, CommunityGovernanceProjection>>;
  roomKeyStateByCommunityId: Readonly<Record<string, CommunityRoomKeyProjection>>;
  contentTimelineByCommunityId: Readonly<Record<string, ReadonlyArray<CommunityContentTimelineEntry>>>;
  mediaByCommunityId: Readonly<Record<string, ReadonlyArray<CommunityMediaProjection>>>;
  removedCommunityIds: Readonly<Record<string, RemovedCommunityProjection>>;
}>;

export type CommunityVisibilitySummary = Readonly<{
  communityId: string;
  lifecycleState: CommunityLifecycleState;
  visibilityState: CommunityVisibilityState;
  membershipStatus: CommunityMembershipStatus;
  sendability: CommunitySendability;
  sendBlockReasonCode?: CommunitySendBlockReasonCode;
}>;
