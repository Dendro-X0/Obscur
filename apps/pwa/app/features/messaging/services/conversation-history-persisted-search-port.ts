import { chatStateStoreService } from "./chat-state-store-legacy";
import {
  mapPersistedMessageToHistorySearchResult,
  type ConversationHistorySearchResult,
} from "@/app/features/messaging/services/conversation-history-search";
import { isNativeDmSqliteReadOwner } from "@/app/features/messaging/services/native-dm-read-policy";

/** Persisted chat-state history search — legacy-backed until sqlite thread search lands. */
export const searchConversationPersistedHistory = async (
  conversationId: string,
  query: string,
  limit: number,
): Promise<ReadonlyArray<ConversationHistorySearchResult>> => {
  if (isNativeDmSqliteReadOwner() || !query.trim()) {
    return [];
  }
  const searchResults = await chatStateStoreService.searchMessages(query, limit);
  return searchResults
    .filter((result) => result.conversationId === conversationId)
    .map((result) => mapPersistedMessageToHistorySearchResult(result.message));
};
