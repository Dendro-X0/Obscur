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
 * Invite / steward actions: prefer coordination roster projection when R1 applies.
 * Falls back to hybrid active set when projection not populated yet (e.g. right after create).
 */
export const resolveWorkspaceActionMemberPubkeys = (params: Readonly<{
  communityMode?: CommunityMode | null;
  coordinationProjectionPubkeys?: ReadonlyArray<PublicKeyHex> | null;
  hybridActiveMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
}>): ReadonlyArray<PublicKeyHex> => {
  const coordinationProjection = params.coordinationProjectionPubkeys ?? [];
  const useCoordination = shouldUseCoordinationMembershipAuthority(params.communityMode)
    && coordinationProjection.length > 0;
  const base = useCoordination ? coordinationProjection : params.hybridActiveMemberPubkeys;
  return filterActiveCommunityMemberPubkeys({
    memberPubkeys: base,
    leftMembers: params.leftMemberPubkeys,
    expelledMembers: params.expelledMemberPubkeys,
  });
};
