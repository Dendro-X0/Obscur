import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation } from "@/app/features/messaging/types";
import type { CommunityKnownParticipantDirectory } from "./community-known-participant-directory";
import type { CommunityRosterProjection } from "../services/community-member-roster-projection";
import type { CommunityMembershipReadModelIndexGroupInput } from "../hooks/use-community-membership-read-model-index";

export type CommunityMembershipReadModelTerminalOverride = Readonly<{
  leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
}>;

/**
 * MEM-002 — single builder for Network, chat shell, and invite surfaces.
 * Prefer roster projection active members over stale persisted group.memberPubkeys.
 */
export const buildCommunityMembershipReadModelIndexGroupInputs = (params: Readonly<{
  ownerPubkey: PublicKeyHex | null;
  groups: ReadonlyArray<GroupConversation>;
  communityKnownParticipantDirectoryByConversationId: Readonly<
    Record<string, CommunityKnownParticipantDirectory>
  >;
  communityRosterByConversationId: Readonly<Record<string, CommunityRosterProjection>>;
  terminalOverridesByConversationId?: Readonly<
    Record<string, CommunityMembershipReadModelTerminalOverride>
  >;
}>): ReadonlyArray<CommunityMembershipReadModelIndexGroupInput> => (
  params.groups.map((group) => {
    const roster = params.communityRosterByConversationId[group.id];
    const directory = params.communityKnownParticipantDirectoryByConversationId[group.id];
    const terminalOverride = params.terminalOverridesByConversationId?.[group.id];
    const persistedGroupMemberPubkeys = (
      roster?.activeMemberPubkeys
      ?? group.memberPubkeys
      ?? []
    ) as ReadonlyArray<PublicKeyHex>;

    return {
      conversationId: group.id,
      groupId: group.groupId,
      relayUrl: group.relayUrl,
      directoryParticipantPubkeys: (
        directory?.participantPubkeys ?? []
      ) as ReadonlyArray<PublicKeyHex>,
      persistedGroupMemberPubkeys,
      projectionMemberPubkeys: roster?.activeMemberPubkeys as ReadonlyArray<PublicKeyHex> | undefined,
      rosterSeedPubkeys: (group.memberPubkeys ?? []) as ReadonlyArray<PublicKeyHex>,
      localMemberPubkey: params.ownerPubkey,
      leftMemberPubkeys: terminalOverride?.leftMemberPubkeys,
      expelledMemberPubkeys: terminalOverride?.expelledMemberPubkeys,
      applyTerminalMembershipExclusions: true,
    };
  })
);
