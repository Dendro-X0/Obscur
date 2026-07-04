"use client";

import { useMemo } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityMode } from "../types";
import type { CoordinationMembershipMaterialization } from "../services/community-coordination-membership-materializer";
import type { RelayEvidenceConfidence } from "../services/community-member-roster-projection";
import {
  mergeCoordinationTerminalMemberPubkeys,
  resolveCommunityParticipantDisplayPubkeys,
  shouldApplyTerminalMembershipExclusionsToParticipantRoster,
} from "../services/community-participant-display-read-model";
import { useCommunityParticipantRosterReadModel } from "./use-community-participant-roster-read-model";

export type UseLegacyCommunityParticipantPubkeysParams = Readonly<{
  enabled: boolean;
  conversationId: string;
  communityMode?: CommunityMode | null;
  relayUrl?: string | null;
  coordinationDirectory: CoordinationMembershipMaterialization | null;
  directoryParticipantPubkeys: ReadonlyArray<PublicKeyHex>;
  persistedGroupMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  projectionMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  rosterSeedPubkeys: ReadonlyArray<PublicKeyHex>;
  communityMessages: ReadonlyArray<Readonly<{ pubkey?: string | null }>>;
  localMemberPubkey?: PublicKeyHex | null;
  leftMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  joinEvidenceMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  relayEvidenceConfidence?: RelayEvidenceConfidence;
  persistedEvidenceOwnerPubkey?: PublicKeyHex | null;
  ledgerGroupId?: string;
  ledgerRelayUrl?: string;
}>;

export const useLegacyCommunityParticipantPubkeys = (
  params: UseLegacyCommunityParticipantPubkeysParams,
): Readonly<{
  participantDisplayPubkeys: ReadonlyArray<PublicKeyHex>;
  authorEvidencePubkeys: ReadonlyArray<PublicKeyHex>;
}> => {
  const rosterLeftMemberPubkeys = useMemo(
    () => mergeCoordinationTerminalMemberPubkeys(
      params.leftMemberPubkeys,
      params.coordinationDirectory,
      "left",
    ),
    [params.coordinationDirectory, params.leftMemberPubkeys],
  );
  const rosterExpelledMemberPubkeys = useMemo(
    () => mergeCoordinationTerminalMemberPubkeys(
      params.expelledMemberPubkeys,
      params.coordinationDirectory,
      "expelled",
    ),
    [params.coordinationDirectory, params.expelledMemberPubkeys],
  );

  const { displayPubkeys: rosterDisplayPubkeys, authorEvidencePubkeys } = useCommunityParticipantRosterReadModel({
    conversationId: params.enabled ? params.conversationId : "",
    directoryParticipantPubkeys: params.directoryParticipantPubkeys,
    persistedGroupMemberPubkeys: params.persistedGroupMemberPubkeys,
    projectionMemberPubkeys: params.projectionMemberPubkeys,
    rosterSeedPubkeys: params.rosterSeedPubkeys,
    communityMessages: params.enabled ? params.communityMessages : [],
    localMemberPubkey: params.localMemberPubkey,
    leftMemberPubkeys: rosterLeftMemberPubkeys,
    expelledMemberPubkeys: rosterExpelledMemberPubkeys,
    relayEvidenceConfidence: params.relayEvidenceConfidence,
    persistedEvidenceOwnerPubkey: params.persistedEvidenceOwnerPubkey,
    ledgerGroupId: params.ledgerGroupId,
    ledgerRelayUrl: params.ledgerRelayUrl,
    applyTerminalMembershipExclusions: shouldApplyTerminalMembershipExclusionsToParticipantRoster(
      params.communityMode,
      params.coordinationDirectory,
      params.relayUrl,
    ),
  });

  const participantDisplayPubkeys = useMemo(() => {
    if (!params.enabled) {
      return [] as ReadonlyArray<PublicKeyHex>;
    }
    return resolveCommunityParticipantDisplayPubkeys({
      communityMode: params.communityMode,
      relayUrl: params.relayUrl,
      coordinationDirectory: params.coordinationDirectory,
      monotonicDisplayPubkeys: rosterDisplayPubkeys,
      joinEvidenceMemberPubkeys: params.joinEvidenceMemberPubkeys,
      knownParticipantPubkeys: params.directoryParticipantPubkeys,
      participationAuthorPubkeys: authorEvidencePubkeys,
      localMemberPubkey: params.localMemberPubkey,
      localLeftMemberPubkeys: params.leftMemberPubkeys,
      localExpelledMemberPubkeys: params.expelledMemberPubkeys,
    });
  }, [
    authorEvidencePubkeys,
    params.communityMode,
    params.coordinationDirectory,
    params.directoryParticipantPubkeys,
    params.enabled,
    params.expelledMemberPubkeys,
    params.joinEvidenceMemberPubkeys,
    params.leftMemberPubkeys,
    params.localMemberPubkey,
    params.relayUrl,
    rosterDisplayPubkeys,
  ]);

  return {
    participantDisplayPubkeys,
    authorEvidencePubkeys: params.enabled ? authorEvidencePubkeys : [],
  };
};
