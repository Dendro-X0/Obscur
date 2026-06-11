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

const normalizePubkey = (pubkey: string): string => pubkey.trim().toLowerCase();

const dedupePubkeys = (pubkeys: ReadonlyArray<PublicKeyHex>): ReadonlyArray<PublicKeyHex> => {
  const seen = new Set<string>();
  const out: PublicKeyHex[] = [];
  pubkeys.forEach((pubkey) => {
    const normalized = normalizePubkey(pubkey);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    out.push(pubkey);
  });
  return out;
};

export type ResolveCommunityInviteMemberBlocklistParams = Readonly<{
  communityMode?: CommunityMode | null;
  relayUrl?: string | null;
  coordinationDirectory: CoordinationMembershipMaterialization | null;
  hybridActiveMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  joinEvidenceMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
}>;

/** Pubkeys that should block a new community invite (already active members). */
export const resolveCommunityInviteMemberBlocklist = (
  params: ResolveCommunityInviteMemberBlocklistParams,
): ReadonlyArray<PublicKeyHex> => {
  if (shouldUseCoordinationMembershipAuthority(params.communityMode, params.relayUrl)) {
    const leftMembers = [
      ...(params.coordinationDirectory?.leftMemberPubkeys ?? []),
      ...(params.leftMemberPubkeys ?? []),
    ];
    const expelledMembers = [
      ...(params.coordinationDirectory?.expelledMemberPubkeys ?? []),
      ...(params.expelledMemberPubkeys ?? []),
    ];
    const terminal = new Set([
      ...leftMembers,
      ...expelledMembers,
    ].map(normalizePubkey));
    const fromDirectory = params.coordinationDirectory
      ? filterActiveCommunityMemberPubkeys({
        memberPubkeys: params.coordinationDirectory.activeMemberPubkeys,
        leftMembers,
        expelledMembers,
      })
      : [];
    const directoryNorm = new Set(fromDirectory.map(normalizePubkey));
    const joinEvidenceRepairs = (params.joinEvidenceMemberPubkeys ?? []).filter((pubkey) => {
      const normalized = normalizePubkey(pubkey);
      return normalized.length > 0
        && !terminal.has(normalized)
        && !directoryNorm.has(normalized);
    });
    return dedupePubkeys([...fromDirectory, ...joinEvidenceRepairs]);
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
