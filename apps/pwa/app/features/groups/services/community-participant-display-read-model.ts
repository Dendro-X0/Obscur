/**
 * Participant list display owner (distinct from widen-only discovery session).
 *
 * Managed workspace + coordination: show directory active members only.
 * Otherwise: monotonic roster with terminal leave/expel exclusions applied.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityMode } from "../types";
import type { CoordinationMembershipMaterialization } from "./community-coordination-membership-materializer";
import { usesCoordinationMembershipTruth } from "./community-membership-truth";

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

export const mergeCoordinationTerminalMemberPubkeys = (
  statePubkeys: ReadonlyArray<PublicKeyHex>,
  coordinationDirectory: CoordinationMembershipMaterialization | null,
  kind: "left" | "expelled",
): ReadonlyArray<PublicKeyHex> => {
  const fromDirectory = kind === "left"
    ? coordinationDirectory?.leftMemberPubkeys ?? []
    : coordinationDirectory?.expelledMemberPubkeys ?? [];
  return dedupePubkeys([...statePubkeys, ...fromDirectory]);
};

const resolveCoordinationActiveDisplayPubkeys = (params: Readonly<{
  coordinationDirectory: CoordinationMembershipMaterialization;
  localMemberPubkey?: PublicKeyHex | null;
}>): ReadonlyArray<PublicKeyHex> => {
  const active = [...params.coordinationDirectory.activeMemberPubkeys];
  const local = params.localMemberPubkey?.trim();
  if (local) {
    const localNorm = normalizePubkey(local);
    const hasLeft = params.coordinationDirectory.leftMemberPubkeys
      .some((pubkey) => normalizePubkey(pubkey) === localNorm);
    const hasExpelled = params.coordinationDirectory.expelledMemberPubkeys
      .some((pubkey) => normalizePubkey(pubkey) === localNorm);
    const inActive = active.some((pubkey) => normalizePubkey(pubkey) === localNorm);
    if (!hasLeft && !hasExpelled && !inActive) {
      active.push(local as PublicKeyHex);
    }
  }
  return dedupePubkeys(active);
};

export const resolveCommunityParticipantDisplayPubkeys = (params: Readonly<{
  communityMode?: CommunityMode | null;
  coordinationDirectory: CoordinationMembershipMaterialization | null;
  monotonicDisplayPubkeys: ReadonlyArray<PublicKeyHex>;
  localMemberPubkey?: PublicKeyHex | null;
}>): ReadonlyArray<PublicKeyHex> => {
  if (!usesCoordinationMembershipTruth(params.communityMode)) {
    return params.monotonicDisplayPubkeys;
  }

  if (params.coordinationDirectory) {
    return resolveCoordinationActiveDisplayPubkeys({
      coordinationDirectory: params.coordinationDirectory,
      localMemberPubkey: params.localMemberPubkey,
    });
  }

  return [];
};

/** Whether monotonic roster path should apply terminal leave/expel exclusions. */
export const shouldApplyTerminalMembershipExclusionsToParticipantRoster = (
  communityMode?: CommunityMode | null,
  coordinationDirectory: CoordinationMembershipMaterialization | null = null,
): boolean => !usesCoordinationMembershipTruth(communityMode);
