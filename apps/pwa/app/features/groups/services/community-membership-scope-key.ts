import { normalizeRelayUrl } from "@dweb/nostr/relay-utils";

export type CommunityMembershipScope = Readonly<{
  groupId: string;
  relayUrl: string;
}>;

export const normalizeCommunityMembershipScope = (
  scope: CommunityMembershipScope,
): CommunityMembershipScope | null => {
  const groupId = scope.groupId.trim();
  const relayUrl = normalizeRelayUrl(scope.relayUrl);
  if (groupId.length === 0 || relayUrl.length === 0 || relayUrl === "unknown") {
    return null;
  }
  return { groupId, relayUrl };
};

export const toCanonicalCommunityScopeKey = (scope: CommunityMembershipScope): string | null => {
  const normalized = normalizeCommunityMembershipScope(scope);
  if (!normalized) {
    return null;
  }
  return `${normalized.groupId}@@${normalized.relayUrl}`;
};

export const communityMembershipScopeMatches = (
  left: CommunityMembershipScope,
  right: CommunityMembershipScope,
): boolean => {
  const leftKey = toCanonicalCommunityScopeKey(left);
  const rightKey = toCanonicalCommunityScopeKey(right);
  return leftKey !== null && leftKey === rightKey;
};

/** Match stored tombstone/outbox keys that may use legacy relay casing. */
export const parseCommunityScopeFromStorageKey = (
  storageKey: string,
): CommunityMembershipScope | null => {
  const separatorIndex = storageKey.indexOf("@@");
  if (separatorIndex <= 0) {
    return null;
  }
  const groupId = storageKey.slice(0, separatorIndex).trim();
  const relayUrl = storageKey.slice(separatorIndex + 2).trim();
  if (groupId.length === 0 || relayUrl.length === 0) {
    return null;
  }
  return normalizeCommunityMembershipScope({ groupId, relayUrl });
};

export const communityMembershipScopeMatchesStorageKey = (
  scope: CommunityMembershipScope,
  storageKey: string,
): boolean => {
  const parsed = parseCommunityScopeFromStorageKey(storageKey);
  if (!parsed) {
    return false;
  }
  return communityMembershipScopeMatches(scope, parsed);
};
