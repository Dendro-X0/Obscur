import { normalizeRelayUrl } from "@dweb/nostr/relay-utils";
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

/** All persisted chat-state keys that may reference the same sealed group thread. */
export const resolveGroupConversationIdAliases = (params: Readonly<{
  conversationId?: string;
  groupId: string;
  relayUrl?: string;
  communityId?: string;
  genesisEventId?: string;
  creatorPubkey?: string;
}>): ReadonlyArray<string> => {
  const aliases = new Set<string>();
  const add = (value: string | undefined): void => {
    const trimmed = value?.trim() ?? "";
    if (trimmed.length > 0) {
      aliases.add(trimmed);
    }
  };

  add(params.conversationId);
  add(toGroupConversationId({
    groupId: params.groupId,
    relayUrl: params.relayUrl,
    communityId: params.communityId,
    genesisEventId: params.genesisEventId,
    creatorPubkey: params.creatorPubkey,
  }));
  add(toGroupConversationId({
    groupId: params.groupId,
    relayUrl: params.relayUrl,
  }));
  const relayUrl = normalizeRelayUrl(params.relayUrl);
  const groupId = params.groupId.trim();
  if (groupId.length > 0 && relayUrl.length > 0) {
    add(`community:${groupId}:${relayUrl}`);
    add(`group:${groupId}@${relayUrl}`);
  }
  return Array.from(aliases);
};

export const isGroupConversationId = (conversationId: string): boolean => {
  const trimmed = conversationId.trim();
  return trimmed.startsWith("community:") || trimmed.startsWith("group:") || trimmed.includes("@");
};

/** Parse a persisted chat-state group thread key into storage coordinates. */
export const parseGroupConversationStorageKey = (
  conversationId: string,
): Readonly<{ groupId: string; relayUrl?: string }> | null => {
  const trimmed = conversationId.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.startsWith("community:") || trimmed.startsWith("group:")) {
    const raw = trimmed.startsWith("community:")
      ? trimmed.slice("community:".length)
      : trimmed.slice("group:".length);
    const separatorIndex = raw.indexOf(":");
    if (separatorIndex <= 0) {
      if (raw.length > 0) {
        return { groupId: raw };
      }
      return null;
    }
    const groupId = raw.slice(0, separatorIndex).trim();
    const relayUrl = raw.slice(separatorIndex + 1).trim();
    if (groupId.length === 0) {
      return null;
    }
    return relayUrl.length > 0 ? { groupId, relayUrl } : { groupId };
  }

  if (trimmed.includes("@")) {
    const [rawGroupId, ...relayParts] = trimmed.split("@");
    const groupId = rawGroupId.trim();
    const relayHost = relayParts.join("@").trim();
    if (groupId.length === 0 || relayHost.length === 0) {
      return null;
    }
    const relayUrl = relayHost.startsWith("ws://") || relayHost.startsWith("wss://")
      ? relayHost
      : `wss://${relayHost}`;
    return { groupId, relayUrl: normalizeRelayUrl(relayUrl) };
  }

  return null;
};
