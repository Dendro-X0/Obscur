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

/**
 * Single read path for the durable known-participant OR-set used to **seed** roster UI and
 * sealed-community hooks (before projection / author-evidence overlays).
 *
 * `buildCommunityKnownParticipantDirectory` already unions localStorage OR-set, roster projection,
 * persisted `group.memberPubkeys`, and local member. Callers still pass **`persistedGroupMemberPubkeys`**
 * so bootstrap works when the directory row is not yet hydrated. Union is idempotent when sources overlap.
 * For sealed-community / management UI seeds that also fold roster projection + local, use
 * **`resolveCommunitySeedMemberPubkeysFromDirectory`** in **`community-visible-members.ts`**.
 */
export const mergeKnownParticipantSeedPubkeys = (params: Readonly<{
  directory?: CommunityKnownParticipantDirectory | null;
  persistedGroupMemberPubkeys?: ReadonlyArray<PublicKeyHex> | null | undefined;
}>): ReadonlyArray<PublicKeyHex> => (
  dedupeCommunityMemberPubkeys([
    ...(params.directory?.participantPubkeys ?? []),
    ...(params.persistedGroupMemberPubkeys ?? []),
  ])
);

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
