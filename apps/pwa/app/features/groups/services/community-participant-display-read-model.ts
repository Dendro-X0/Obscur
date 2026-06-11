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
  localLeftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  localExpelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
}>): ReadonlyArray<PublicKeyHex> => {
  const terminal = new Set([
    ...params.coordinationDirectory.leftMemberPubkeys,
    ...params.coordinationDirectory.expelledMemberPubkeys,
    ...(params.localLeftMemberPubkeys ?? []),
    ...(params.localExpelledMemberPubkeys ?? []),
  ].map(normalizePubkey));

  const active = params.coordinationDirectory.activeMemberPubkeys.filter(
    (pubkey) => !terminal.has(normalizePubkey(pubkey)),
  );
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

const mergeJoinEvidenceIntoCoordinationDisplay = (params: Readonly<{
  coordinationDirectory: CoordinationMembershipMaterialization;
  coordinationActive: ReadonlyArray<PublicKeyHex>;
  joinEvidenceMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  localLeftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  localExpelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
}>): ReadonlyArray<PublicKeyHex> => {
  const joinEvidence = params.joinEvidenceMemberPubkeys ?? [];
  if (joinEvidence.length === 0) {
    return params.coordinationActive;
  }
  const terminal = new Set([
    ...params.coordinationDirectory.leftMemberPubkeys,
    ...params.coordinationDirectory.expelledMemberPubkeys,
    ...(params.localLeftMemberPubkeys ?? []),
    ...(params.localExpelledMemberPubkeys ?? []),
  ].map(normalizePubkey));
  const activeNorm = new Set(params.coordinationActive.map(normalizePubkey));
  const repairPubkeys = joinEvidence.filter((pubkey) => {
    const normalized = normalizePubkey(pubkey);
    return normalized.length > 0
      && !terminal.has(normalized)
      && !activeNorm.has(normalized);
  });
  if (repairPubkeys.length === 0) {
    return params.coordinationActive;
  }
  return dedupePubkeys([...params.coordinationActive, ...repairPubkeys]);
};

export const resolveCommunityParticipantDisplayPubkeys = (params: Readonly<{
  communityMode?: CommunityMode | null;
  relayUrl?: string | null;
  coordinationDirectory: CoordinationMembershipMaterialization | null;
  monotonicDisplayPubkeys: ReadonlyArray<PublicKeyHex>;
  /** Explicit join/invite ledger seeds — repairs stale directory shrink without relay widen. */
  joinEvidenceMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  localMemberPubkey?: PublicKeyHex | null;
  localLeftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  localExpelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
}>): ReadonlyArray<PublicKeyHex> => {
  if (!usesCoordinationMembershipTruth(params.communityMode, params.relayUrl)) {
    return params.monotonicDisplayPubkeys;
  }

  if (params.coordinationDirectory) {
    const coordinationActive = resolveCoordinationActiveDisplayPubkeys({
      coordinationDirectory: params.coordinationDirectory,
      localMemberPubkey: params.localMemberPubkey,
      localLeftMemberPubkeys: params.localLeftMemberPubkeys,
      localExpelledMemberPubkeys: params.localExpelledMemberPubkeys,
    });
    return mergeJoinEvidenceIntoCoordinationDisplay({
      coordinationDirectory: params.coordinationDirectory,
      coordinationActive,
      joinEvidenceMemberPubkeys: params.joinEvidenceMemberPubkeys,
      localLeftMemberPubkeys: params.localLeftMemberPubkeys,
      localExpelledMemberPubkeys: params.localExpelledMemberPubkeys,
    });
  }

  return [];
};

/** Whether monotonic roster path should apply terminal leave/expel exclusions. */
export const shouldApplyTerminalMembershipExclusionsToParticipantRoster = (
  communityMode?: CommunityMode | null,
  coordinationDirectory: CoordinationMembershipMaterialization | null = null,
  relayUrl?: string | null,
): boolean => !shouldUseCoordinationMembershipAuthority(communityMode, relayUrl);
