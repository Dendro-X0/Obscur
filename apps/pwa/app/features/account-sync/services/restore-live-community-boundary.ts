import type { CommunityMembershipLedgerEntry } from "@/app/features/groups/services/community-membership-ledger";
import { toCommunityMembershipLedgerKey } from "@/app/features/groups/services/community-membership-ledger";
import { isGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import { toCommunityConversationId } from "@/app/features/groups/utils/community-identity";
import type { PersistedChatState } from "@/app/features/messaging/types";
import type { EncryptedAccountBackupPayload } from "../account-sync-contracts";

type RestoredChatState = NonNullable<EncryptedAccountBackupPayload["chatState"]>;

const NON_LIVE_COMMUNITY_LEDGER_STATUSES = new Set<CommunityMembershipLedgerEntry["status"]>([
  "left",
  "expelled",
  "historical",
]);

export const buildJoinedCommunityLedgerKeySet = (
  ledgerEntries: ReadonlyArray<CommunityMembershipLedgerEntry>,
): ReadonlySet<string> => {
  const joined = new Set<string>();
  for (const entry of ledgerEntries) {
    if (entry.status !== "joined") {
      continue;
    }
    const key = toCommunityMembershipLedgerKey(entry);
    if (key) {
      joined.add(key);
    }
  }
  return joined;
};

export const buildNonLiveCommunityLedgerKeySet = (
  ledgerEntries: ReadonlyArray<CommunityMembershipLedgerEntry>,
): ReadonlySet<string> => {
  const suppressed = new Set<string>();
  for (const entry of ledgerEntries) {
    if (!NON_LIVE_COMMUNITY_LEDGER_STATUSES.has(entry.status)) {
      continue;
    }
    const key = toCommunityMembershipLedgerKey(entry);
    if (key) {
      suppressed.add(key);
    }
  }
  return suppressed;
};

const parseCommunityIdFromConversationId = (conversationId: string): string | null => {
  const trimmed = conversationId.trim();
  if (!trimmed.startsWith("community:")) {
    return null;
  }
  const communityId = trimmed.slice("community:".length).trim();
  return communityId.length > 0 ? communityId : null;
};

export const resolveCommunityLedgerKeyFromConversationId = (params: Readonly<{
  conversationId: string;
  createdGroups: PersistedChatState["createdGroups"];
}>): string | null => {
  const conversationId = params.conversationId.trim();
  if (conversationId.length === 0) {
    return null;
  }

  for (const group of params.createdGroups) {
    if (group.id === conversationId) {
      return toCommunityMembershipLedgerKey({ groupId: group.groupId, relayUrl: group.relayUrl });
    }
    const communityId = group.communityId?.trim() ?? "";
    if (communityId.length > 0 && toCommunityConversationId(communityId) === conversationId) {
      return toCommunityMembershipLedgerKey({ groupId: group.groupId, relayUrl: group.relayUrl });
    }
  }

  const communityId = parseCommunityIdFromConversationId(conversationId);
  if (!communityId) {
    return null;
  }

  const relaySeparator = communityId.lastIndexOf(":");
  if (relaySeparator <= 0 || relaySeparator >= communityId.length - 1) {
    return null;
  }
  const groupId = communityId.slice(0, relaySeparator).trim();
  const relayUrl = communityId.slice(relaySeparator + 1).trim();
  if (groupId.length === 0 || relayUrl.length === 0) {
    return null;
  }
  return toCommunityMembershipLedgerKey({ groupId, relayUrl });
};

const shouldRetainLiveCommunityConversation = (params: Readonly<{
  conversationId: string;
  createdGroups: PersistedChatState["createdGroups"];
  joinedLedgerKeys: ReadonlySet<string>;
}>): boolean => {
  if (!isGroupConversationId(params.conversationId)) {
    return true;
  }
  const ledgerKey = resolveCommunityLedgerKeyFromConversationId({
    conversationId: params.conversationId,
    createdGroups: params.createdGroups,
  });
  if (!ledgerKey) {
    return false;
  }
  return params.joinedLedgerKeys.has(ledgerKey);
};

/**
 * REL-002: Restored historical / terminal ledger evidence must not drive live UI
 * (sidebar groups, unread badges, group message maps).
 */
export const sanitizeRestoredChatStateLiveCommunitySignals = (
  chatState: EncryptedAccountBackupPayload["chatState"],
  ledgerEntries: ReadonlyArray<CommunityMembershipLedgerEntry>,
): EncryptedAccountBackupPayload["chatState"] => {
  if (!chatState) {
    return chatState;
  }
  if (ledgerEntries.length === 0) {
    return chatState;
  }

  const state: RestoredChatState = chatState;
  const joinedLedgerKeys = buildJoinedCommunityLedgerKeySet(ledgerEntries);
  const retainLive = (conversationId: string): boolean => (
    shouldRetainLiveCommunityConversation({
      conversationId,
      createdGroups: state.createdGroups,
      joinedLedgerKeys,
    })
  );

  const unreadByConversationId: Record<string, number> = {};
  Object.entries(state.unreadByConversationId ?? {}).forEach(([conversationId, count]) => {
    if (!retainLive(conversationId)) {
      return;
    }
    unreadByConversationId[conversationId] = count;
  });

  const groupMessages = Object.fromEntries(
    Object.entries(state.groupMessages ?? {}).filter(([conversationId, messages]) => (
      retainLive(conversationId) && (messages ?? []).length > 0
    )),
  ) as NonNullable<PersistedChatState["groupMessages"]>;

  const pinnedChatIds = (state.pinnedChatIds ?? []).filter(retainLive);
  const hiddenChatIds = (state.hiddenChatIds ?? []).filter(retainLive);

  return {
    ...state,
    unreadByConversationId,
    groupMessages,
    pinnedChatIds,
    hiddenChatIds,
  };
};
