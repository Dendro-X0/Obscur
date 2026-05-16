import type { PublicKeyHex } from "@dweb/storage-contracts/scoped-context";

export type RelayEvidenceConfidence =
  | "seed_only"
  | "warming_up"
  | "partial_eose"
  | "steady_state"
  | "unknown";

export type CommunityKnownParticipantDirectoryContract = Readonly<{
  conversationId: string;
  groupId: string;
  relayUrl: string;
  communityId?: string;
  participantPubkeys: ReadonlyArray<PublicKeyHex>;
  participantCount: number;
}>;

export type CommunityKnownParticipantsEntryContract = Readonly<{
  conversationId: string;
  groupId: string;
  relayUrl: string;
  communityId?: string;
  participantPubkeys: ReadonlyArray<PublicKeyHex>;
  updatedAtUnixMs: number;
}>;

export type GroupConversationRosterContract = Readonly<{
  id: string;
  groupId: string;
  relayUrl: string;
  communityId?: string;
  memberPubkeys?: ReadonlyArray<PublicKeyHex>;
  memberCount?: number;
}>;

export type ResolveCommunitySeedMemberPubkeysFromDirectoryParams = Readonly<{
  directory: CommunityKnownParticipantDirectoryContract | null | undefined;
  persistedGroupMemberPubkeys?: ReadonlyArray<PublicKeyHex> | null;
  projectionMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  localMemberPubkey?: PublicKeyHex | null;
}>;

export type ResolveActiveCommunityMemberPubkeysFromConversationParams = Readonly<{
  communityMessages: ReadonlyArray<Readonly<{ pubkey?: string | null }>>;
  seededMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  projectionMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  localMemberPubkey?: PublicKeyHex | null;
  leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
}>;

export type ActiveCommunityMemberPubkeysResolution = Readonly<{
  activeMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  authorEvidencePubkeys: ReadonlyArray<PublicKeyHex>;
}>;

export type StabilizeCommunityMemberPubkeysParams = Readonly<{
  previousMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  nextMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  relayEvidenceConfidence?: RelayEvidenceConfidence;
}>;

export type StabilizeCommunityMemberPubkeysResult = Readonly<{
  shouldApply: boolean;
  reasonCode: "equivalent" | "apply_snapshot" | "apply_snapshot_guard_relaxed" | "missing_removal_evidence";
  nextMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  removedWithoutEvidence: ReadonlyArray<PublicKeyHex>;
  confidence: RelayEvidenceConfidence;
  guardRelaxed: boolean;
}>;

export type ResolveCommunityRosterSnapshotNextMembersParams = Readonly<{
  currentMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  snapshotNextMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  protectRemovalPubkeys?: ReadonlyArray<PublicKeyHex>;
  guardRelaxed?: boolean;
}>;

export type PersistKnownParticipantDirectoryIfWidenedParams = Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
  directory: CommunityKnownParticipantDirectoryContract;
  persistedGroupMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  storedEntry?: CommunityKnownParticipantsEntryContract;
}>;

export type PersistObservedKnownParticipantsParams = Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
  entry: CommunityKnownParticipantsEntryContract;
}>;

export type PersistHydratedGroupKnownParticipantsParams = Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
  group: GroupConversationRosterContract;
  additionalParticipantPubkeys?: ReadonlyArray<PublicKeyHex>;
}>;

/** R2 — community roster materialization port (shared contract). */
export type CommunityRosterMaterializationPortContract = Readonly<{
  resolveAuthorEvidencePubkeysFromMessages: (
    messages: ReadonlyArray<Readonly<{ pubkey?: string | null }>>,
  ) => ReadonlyArray<PublicKeyHex>;
  resolveSeedMemberPubkeysFromDirectory: (
    params: ResolveCommunitySeedMemberPubkeysFromDirectoryParams,
  ) => ReadonlyArray<PublicKeyHex>;
  resolveActiveMemberPubkeysFromConversation: (
    params: ResolveActiveCommunityMemberPubkeysFromConversationParams,
  ) => ActiveCommunityMemberPubkeysResolution;
  stabilizeMemberPubkeys: (
    params: StabilizeCommunityMemberPubkeysParams,
  ) => StabilizeCommunityMemberPubkeysResult;
  resolveSnapshotNextMembers: (
    params: ResolveCommunityRosterSnapshotNextMembersParams,
  ) => ReadonlyArray<PublicKeyHex>;
  persistKnownParticipantDirectoryIfWidened: (
    params: PersistKnownParticipantDirectoryIfWidenedParams,
  ) => boolean;
  persistObservedKnownParticipants: (params: PersistObservedKnownParticipantsParams) => void;
  persistHydratedGroupKnownParticipants: (params: PersistHydratedGroupKnownParticipantsParams) => void;
}>;
