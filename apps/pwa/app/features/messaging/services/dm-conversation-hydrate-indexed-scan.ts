/**
 * IndexedDB / SQLite window load + multi-pass scan for DM hydrate / load-earlier.
 * R1: I/O + row merge lives here; row→Message mapping stays caller-supplied (typically **`normalizeDmConversationMessageRow`** in **`dm-conversation-normalize-message.ts`**).
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { dbGetMessages } from "@dweb/db";
import type { MessageRecord } from "@dweb/db";
import { listAccountSharedSqliteProfileIds } from "@/app/features/profiles/services/account-shared-sqlite-profile-ids";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import type { Message } from "../types";

const normalizeAccountPublicKeyHex = (value: PublicKeyHex | string | null | undefined): PublicKeyHex | null => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
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

const sqliteRowToRaw = (rec: MessageRecord): Record<string, unknown> => ({
  id: rec.event_id,
  eventId: rec.event_id,
  conversationId: rec.conversation_id,
  content: rec.plaintext,
  senderPubkey: rec.sender_pubkey,
  recipientPubkey: rec.recipient_pubkey,
  isOutgoing: rec.is_outgoing,
  kind: rec.kind,
  timestampMs: rec.received_at,
  timestamp: new Date(rec.received_at),
  status: "delivered",
});

const mergeSqliteMessageRecords = (
  records: ReadonlyArray<MessageRecord>,
  limit: number,
  accountPublicKeyHex?: PublicKeyHex | string | null,
): ReadonlyArray<any> => {
  const normalizedAccount = normalizeAccountPublicKeyHex(accountPublicKeyHex);
  const byEventId = new Map<string, MessageRecord>();
  records.forEach((record) => {
    if (normalizedAccount && !sqliteRowInvolvesAccount(record, normalizedAccount)) {
      return;
    }
    const existing = byEventId.get(record.event_id);
    if (!existing || record.received_at >= existing.received_at) {
      byEventId.set(record.event_id, record);
    }
  });
  return Array.from(byEventId.values())
    .sort((left, right) => right.received_at - left.received_at)
    .slice(0, limit)
    .map(sqliteRowToRaw);
};

export const loadConversationWindow = async (params: Readonly<{
  conversationId: string;
  limit: number;
  beforeTimestampMs?: number;
  accountPublicKeyHex?: PublicKeyHex | string | null;
}>): Promise<ReadonlyArray<any>> => {
  if (requiresSqlitePersistence()) {
    try {
      const primaryProfileId = getResolvedProfileId();
      const profileIds = listAccountSharedSqliteProfileIds({
        primaryProfileId,
        accountPublicKeyHex: params.accountPublicKeyHex,
      });
      const beforeTimestampMs = typeof params.beforeTimestampMs === "number"
        ? params.beforeTimestampMs
        : undefined;
      const recordGroups = await Promise.all(profileIds.map(async (profileId) => (
        dbGetMessages(profileId, params.conversationId, params.limit, beforeTimestampMs)
      )));
      return mergeSqliteMessageRecords(
        recordGroups.flat(),
        params.limit,
        params.accountPublicKeyHex,
      );
    } catch {
      return [];
    }
  }
  void params;
  return [];
};

const toRowTimestampMs = (row: any): number => {
  const timestampMs = Number(row?.timestampMs ?? (row?.timestamp instanceof Date ? row.timestamp.getTime() : row?.timestamp));
  if (Number.isFinite(timestampMs)) {
    return timestampMs;
  }
  return 0;
};

const findEarliestValidRowTimestampMs = (rows: ReadonlyArray<any>): number | null => {
  let earliestTimestampMs = Number.POSITIVE_INFINITY;
  rows.forEach((row) => {
    const timestampMs = toRowTimestampMs(row);
    if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
      return;
    }
    if (timestampMs < earliestTimestampMs) {
      earliestTimestampMs = timestampMs;
    }
  });
  return Number.isFinite(earliestTimestampMs) ? earliestTimestampMs : null;
};

const mergeConversationRows = (params: Readonly<{
  rowsByConversationId: ReadonlyArray<Readonly<{ conversationId: string; rows: ReadonlyArray<any> }>>;
  limit: number;
}>): Readonly<{ rows: ReadonlyArray<any>; hasEarlier: boolean }> => {
  const byMessageKey = new Map<string, any>();
  let hasEarlier = false;

  params.rowsByConversationId.forEach(({ rows }) => {
    if (rows.length >= params.limit) {
      hasEarlier = true;
    }
    rows.forEach((row) => {
      const messageId = typeof row?.id === "string" ? row.id : "";
      const eventId = typeof row?.eventId === "string" ? row.eventId : "";
      const dedupeKey = eventId || messageId || `${toRowTimestampMs(row)}:${JSON.stringify(row?.content ?? "")}`;
      const existing = byMessageKey.get(dedupeKey);
      if (!existing || toRowTimestampMs(row) >= toRowTimestampMs(existing)) {
        byMessageKey.set(dedupeKey, row);
      }
    });
  });

  const newestFirst = Array.from(byMessageKey.values()).sort((left, right) => toRowTimestampMs(right) - toRowTimestampMs(left));
  if (newestFirst.length > params.limit) {
    hasEarlier = true;
  }
  return {
    rows: newestFirst.slice(0, params.limit),
    hasEarlier,
  };
};

export const loadConversationWindowAcrossAliases = async (params: Readonly<{
  conversationIds: ReadonlyArray<string>;
  limit: number;
  beforeTimestampMs?: number;
  accountPublicKeyHex?: PublicKeyHex | string | null;
}>): Promise<Readonly<{ rows: ReadonlyArray<any>; hasEarlier: boolean }>> => {
  const conversationIds = Array.from(new Set(
    params.conversationIds
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  ));
  if (conversationIds.length === 0) {
    return { rows: [], hasEarlier: false };
  }

  const rowsByConversationId = await Promise.all(conversationIds.map(async (conversationId) => ({
    conversationId,
    rows: await loadConversationWindow({
      conversationId,
      limit: params.limit,
      beforeTimestampMs: params.beforeTimestampMs,
      accountPublicKeyHex: params.accountPublicKeyHex,
    }),
  })));

  return mergeConversationRows({
    rowsByConversationId,
    limit: params.limit,
  });
};

export const scanDisplayableHistoryWindow = async (params: Readonly<{
  conversationIds: ReadonlyArray<string>;
  initialRows: ReadonlyArray<any>;
  initialHasEarlier: boolean;
  limit: number;
  mapRows: (rows: ReadonlyArray<any>) => ReadonlyArray<Message>;
  targetVisibleCount?: number;
  maxPassCount?: number;
  accountPublicKeyHex?: PublicKeyHex | string | null;
}>): Promise<Readonly<{ messages: ReadonlyArray<Message>; hasEarlier: boolean }>> => {
  let collectedRows = [...params.initialRows];
  let hasEarlier = params.initialHasEarlier;
  let mappedMessages = params.mapRows(collectedRows);
  let passCount = 0;
  const targetVisibleCount = Number.isFinite(params.targetVisibleCount)
    ? Math.max(1, Math.floor(params.targetVisibleCount ?? 1))
    : 1;
  const maxPassCount = Number.isFinite(params.maxPassCount)
    ? Math.max(1, Math.floor(params.maxPassCount ?? 1))
    : 4;

  while (mappedMessages.length < targetVisibleCount && hasEarlier && passCount < maxPassCount) {
    passCount += 1;
    const beforeTimestampMs = findEarliestValidRowTimestampMs(collectedRows);
    if (!beforeTimestampMs || beforeTimestampMs <= 0) {
      break;
    }
    const earlierWindow = await loadConversationWindowAcrossAliases({
      conversationIds: params.conversationIds,
      limit: params.limit,
      beforeTimestampMs,
      accountPublicKeyHex: params.accountPublicKeyHex,
    });
    if (earlierWindow.rows.length === 0) {
      hasEarlier = false;
      break;
    }
    collectedRows = [...collectedRows, ...earlierWindow.rows];
    hasEarlier = earlierWindow.hasEarlier;
    mappedMessages = params.mapRows(collectedRows);
  }

  return {
    messages: mappedMessages,
    hasEarlier,
  };
};

/** Initial hydrate: latest window + scan passes + soft cap slice for downstream authority. */
export const loadInitialDmHydrationIndexedWindow = async (params: Readonly<{
  conversationIds: ReadonlyArray<string>;
  initialBatchSize: number;
  mapRows: (rows: ReadonlyArray<any>) => ReadonlyArray<Message>;
  targetVisibleCount: number;
  maxPassCount: number;
  liveWindowSoftLimit: number;
  accountPublicKeyHex?: PublicKeyHex | string | null;
}>): Promise<Readonly<{
  retentionFilteredMapped: ReadonlyArray<Message>;
  cappedHydratedMessages: ReadonlyArray<Message>;
  hasEarlier: boolean;
  shouldCapHydratedHistoryWindow: boolean;
}>> => {
  const latestWindow = await loadConversationWindowAcrossAliases({
    conversationIds: params.conversationIds,
    limit: params.initialBatchSize,
    accountPublicKeyHex: params.accountPublicKeyHex,
  });
  const scannedWindow = await scanDisplayableHistoryWindow({
    conversationIds: params.conversationIds,
    initialRows: latestWindow.rows,
    initialHasEarlier: latestWindow.hasEarlier,
    limit: params.initialBatchSize,
    mapRows: params.mapRows,
    targetVisibleCount: params.targetVisibleCount,
    maxPassCount: params.maxPassCount,
    accountPublicKeyHex: params.accountPublicKeyHex,
  });
  const retentionFilteredMapped = scannedWindow.messages;
  const shouldCapHydratedHistoryWindow = retentionFilteredMapped.length > params.liveWindowSoftLimit;
  const cappedHydratedMessages = shouldCapHydratedHistoryWindow
    ? retentionFilteredMapped.slice(-params.liveWindowSoftLimit)
    : retentionFilteredMapped;
  return {
    retentionFilteredMapped,
    cappedHydratedMessages,
    hasEarlier: scannedWindow.hasEarlier,
    shouldCapHydratedHistoryWindow,
  };
};
