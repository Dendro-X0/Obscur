import { dbGetMessages } from "@dweb/db";
import type { MessageRecord } from "@dweb/db";
import type { Message } from "@/app/features/messaging/types";
import { normalizeDmConversationMessageRow } from "@/app/features/messaging/services/dm-conversation-normalize-message";
import { recordDmKernelInvoke } from "./dm-kernel-invoke-audit";
import {
  ensureDmKernelThreadSessionCacheInvalidation,
  readDmKernelThreadSessionCache,
  writeDmKernelThreadSessionCache,
} from "./dm-kernel-thread-session-cache";
import {
  resolveDmKernelStorageConversationId,
  resolveDmKernelThreadQueryConversationIds,
} from "./dm-kernel-thread-query";

export const DM_KERNEL_PAGE_SIZE = 200;

const messageRecordToNormalizeInput = (row: MessageRecord) => ({
  id: row.event_id,
  eventId: row.event_id,
  conversationId: row.conversation_id,
  content: row.plaintext,
  timestampMs: row.received_at,
  senderPubkey: row.sender_pubkey,
  recipientPubkey: row.recipient_pubkey,
  isOutgoing: row.is_outgoing,
  status: "delivered" as const,
  kind: "user" as const,
});

export type LoadDmKernelThreadParams = Readonly<{
  profileId: string;
  conversationId: string;
  myPublicKeyHex: string;
  limit?: number;
  beforeReceivedAt?: number;
}>;

const fetchThreadRowsAcrossAliases = async (
  params: LoadDmKernelThreadParams,
): Promise<ReadonlyArray<MessageRecord>> => {
  const limit = params.limit ?? DM_KERNEL_PAGE_SIZE;
  const queryIds = resolveDmKernelThreadQueryConversationIds(params);
  const rowByEventId = new Map<string, MessageRecord>();
  await Promise.all(queryIds.map(async (queryId) => {
    const rows = await dbGetMessages(
      params.profileId,
      queryId,
      limit,
      params.beforeReceivedAt,
    );
    for (const row of rows) {
      rowByEventId.set(row.event_id, row);
    }
  }));
  return [...rowByEventId.values()].sort((left, right) => left.received_at - right.received_at);
};

/** Sole native DM thread read — SQLite rows only, sorted ascending. */
export const loadDmKernelThread = async (params: LoadDmKernelThreadParams): Promise<Message[]> => {
  ensureDmKernelThreadSessionCacheInvalidation();

  const storageConversationId = resolveDmKernelStorageConversationId(params);
  const isInitialPage = params.beforeReceivedAt == null;
  if (isInitialPage) {
    const cached = readDmKernelThreadSessionCache(params.profileId, storageConversationId);
    if (cached) {
      recordDmKernelInvoke({
        kind: "messages_initial",
        profileId: params.profileId,
        conversationId: storageConversationId,
        atUnixMs: Date.now(),
        source: "session_cache",
      });
      return [...cached];
    }
  }

  recordDmKernelInvoke({
    kind: isInitialPage ? "messages_initial" : "messages_pagination",
    profileId: params.profileId,
    conversationId: storageConversationId,
    atUnixMs: Date.now(),
    source: "sqlite",
  });

  const rows = await fetchThreadRowsAcrossAliases(params);
  const limit = params.limit ?? DM_KERNEL_PAGE_SIZE;
  const windowedRows = isInitialPage ? rows.slice(-limit) : rows;

  const messages = windowedRows
    .map((row) => normalizeDmConversationMessageRow(
      messageRecordToNormalizeInput(row),
      { conversationId: storageConversationId, myPublicKeyHex: params.myPublicKeyHex },
    ))
    .sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());

  if (isInitialPage) {
    writeDmKernelThreadSessionCache(params.profileId, storageConversationId, messages);
  }

  return messages;
};
