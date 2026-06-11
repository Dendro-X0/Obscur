import type { GroupConversation } from "@/app/features/messaging/types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityRosterProjection } from "@/app/features/groups/services/community-member-roster-projection";
import {
  readCommunityMembershipTruthSnapshot,
  type CommunityMembershipTruthSnapshot,
} from "@/app/features/groups/services/community-membership-truth";
import { readManagedWorkspaceMembership } from "./workspace-kernel-membership-port";
import { isWorkspaceKernelAuthority } from "./workspace-kernel-policy";

export type WorkspaceKernelRosterPortStatus = "w3_landed";

export const workspaceKernelRosterPortStatus = (): WorkspaceKernelRosterPortStatus => "w3_landed";

export const isWorkspaceKernelRosterPortReady = (): boolean => isWorkspaceKernelAuthority();

export const readWorkspaceKernelMembershipTruth = (params: Readonly<{
  communityId: string;
  communityMode?: GroupConversation["communityMode"];
  profileId?: string;
  localMemberPubkey?: PublicKeyHex | null;
}>): CommunityMembershipTruthSnapshot => (
  readCommunityMembershipTruthSnapshot({
    communityId: params.communityId,
    communityMode: params.communityMode,
    profileId: params.profileId,
    localMemberPubkey: params.localMemberPubkey,
  })
);

export const buildWorkspaceKernelRosterProjection = (
  group: GroupConversation,
  snapshot: CommunityMembershipTruthSnapshot,
): CommunityRosterProjection => {
  const activeMemberPubkeys = snapshot.activeMemberPubkeys;
  return {
    conversationId: group.id,
    groupId: group.groupId,
    relayUrl: group.relayUrl,
    communityId: group.communityId,
    activeMemberPubkeys,
    memberCount: Math.max(activeMemberPubkeys.length, 1),
  };
};

export const buildWorkspaceKernelRosterProjectionForGroup = (
  group: GroupConversation,
  params: Readonly<{
    profileId?: string;
    localMemberPubkey?: PublicKeyHex | null;
  }> = {},
): CommunityRosterProjection | null => {
  const communityId = group.communityId?.trim() ?? "";
  if (!communityId || group.communityMode !== "managed_workspace") {
    return null;
  }
  const snapshot = readWorkspaceKernelMembershipTruth({
    communityId,
    communityMode: group.communityMode,
    profileId: params.profileId,
    localMemberPubkey: params.localMemberPubkey,
  });
  if (snapshot.syncStatus === "not_workspace" || snapshot.syncStatus === "unconfigured") {
    return null;
  }
  void readManagedWorkspaceMembership(communityId, params.profileId);
  return buildWorkspaceKernelRosterProjection(group, snapshot);
};

export const buildWorkspaceKernelRosterIndex = (
  groups: ReadonlyArray<GroupConversation>,
  params: Readonly<{
    profileId?: string;
    localMemberPubkey?: PublicKeyHex | null;
  }> = {},
): Readonly<Record<string, CommunityRosterProjection>> => {
  const index: Record<string, CommunityRosterProjection> = {};
  groups.forEach((group) => {
    const projection = buildWorkspaceKernelRosterProjectionForGroup(group, params);
    if (projection) {
      index[group.id] = projection;
    }
  });
  return index;
};

export const resolveWorkspaceKernelActiveMemberPubkeys = (params: Readonly<{
  rosterProjection?: CommunityRosterProjection | null;
}>): ReadonlyArray<PublicKeyHex> => (
  params.rosterProjection?.activeMemberPubkeys ?? []
);
