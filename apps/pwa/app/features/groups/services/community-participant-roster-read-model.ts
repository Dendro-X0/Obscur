import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  dedupeCommunityMemberPubkeys,
  mergeMonotonicActiveCommunityMembers,
  type RelayEvidenceConfidence,
} from "./community-member-roster-projection";
import { resolveAuthorEvidencePubkeysFromCommunityMessages } from "./community-visible-members";

export const COMMUNITY_PARTICIPANT_ROSTER_READ_MODEL_OWNER_ID = "community-participant-roster-read-model" as const;

export type CommunityParticipantRosterReadModelInput = Readonly<{
  directoryParticipantPubkeys: ReadonlyArray<PublicKeyHex>;
  persistedGroupMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  projectionMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  /** Gateway seed path (directory ∪ persisted ∪ projection ∪ local) for surfaces without live relay messages. */
  rosterSeedPubkeys?: ReadonlyArray<PublicKeyHex>;
  /** Authors from persisted `groupMessages` (chat works but group-home `state.messages` is often empty). */
  persistedMessageAuthorPubkeys?: ReadonlyArray<PublicKeyHex>;
  communityMessages: ReadonlyArray<Readonly<{ pubkey?: string | null }>>;
  localMemberPubkey?: PublicKeyHex | null;
  leftMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys: ReadonlyArray<PublicKeyHex>;
}>;

export type CommunityParticipantRosterReadModelSessionAdvance = Readonly<{
  sessionPubkeys: ReadonlyArray<PublicKeyHex>;
  evidencePubkeys: ReadonlyArray<PublicKeyHex>;
  leftMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  relayEvidenceConfidence?: RelayEvidenceConfidence;
  /**
   * Discovery UI must not treat relay-inferred leave/expel lists as removal authority.
   * Terminal exclusions belong in sendability / operator surfaces with signed evidence gates.
   */
  applyTerminalMembershipExclusions?: boolean;
}>;

export type CommunityParticipantRosterReadModelResult = Readonly<{
  evidencePubkeys: ReadonlyArray<PublicKeyHex>;
  sessionPubkeys: ReadonlyArray<PublicKeyHex>;
  displayPubkeys: ReadonlyArray<PublicKeyHex>;
  authorEvidencePubkeys: ReadonlyArray<PublicKeyHex>;
  widenedCount: number;
}>;

/** Union all roster evidence sources for the current tick (may be thinner than session). */
export const resolveCommunityParticipantRosterEvidence = (
  params: CommunityParticipantRosterReadModelInput,
): Readonly<{ evidencePubkeys: ReadonlyArray<PublicKeyHex>; authorEvidencePubkeys: ReadonlyArray<PublicKeyHex> }> => {
  const authorEvidencePubkeys = resolveAuthorEvidencePubkeysFromCommunityMessages(params.communityMessages);
  const evidencePubkeys = dedupeCommunityMemberPubkeys([
    ...params.directoryParticipantPubkeys,
    ...params.persistedGroupMemberPubkeys,
    ...(params.projectionMemberPubkeys ?? []),
    ...(params.rosterSeedPubkeys ?? []),
    ...(params.persistedMessageAuthorPubkeys ?? []),
    ...authorEvidencePubkeys,
    ...(params.localMemberPubkey ? [params.localMemberPubkey] : []),
  ]);
  return { evidencePubkeys, authorEvidencePubkeys };
};

/**
 * R2 read-model session: widen-only OR-set for UI display.
 * Thin relay snapshots or narrowed `group.memberPubkeys` must not shrink the participant list
 * without explicit leave/expel evidence.
 */
export const advanceCommunityParticipantRosterSession = (
  params: CommunityParticipantRosterReadModelSessionAdvance,
): CommunityParticipantRosterReadModelResult => {
  const excludePubkeys = params.applyTerminalMembershipExclusions === true
    ? dedupeCommunityMemberPubkeys([
      ...params.leftMemberPubkeys,
      ...params.expelledMemberPubkeys,
    ])
    : [];
  const activeEvidence = mergeMonotonicActiveCommunityMembers(
    params.evidencePubkeys,
    [],
    { excludePubkeys },
  );
  const sessionPubkeys = mergeMonotonicActiveCommunityMembers(
    params.sessionPubkeys,
    activeEvidence,
    { excludePubkeys },
  );
  return {
    evidencePubkeys: params.evidencePubkeys,
    sessionPubkeys,
    displayPubkeys: sessionPubkeys,
    authorEvidencePubkeys: [],
    widenedCount: Math.max(0, sessionPubkeys.length - params.sessionPubkeys.length),
  };
};

export const resolveCommunityParticipantRosterReadModel = (
  params: CommunityParticipantRosterReadModelInput & Readonly<{
    sessionPubkeys: ReadonlyArray<PublicKeyHex>;
    relayEvidenceConfidence?: RelayEvidenceConfidence;
    applyTerminalMembershipExclusions?: boolean;
  }>,
): CommunityParticipantRosterReadModelResult => {
  const { evidencePubkeys, authorEvidencePubkeys } = resolveCommunityParticipantRosterEvidence(params);
  const advanced = advanceCommunityParticipantRosterSession({
    sessionPubkeys: params.sessionPubkeys,
    evidencePubkeys,
    leftMemberPubkeys: params.leftMemberPubkeys,
    expelledMemberPubkeys: params.expelledMemberPubkeys,
    relayEvidenceConfidence: params.relayEvidenceConfidence,
    applyTerminalMembershipExclusions: params.applyTerminalMembershipExclusions,
  });
  return {
    ...advanced,
    authorEvidencePubkeys,
  };
};
