import { resolveCommunityRosterSnapshotNextMembers } from "./community-member-roster-projection";
import {
  resolveActiveCommunityMemberPubkeysFromConversation,
  resolveAuthorEvidencePubkeysFromCommunityMessages,
  resolveCommunitySeedMemberPubkeysFromDirectory,
  stabilizeCommunityMemberPubkeys,
} from "./community-visible-members";
import {
  persistHydratedGroupKnownParticipants,
  persistKnownParticipantDirectoryIfWidened,
  persistObservedKnownParticipants,
} from "./community-roster-persistence";
import type { CommunityRosterMaterializationPort } from "./community-roster-materialization-port";

/** Canonical R2 roster read + persist owner. */
export const communityRosterMaterializationOwner: CommunityRosterMaterializationPort = {
  resolveAuthorEvidencePubkeysFromMessages: resolveAuthorEvidencePubkeysFromCommunityMessages,
  resolveSeedMemberPubkeysFromDirectory: resolveCommunitySeedMemberPubkeysFromDirectory,
  resolveActiveMemberPubkeysFromConversation: resolveActiveCommunityMemberPubkeysFromConversation,
  stabilizeMemberPubkeys: stabilizeCommunityMemberPubkeys,
  resolveSnapshotNextMembers: resolveCommunityRosterSnapshotNextMembers,
  persistKnownParticipantDirectoryIfWidened,
  persistObservedKnownParticipants,
  persistHydratedGroupKnownParticipants,
};
