import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation } from "@/app/features/messaging/types";
import {
  commitCommunityLeaveAfterRelayConfirmation,
  publishRelayConfirmedCommunityLeave,
} from "@/app/features/groups/services/community-relay-confirmed-leave";
import type { SealedCommunityNostrPool } from "@/app/features/groups/services/sealed-community-relay-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { logWorkspaceKernelDiagnostic } from "./workspace-kernel-diagnostics";
import { assertWorkspaceLeaveRequiresRelayConfirmation as assertLeaveRelayConfirmation } from "@obscur/workspace-engine";
import { removeWorkspaceGroupMetadata } from "./workspace-kernel-group-metadata-cache";
import { isWorkspaceKernelAuthority } from "./workspace-kernel-policy";
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
  skipDirectoryRefresh?: boolean;
}>;

/**
 * Network-confirmed leave only.
 * Prefer {@link leaveManagedWorkspaceMembership} for user leave (network + local commit).
 */
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
    skipDirectoryRefresh: params.skipDirectoryRefresh,
  });

  if (!relayConfirmed) {
    logWorkspaceKernelDiagnostic("workspace.leave.rejected", { groupId, relayUrl, communityId });
  }

  return relayConfirmed;
};

export type LeaveManagedWorkspaceMembershipParams = PublishWorkspaceKernelLeaveParams & Readonly<{
  /** Defaults to true under workspace-kernel authority. */
  tombstone?: boolean;
  skipDirectoryRefresh?: boolean;
}>;

export type LeaveManagedWorkspaceMembershipResult = Readonly<{
  ok: boolean;
  relayConfirmed: boolean;
}>;

/**
 * U4 sole user-leave orchestration: network evidence then local ledger/tombstone/metadata.
 * Ledger byte commit remains REL-005 via `commitCommunityLeaveAfterRelayConfirmation`.
 */
export const leaveManagedWorkspaceMembership = async (
  params: LeaveManagedWorkspaceMembershipParams,
): Promise<LeaveManagedWorkspaceMembershipResult> => {
  const relayConfirmed = await publishWorkspaceKernelLeave({
    ...params,
    skipDirectoryRefresh: params.skipDirectoryRefresh,
  });
  if (!relayConfirmed) {
    return { ok: false, relayConfirmed: false };
  }

  const profileId = getResolvedProfileId();
  const tombstone = params.tombstone ?? isWorkspaceKernelAuthority();
  commitCommunityLeaveAfterRelayConfirmation({
    publicKeyHex: params.myPublicKeyHex,
    group: params.group,
    profileId,
    tombstone,
  });
  removeWorkspaceGroupMetadata(params.myPublicKeyHex, profileId, params.group.id);
  logWorkspaceKernelDiagnostic("workspace.leave.committed", {
    groupId: params.group.groupId,
    relayUrl: params.group.relayUrl ?? null,
    conversationId: params.group.id,
    tombstone,
  });
  return { ok: true, relayConfirmed: true };
};
