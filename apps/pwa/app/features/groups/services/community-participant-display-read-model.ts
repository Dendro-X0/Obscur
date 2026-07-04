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

const mergeStaleDirectoryRepairIntoCoordinationDisplay = (params: Readonly<{
  coordinationDirectory: CoordinationMembershipMaterialization;
  coordinationActive: ReadonlyArray<PublicKeyHex>;
  repairMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  localLeftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  localExpelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
}>): ReadonlyArray<PublicKeyHex> => {
  const repairCandidates = params.repairMemberPubkeys ?? [];
  if (repairCandidates.length === 0) {
    return params.coordinationActive;
  }
  const terminal = new Set([
    ...params.coordinationDirectory.leftMemberPubkeys,
    ...params.coordinationDirectory.expelledMemberPubkeys,
    ...(params.localLeftMemberPubkeys ?? []),
    ...(params.localExpelledMemberPubkeys ?? []),
  ].map(normalizePubkey));
  const activeNorm = new Set(params.coordinationActive.map(normalizePubkey));
  const repairPubkeys = repairCandidates.filter((pubkey) => {
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

/** Union durable widen-only repair seeds when coordination directory shrinks below local evidence. */
export const buildCoordinationDirectoryRepairMemberPubkeys = (params: Readonly<{
  joinEvidenceMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  knownParticipantPubkeys?: ReadonlyArray<PublicKeyHex>;
  participationAuthorPubkeys?: ReadonlyArray<PublicKeyHex>;
}>): ReadonlyArray<PublicKeyHex> => dedupePubkeys([
  ...(params.joinEvidenceMemberPubkeys ?? []),
  ...(params.knownParticipantPubkeys ?? []),
  ...(params.participationAuthorPubkeys ?? []),
]);

export const resolveCommunityParticipantDisplayPubkeys = (params: Readonly<{
  communityMode?: CommunityMode | null;
  relayUrl?: string | null;
  coordinationDirectory: CoordinationMembershipMaterialization | null;
  monotonicDisplayPubkeys: ReadonlyArray<PublicKeyHex>;
  /** Explicit join/invite ledger seeds — repairs stale directory shrink without relay widen. */
  joinEvidenceMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  /** Durable known-participant OR-set for the conversation (localStorage). */
  knownParticipantPubkeys?: ReadonlyArray<PublicKeyHex>;
  /** Sealed/persisted message authors — participation evidence for stale-directory repair. */
  participationAuthorPubkeys?: ReadonlyArray<PublicKeyHex>;
  localMemberPubkey?: PublicKeyHex | null;
  localLeftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  localExpelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
}>): ReadonlyArray<PublicKeyHex> => {
  if (!usesCoordinationMembershipTruth(params.communityMode, params.relayUrl)) {
    return params.monotonicDisplayPubkeys;
  }

  const repairMemberPubkeys = buildCoordinationDirectoryRepairMemberPubkeys({
    joinEvidenceMemberPubkeys: params.joinEvidenceMemberPubkeys,
    knownParticipantPubkeys: params.knownParticipantPubkeys,
    participationAuthorPubkeys: params.participationAuthorPubkeys,
  });

  if (params.coordinationDirectory) {
    const coordinationActive = resolveCoordinationActiveDisplayPubkeys({
      coordinationDirectory: params.coordinationDirectory,
      localMemberPubkey: params.localMemberPubkey,
      localLeftMemberPubkeys: params.localLeftMemberPubkeys,
      localExpelledMemberPubkeys: params.localExpelledMemberPubkeys,
    });
    return mergeStaleDirectoryRepairIntoCoordinationDisplay({
      coordinationDirectory: params.coordinationDirectory,
      coordinationActive,
      repairMemberPubkeys,
      localLeftMemberPubkeys: params.localLeftMemberPubkeys,
      localExpelledMemberPubkeys: params.localExpelledMemberPubkeys,
    });
  }

  if (repairMemberPubkeys.length > 0) {
    return repairMemberPubkeys;
  }

  return [];
};

/** Whether monotonic roster path should apply terminal leave/expel exclusions. */
export const shouldApplyTerminalMembershipExclusionsToParticipantRoster = (
  communityMode?: CommunityMode | null,
  coordinationDirectory: CoordinationMembershipMaterialization | null = null,
  relayUrl?: string | null,
): boolean => !shouldUseCoordinationMembershipAuthority(communityMode, relayUrl);
