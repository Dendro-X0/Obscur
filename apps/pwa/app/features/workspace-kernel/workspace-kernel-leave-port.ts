import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation } from "@/app/features/messaging/types";
import { publishRelayConfirmedCommunityLeave } from "@/app/features/groups/services/community-relay-confirmed-leave";
import type { SealedCommunityNostrPool } from "@/app/features/groups/services/sealed-community-relay-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { logWorkspaceKernelDiagnostic } from "./workspace-kernel-diagnostics";
import { assertWorkspaceLeaveRequiresRelayConfirmation as assertLeaveRelayConfirmation } from "@obscur/workspace-engine";
import {
  listManagedWorkspaceCommunityIdCandidates,
  resolveManagedWorkspaceCommunityId,
} from "./workspace-kernel-membership-scope";

export type WorkspaceKernelLeavePortStatus = "w1_landed";

export const workspaceKernelLeavePortStatus = (): WorkspaceKernelLeavePortStatus => "w1_landed";

export const assertWorkspaceLeaveRequiresRelayConfirmation = assertLeaveRelayConfirmation;

export type PublishWorkspaceKernelLeaveParams = Readonly<{
  pool: SealedCommunityNostrPool;
  group: GroupConversation;
  myPublicKeyHex: PublicKeyHex;
  myPrivateKeyHex: PrivateKeyHex;
  initialMembers?: ReadonlyArray<PublicKeyHex>;
  leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
}>;

/** Network-confirmed leave only — local commit via provider `leaveGroup(relayConfirmed: true)`. */
export const publishWorkspaceKernelLeave = async (
  params: PublishWorkspaceKernelLeaveParams,
): Promise<boolean> => {
  const groupId = params.group.groupId.trim();
  const relayUrl = params.group.relayUrl?.trim() ?? "";
  const profileId = getResolvedProfileId();
  const communityIdCandidates = listManagedWorkspaceCommunityIdCandidates({
    group: params.group,
    publicKeyHex: params.myPublicKeyHex,
    profileId,
  });
  const communityId = communityIdCandidates[0]
    ?? resolveManagedWorkspaceCommunityId({
      group: params.group,
      publicKeyHex: params.myPublicKeyHex,
      profileId,
    });

  const relayConfirmed = await publishRelayConfirmedCommunityLeave({
    pool: params.pool,
    groupId,
    relayUrl,
    communityId,
    communityIdCandidates,
    communityMode: params.group.communityMode ?? "managed_workspace",
    myPublicKeyHex: params.myPublicKeyHex,
    myPrivateKeyHex: params.myPrivateKeyHex,
    initialMembers: params.initialMembers,
    leftMemberPubkeys: params.leftMemberPubkeys,
    expelledMemberPubkeys: params.expelledMemberPubkeys,
  });

  if (!relayConfirmed) {
    logWorkspaceKernelDiagnostic("workspace.leave.rejected", { groupId, relayUrl, communityId });
  }

  return relayConfirmed;
};

/** @deprecated Use {@link publishWorkspaceKernelLeave} + provider local commit. */
export const executeWorkspaceKernelLeave = publishWorkspaceKernelLeave;
