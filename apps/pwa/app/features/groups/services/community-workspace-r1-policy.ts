/**
 * R1 — workspace communities use coordination directory as membership authority.
 * @see docs/program/community-fork-decision-2026-05.md
 * @see docs/program/obscur-native-sqlite-policy.md (orthogonal persistence band)
 */

import type { GroupConversation } from "@/app/features/messaging/types";
import type { CommunityMode } from "../types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { isWorkspaceKernelAuthority } from "@/app/features/workspace-kernel/workspace-kernel-policy";
import { isWorkspaceR1MembershipEnforced } from "./community-dev-flags";
import {
  isCoordinationConfigured,
  readMembershipSyncMode,
} from "./community-membership-sync-mode";
import { isStrictManagedWorkspaceRelay } from "./strict-managed-workspace";
import { filterActiveCommunityMemberPubkeys } from "./community-visible-members";

export { isWorkspaceR1MembershipEnforced } from "./community-dev-flags";

/** Legacy join rows often omit communityMode; infer managed workspace from relay + kernel. */
export const resolveEffectiveCommunityMode = (
  communityMode: CommunityMode | null | undefined,
  relayUrl?: string | null,
): CommunityMode | undefined => {
  if (communityMode) {
    return communityMode;
  }
  if (
    isWorkspaceKernelAuthority()
    && isCoordinationConfigured()
    && isStrictManagedWorkspaceRelay(relayUrl)
  ) {
    return "managed_workspace";
  }
  return undefined;
};

export const enrichWorkspaceGroupConversation = (
  group: GroupConversation,
): GroupConversation => {
  const communityMode = resolveEffectiveCommunityMode(group.communityMode, group.relayUrl);
  if (!communityMode || communityMode === group.communityMode) {
    return group;
  }
  return { ...group, communityMode };
};

export const shouldUseCoordinationMembershipAuthority = (
  communityMode: CommunityMode | null | undefined,
  relayUrl?: string | null,
): boolean => {
  const effectiveMode = resolveEffectiveCommunityMode(communityMode, relayUrl);
  if (effectiveMode !== "managed_workspace" || !isCoordinationConfigured()) {
    return false;
  }
  if (isWorkspaceR1MembershipEnforced()) {
    return true;
  }
  return readMembershipSyncMode() === "coordination_preferred";
};

/**
 * Invite / steward actions: coordination directory only for managed_workspace (Path B B1).
 * No relay/chat hybrid widen when projection is empty or stale.
 */
export const resolveWorkspaceActionMemberPubkeys = (params: Readonly<{
  communityMode?: CommunityMode | null;
  coordinationProjectionPubkeys?: ReadonlyArray<PublicKeyHex> | null;
  hybridActiveMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
}>): ReadonlyArray<PublicKeyHex> => {
  if (shouldUseCoordinationMembershipAuthority(params.communityMode)) {
    return filterActiveCommunityMemberPubkeys({
      memberPubkeys: params.coordinationProjectionPubkeys ?? [],
      leftMembers: params.leftMemberPubkeys,
      expelledMembers: params.expelledMemberPubkeys,
    });
  }
  return filterActiveCommunityMemberPubkeys({
    memberPubkeys: params.hybridActiveMemberPubkeys,
    leftMembers: params.leftMemberPubkeys,
    expelledMembers: params.expelledMemberPubkeys,
  });
};
