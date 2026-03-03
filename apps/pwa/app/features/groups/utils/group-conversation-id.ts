import { deriveCommunityId, toCommunityConversationId } from "./community-identity";

export const toGroupConversationId = (params: Readonly<{
  groupId: string;
  relayUrl?: string;
  communityId?: string;
  genesisEventId?: string;
  creatorPubkey?: string;
}>): string => {
  const communityId = deriveCommunityId({
    existingCommunityId: params.communityId,
    groupId: params.groupId,
    relayUrl: params.relayUrl,
    genesisEventId: params.genesisEventId,
    creatorPubkey: params.creatorPubkey
  });
  return toCommunityConversationId(communityId);
};

export const isGroupConversationId = (conversationId: string): boolean => {
  const trimmed = conversationId.trim();
  return trimmed.startsWith("community:") || trimmed.startsWith("group:") || trimmed.includes("@");
};
