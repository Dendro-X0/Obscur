import type { GroupConversation } from "@/app/features/messaging/types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  dedupeCommunityMemberPubkeys,
  type CommunityRosterProjection,
} from "./community-member-roster-projection";
import type { CommunityKnownParticipantsEntry } from "./community-known-participants-store";

export type CommunityKnownParticipantDirectory = Readonly<{
  conversationId: string;
  groupId: string;
  relayUrl: string;
  communityId?: string;
  participantPubkeys: ReadonlyArray<PublicKeyHex>;
  participantCount: number;
}>;

export const buildCommunityKnownParticipantDirectory = (params: Readonly<{
  group: GroupConversation;
  rosterProjection?: CommunityRosterProjection;
  storedEntry?: CommunityKnownParticipantsEntry;
  localMemberPubkey?: PublicKeyHex | null;
}>): CommunityKnownParticipantDirectory => {
  const participantPubkeys = dedupeCommunityMemberPubkeys([
    ...((params.storedEntry?.participantPubkeys ?? []) as ReadonlyArray<PublicKeyHex>),
    ...((params.rosterProjection?.activeMemberPubkeys ?? []) as ReadonlyArray<PublicKeyHex>),
    ...((params.group.memberPubkeys ?? []) as ReadonlyArray<PublicKeyHex>),
    ...(params.localMemberPubkey ? [params.localMemberPubkey] : []),
  ]);
  return {
    conversationId: params.group.id,
    groupId: params.group.groupId,
    relayUrl: params.group.relayUrl,
    communityId: params.group.communityId,
    participantPubkeys,
    participantCount: Math.max(participantPubkeys.length, 1),
  };
};

export const buildCommunityKnownParticipantDirectoryByConversationId = (params: Readonly<{
  groups: ReadonlyArray<GroupConversation>;
  rosterProjectionByConversationId: Readonly<Record<string, CommunityRosterProjection>>;
  storedEntries: ReadonlyArray<CommunityKnownParticipantsEntry>;
  localMemberPubkey?: PublicKeyHex | null;
}>): Readonly<Record<string, CommunityKnownParticipantDirectory>> => {
  const storedEntryByGroupKey = new Map<string, CommunityKnownParticipantsEntry>();
  params.storedEntries.forEach((entry) => {
    storedEntryByGroupKey.set(`${entry.groupId}@@${entry.relayUrl}`, entry);
  });
  return Object.fromEntries(
    params.groups.map((group) => {
      const storedEntry = storedEntryByGroupKey.get(`${group.groupId}@@${group.relayUrl}`);
      return [
        group.id,
        buildCommunityKnownParticipantDirectory({
          group,
          rosterProjection: params.rosterProjectionByConversationId[group.id],
          storedEntry,
          localMemberPubkey: params.localMemberPubkey,
        }),
      ];
    }),
  );
};
