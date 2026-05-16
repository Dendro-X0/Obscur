import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversationRosterContract } from "@dweb/client-gateway/community-roster";
import type { CommunityKnownParticipantDirectory } from "./community-known-participant-directory";
import {
  type CommunityKnownParticipantsEntry,
  loadCommunityKnownParticipantsEntries,
  upsertCommunityKnownParticipantsEntry,
} from "./community-known-participants-store";
import { dedupeCommunityMemberPubkeys } from "./community-member-roster-projection";

export const buildMinimalKnownParticipantPersistBaseline = (params: Readonly<{
  storedEntry?: CommunityKnownParticipantsEntry;
  persistedGroupMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  localMemberPubkey: PublicKeyHex;
}>): ReadonlyArray<PublicKeyHex> => (
  dedupeCommunityMemberPubkeys([
    ...(params.storedEntry?.participantPubkeys ?? []),
    ...(params.persistedGroupMemberPubkeys ?? []),
    params.localMemberPubkey,
  ])
);

const sortedPubkeyKey = (pubkeys: ReadonlyArray<PublicKeyHex>): string => (
  [...pubkeys].map((pubkey) => pubkey.trim()).filter(Boolean).sort().join("\n")
);

/**
 * Persist directory OR-set only when it widens beyond stored ∪ group.memberPubkeys ∪ local.
 * Returns true when an upsert was written.
 */
export const persistKnownParticipantDirectoryIfWidened = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
  directory: CommunityKnownParticipantDirectory;
  persistedGroupMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  storedEntry?: CommunityKnownParticipantsEntry;
}>): boolean => {
  const minimalPersistableSeed = buildMinimalKnownParticipantPersistBaseline({
    storedEntry: params.storedEntry,
    persistedGroupMemberPubkeys: params.persistedGroupMemberPubkeys,
    localMemberPubkey: params.publicKeyHex,
  });
  if (sortedPubkeyKey(params.directory.participantPubkeys) === sortedPubkeyKey(minimalPersistableSeed)) {
    return false;
  }
  upsertCommunityKnownParticipantsEntry({
    publicKeyHex: params.publicKeyHex,
    profileId: params.profileId,
    entry: {
      conversationId: params.directory.conversationId,
      groupId: params.directory.groupId,
      relayUrl: params.directory.relayUrl,
      communityId: params.directory.communityId,
      participantPubkeys: params.directory.participantPubkeys,
      updatedAtUnixMs: Date.now(),
    },
  });
  return true;
};

export const persistObservedKnownParticipants = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
  entry: CommunityKnownParticipantsEntry;
}>): void => {
  upsertCommunityKnownParticipantsEntry(params);
};

/** Hydrate-time seed persist for a single group row (legacy self-heal path). */
export const persistHydratedGroupKnownParticipants = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
  group: GroupConversationRosterContract;
  additionalParticipantPubkeys?: ReadonlyArray<PublicKeyHex>;
}>): void => {
  upsertCommunityKnownParticipantsEntry({
    publicKeyHex: params.publicKeyHex,
    profileId: params.profileId,
    entry: {
      conversationId: params.group.id,
      groupId: params.group.groupId,
      relayUrl: params.group.relayUrl,
      communityId: params.group.communityId,
      participantPubkeys: dedupeCommunityMemberPubkeys([
        ...(params.group.memberPubkeys ?? []),
        ...(params.additionalParticipantPubkeys ?? []),
        params.publicKeyHex,
      ]),
      updatedAtUnixMs: Date.now(),
    },
  });
};

export const loadStoredKnownParticipantsForProfile = (
  publicKeyHex: PublicKeyHex,
  profileId: string,
): ReadonlyArray<CommunityKnownParticipantsEntry> => (
  loadCommunityKnownParticipantsEntries(publicKeyHex, profileId)
);
