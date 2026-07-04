import type { WorkspaceMembershipTruth, WorkspaceRosterProjection } from "./workspace-types";

export const buildWorkspaceRosterProjection = (params: Readonly<{
  conversationId: string;
  groupId: string;
  relayUrl: string;
  communityId: string;
  snapshot: WorkspaceMembershipTruth;
}>): WorkspaceRosterProjection => ({
  conversationId: params.conversationId,
  groupId: params.groupId,
  relayUrl: params.relayUrl,
  communityId: params.communityId,
  activeMemberPubkeys: [...params.snapshot.activeMemberPubkeys],
  memberCount: Math.max(params.snapshot.activeMemberPubkeys.length, 1),
});

export const resolveWorkspaceActiveMemberPubkeys = (
  projection?: WorkspaceRosterProjection | null,
): ReadonlyArray<string> => projection?.activeMemberPubkeys ?? [];

export const assertWorkspaceLeaveRequiresRelayConfirmation = (relayConfirmed: boolean): void => {
  if (!relayConfirmed) {
    throw new Error("relayConfirmed required");
  }
};
