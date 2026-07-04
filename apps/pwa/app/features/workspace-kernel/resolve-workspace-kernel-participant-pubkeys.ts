import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityMode } from "@/app/features/groups/types";
import type { CoordinationMembershipMaterialization } from "@/app/features/groups/services/community-coordination-membership-materializer";
import { filterActiveCommunityMemberPubkeys } from "@/app/features/groups/services/community-visible-members";
import { readWorkspaceKernelMembershipTruth } from "./workspace-kernel-roster-port";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

export type ResolveWorkspaceKernelParticipantPubkeysParams = Readonly<{
  communityId?: string;
  communityMode?: CommunityMode | null;
  relayUrl?: string | null;
  profileId?: string;
  localMemberPubkey?: PublicKeyHex | null;
  coordinationDirectory?: CoordinationMembershipMaterialization | null;
  leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
}>;

const normalizePubkey = (pubkey: string): string => pubkey.trim().toLowerCase();

/**
 * W3 roster read owner — membership-eligible pubkeys from coordination truth only.
 * No monotonic roster session or display-repair merges.
 */
export const resolveWorkspaceKernelParticipantPubkeys = (
  params: ResolveWorkspaceKernelParticipantPubkeysParams,
): ReadonlyArray<PublicKeyHex> => {
  const communityId = params.communityId?.trim() ?? "";
  if (!communityId) {
    return [];
  }

  const truth = readWorkspaceKernelMembershipTruth({
    communityId,
    communityMode: params.communityMode ?? undefined,
    relayUrl: params.relayUrl ?? undefined,
    profileId: params.profileId ?? getResolvedProfileId(),
    localMemberPubkey: params.localMemberPubkey,
  });

  const leftMembers = [
    ...(params.coordinationDirectory?.leftMemberPubkeys ?? []),
    ...(truth.leftMemberPubkeys ?? []),
    ...(params.leftMemberPubkeys ?? []),
  ];
  const expelledMembers = [
    ...(params.coordinationDirectory?.expelledMemberPubkeys ?? []),
    ...(truth.expelledMemberPubkeys ?? []),
    ...(params.expelledMemberPubkeys ?? []),
  ];

  const directoryActive = params.coordinationDirectory?.activeMemberPubkeys
    ?? truth.coordinationDirectory?.activeMemberPubkeys
    ?? truth.activeMemberPubkeys;

  return filterActiveCommunityMemberPubkeys({
    memberPubkeys: directoryActive.length > 0 ? directoryActive : truth.activeMemberPubkeys,
    leftMembers,
    expelledMembers,
  });
};

export const resolveWorkspaceKernelInviteBlocklistPubkeys = (
  params: ResolveWorkspaceKernelParticipantPubkeysParams,
): ReadonlyArray<PublicKeyHex> => (
  resolveWorkspaceKernelParticipantPubkeys(params)
);
