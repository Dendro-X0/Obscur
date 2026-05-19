import type { GroupConversation } from "@/app/features/messaging/types";
import { pickPreferredCommunityDisplayName } from "./community-display-name";
import { toCommunityMembershipLedgerEntryFromGroup } from "./community-membership-ledger";
import { persistCommunityMembershipLedgerMutation } from "./community-membership-mutation-owner";

export const COMMUNITY_DESCRIPTOR_MUTATION_OWNER_ID = "community-descriptor-mutation-owner" as const;

export type PersistCommunityDescriptorUpdateParams = Readonly<{
  publicKeyHex: string;
  group: GroupConversation;
  displayName: string;
  about?: string;
  avatar?: string;
  access?: GroupConversation["access"];
  lastEvidenceEventId?: string;
  updatedAtUnixMs?: number;
  profileId?: string;
}>;

/**
 * Canonical local persistence for descriptor changes (P0).
 * Updates membership ledger + joined status so recovery prefers human names.
 */
export const persistCommunityDescriptorUpdate = (
  params: PersistCommunityDescriptorUpdateParams,
): void => {
  const updatedAtUnixMs = params.updatedAtUnixMs ?? Date.now();
  const displayName = pickPreferredCommunityDisplayName(
    params.displayName,
    params.group.displayName,
    { groupId: params.group.groupId, communityId: params.group.communityId },
  );
  const mergedGroup: GroupConversation = {
    ...params.group,
    displayName,
    about: params.about?.trim() || params.group.about,
    avatar: params.avatar?.trim() || params.group.avatar,
    access: params.access ?? params.group.access,
  };

  const entry = toCommunityMembershipLedgerEntryFromGroup(mergedGroup, {
    status: "joined",
    updatedAtUnixMs,
    lastEvidenceEventId: params.lastEvidenceEventId,
  });

  persistCommunityMembershipLedgerMutation(params.publicKeyHex, {
    reason: "descriptor_updated",
    entry,
  }, { profileId: params.profileId });
};
