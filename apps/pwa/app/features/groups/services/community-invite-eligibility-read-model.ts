/**
 * Phase 3 — Invite eligibility read model.
 *
 * Invite blocking uses coordination directory materialization (folded deltas),
 * NOT the monotonic participant display roster. Display roster may keep historical
 * participants visible; invite must follow authoritative membership truth.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityMode } from "../types";
import type { CoordinationMembershipMaterialization } from "./community-coordination-membership-materializer";
import {
  filterActiveCommunityMemberPubkeys,
  resolveInviteEligibleMemberPubkeys,
} from "./community-visible-members";
import { shouldUseCoordinationMembershipAuthority } from "./community-workspace-r1-policy";

export type ResolveCommunityInviteMemberBlocklistParams = Readonly<{
  communityMode?: CommunityMode | null;
  coordinationDirectory: CoordinationMembershipMaterialization | null;
  hybridActiveMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
}>;

/** Pubkeys that should block a new community invite (already active members). */
export const resolveCommunityInviteMemberBlocklist = (
  params: ResolveCommunityInviteMemberBlocklistParams,
): ReadonlyArray<PublicKeyHex> => {
  if (shouldUseCoordinationMembershipAuthority(params.communityMode)) {
    if (!params.coordinationDirectory) {
      return [];
    }
    return filterActiveCommunityMemberPubkeys({
      memberPubkeys: params.coordinationDirectory.activeMemberPubkeys,
      leftMembers: [
        ...params.coordinationDirectory.leftMemberPubkeys,
        ...(params.leftMemberPubkeys ?? []),
      ],
      expelledMembers: [
        ...params.coordinationDirectory.expelledMemberPubkeys,
        ...(params.expelledMemberPubkeys ?? []),
      ],
    });
  }

  return resolveInviteEligibleMemberPubkeys({
    activeMemberPubkeys: params.hybridActiveMemberPubkeys,
    leftMemberPubkeys: params.leftMemberPubkeys,
    expelledMemberPubkeys: params.expelledMemberPubkeys,
  });
};

export const isPubkeyBlockedFromCommunityInvite = (
  pubkey: string,
  blocklist: ReadonlyArray<PublicKeyHex>,
): boolean => {
  const normalized = pubkey.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return blocklist.some((entry) => entry.trim().toLowerCase() === normalized);
};
