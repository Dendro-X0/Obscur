"use client";

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityMode } from "../types";
import type { CoordinationMembershipMaterialization } from "../services/community-coordination-membership-materializer";
import type { RelayEvidenceConfidence } from "../services/community-member-roster-projection";
import { isWorkspaceKernelAuthority } from "@/app/features/workspace-kernel/workspace-kernel-policy";
import { useWorkspaceKernelParticipantPubkeys } from "@/app/features/workspace-kernel/use-workspace-kernel-participant-pubkeys";
import { useLegacyCommunityParticipantPubkeys } from "./use-legacy-community-participant-pubkeys";

export type UseGroupHomeParticipantPubkeysParams = Readonly<{
  conversationId: string;
  communityId?: string;
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

export const useGroupHomeParticipantPubkeys = (
  params: UseGroupHomeParticipantPubkeysParams,
): Readonly<{
  participantDisplayPubkeys: ReadonlyArray<PublicKeyHex>;
  authorEvidencePubkeys: ReadonlyArray<PublicKeyHex>;
  inviteBlocklistPubkeys: ReadonlyArray<PublicKeyHex>;
  usesKernelRoster: boolean;
}> => {
  const usesKernelRoster = isWorkspaceKernelAuthority();
  const kernel = useWorkspaceKernelParticipantPubkeys({
    enabled: usesKernelRoster,
    communityId: params.communityId,
    communityMode: params.communityMode,
    relayUrl: params.relayUrl,
    localMemberPubkey: params.localMemberPubkey,
    coordinationDirectory: params.coordinationDirectory,
    leftMemberPubkeys: params.leftMemberPubkeys,
    expelledMemberPubkeys: params.expelledMemberPubkeys,
  });
  const legacy = useLegacyCommunityParticipantPubkeys({
    ...params,
    enabled: !usesKernelRoster,
  });

  if (usesKernelRoster) {
    return {
      participantDisplayPubkeys: kernel.participantPubkeys,
      authorEvidencePubkeys: [],
      inviteBlocklistPubkeys: kernel.inviteBlocklistPubkeys,
      usesKernelRoster: true,
    };
  }

  return {
    participantDisplayPubkeys: legacy.participantDisplayPubkeys,
    authorEvidencePubkeys: legacy.authorEvidencePubkeys,
    inviteBlocklistPubkeys: [],
    usesKernelRoster: false,
  };
};
