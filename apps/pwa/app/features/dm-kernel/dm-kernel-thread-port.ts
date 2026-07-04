import { dbGetMessages } from "@dweb/db";
import type { MessageRecord } from "@dweb/db";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { fetchDmThreadRows } from "@obscur/dm-engine";
import { createTauriEngineHost } from "@obscur/engine-host/tauri";
import type { HostEnginePort } from "@obscur/engine-contracts";
import type { Message } from "@/app/features/messaging/types";
import { listAccountSharedSqliteProfileIds } from "@/app/features/profiles/services/account-shared-sqlite-profile-ids";
import { isEngineLabStrictMode } from "@/app/engine-lab/engine-lab-policy";
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

let dmKernelEngineHost: HostEnginePort | null = null;

const getDmKernelEngineHost = (): HostEnginePort => {
  dmKernelEngineHost ??= createTauriEngineHost();
  return dmKernelEngineHost;
};

const normalizeAccountPublicKeyHex = (value: string): PublicKeyHex | null => {
  const normalized = value.trim().toLowerCase();
  if (normalized.length !== 64) {
    return null;
  }
  return normalized as PublicKeyHex;
};

const sqliteRowInvolvesAccount = (
  record: MessageRecord,
  accountPublicKeyHex: PublicKeyHex,
): boolean => {
  const account = accountPublicKeyHex.trim().toLowerCase();
  const sender = record.sender_pubkey.trim().toLowerCase();
  const recipient = record.recipient_pubkey.trim().toLowerCase();
  return sender === account || recipient === account;
};

const fetchThreadRowsForProfileSlot = async (
  params: LoadDmKernelThreadParams,
  profileSlotId: string,
  queryId: string,
  limit: number,
): Promise<ReadonlyArray<MessageRecord>> => {
  if (isEngineLabStrictMode()) {
    return fetchDmThreadRows({
      host: getDmKernelEngineHost(),
      profileId: profileSlotId,
      payload: {
        conversationId: queryId,
        limit,
        beforeReceivedAt: params.beforeReceivedAt,
      },
    });
  }
  return dbGetMessages(profileSlotId, queryId, limit, params.beforeReceivedAt);
};

const fetchThreadRowsForQueryId = async (
  params: LoadDmKernelThreadParams,
  queryId: string,
  limit: number,
): Promise<ReadonlyArray<MessageRecord>> => {
  const profileIds = listAccountSharedSqliteProfileIds({
    primaryProfileId: params.profileId,
    accountPublicKeyHex: params.myPublicKeyHex,
  });
  const accountPublicKeyHex = normalizeAccountPublicKeyHex(params.myPublicKeyHex);
  const rowByEventId = new Map<string, MessageRecord>();

  await Promise.all(profileIds.map(async (profileSlotId) => {
    const rows = await fetchThreadRowsForProfileSlot(params, profileSlotId, queryId, limit);
    for (const row of rows) {
      if (accountPublicKeyHex && !sqliteRowInvolvesAccount(row, accountPublicKeyHex)) {
        continue;
      }
      const existing = rowByEventId.get(row.event_id);
      if (!existing || row.received_at >= existing.received_at) {
        rowByEventId.set(row.event_id, row);
      }
    }
  }));

  return [...rowByEventId.values()].sort((left, right) => left.received_at - right.received_at);
};

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
    const rows = await fetchThreadRowsForQueryId(params, queryId, limit);
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
    if (cached && cached.length > 0) {
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

  if (isInitialPage && messages.length > 0) {
    writeDmKernelThreadSessionCache(params.profileId, storageConversationId, messages);
  }

  return messages;
};
