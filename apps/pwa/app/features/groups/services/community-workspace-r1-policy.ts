/**
 * R1 — workspace communities use coordination directory as membership authority.
 * @see docs/program/community-fork-decision-2026-05.md
 * @see docs/program/obscur-native-sqlite-policy.md (orthogonal persistence band)
 */

import type { CommunityMode } from "../types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { isWorkspaceR1MembershipEnforced } from "./community-dev-flags";
import {
  isCoordinationConfigured,
  readMembershipSyncMode,
} from "./community-membership-sync-mode";
import { filterActiveCommunityMemberPubkeys } from "./community-visible-members";

export { isWorkspaceR1MembershipEnforced } from "./community-dev-flags";

export const shouldUseCoordinationMembershipAuthority = (
  communityMode: CommunityMode | null | undefined,
): boolean => {
  if (communityMode !== "managed_workspace" || !isCoordinationConfigured()) {
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
