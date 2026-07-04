export type WorkspaceMembershipTruth = Readonly<{
  activeMemberPubkeys: ReadonlyArray<string>;
  syncStatus: string;
}>;

export type WorkspaceRosterProjection = Readonly<{
  conversationId: string;
  groupId: string;
  relayUrl: string;
  communityId: string;
  activeMemberPubkeys: ReadonlyArray<string>;
  memberCount: number;
}>;

export type WorkspaceGroupRecord = Readonly<{
  id: string;
  profileId: string;
  name: string;
  relayUrl: string;
  kind: string;
  joinedAt: number;
}>;
