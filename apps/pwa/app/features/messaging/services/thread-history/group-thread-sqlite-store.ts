import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { dbGetGroupMessages, isTauri, type GroupMessageRecord } from "@dweb/db";
import { parseGroupConversationStorageKey } from "@/app/features/groups/utils/group-conversation-id";
import { listAccountSharedSqliteProfileIds } from "@/app/features/profiles/services/account-shared-sqlite-profile-ids";
import { readActiveDesktopProfileId } from "@/app/features/profiles/services/read-active-desktop-profile-id";
import { getDefaultProfileId } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import type { Message } from "../../types";
import {
  THREAD_HISTORY_DEFAULT_PAGE_SIZE,
  type ThreadHistoryPage,
} from "./contracts";

/** Primary profile slot for group hydrate — mirrors sealed-group write resolver (Path B B3-3). */
export const resolveGroupThreadHydratePrimaryProfileId = (profileId?: string): string => {
  const explicit = profileId?.trim();
  if (explicit) {
    return explicit;
  }
  if (isTauri()) {
    return readActiveDesktopProfileId().trim() || getDefaultProfileId();
  }
  return getResolvedProfileId()?.trim() || getDefaultProfileId();
};

/** Dedupe rows from multi-slot scan; keep newest received_at per event_id, then cap page size. */
export const mergeGroupMessageRecordsForPage = (
  records: ReadonlyArray<GroupMessageRecord>,
  pageSize: number,
): ReadonlyArray<GroupMessageRecord> => {
  const byEventId = new Map<string, GroupMessageRecord>();
  records.forEach((record) => {
    const existing = byEventId.get(record.event_id);
    if (!existing || record.received_at >= existing.received_at) {
      byEventId.set(record.event_id, record);
    }
  });
  return Array.from(byEventId.values())
    .sort((left, right) => right.received_at - left.received_at)
    .slice(0, pageSize);
};

const loadGroupMessageRowsFromSqlite = async (params: Readonly<{
  storageGroupId: string;
  myPublicKeyHex: string | null;
  profileId?: string;
  pageSize: number;
  beforeReceivedAtMs?: number;
}>): Promise<ReadonlyArray<GroupMessageRecord>> => {
  const primaryProfileId = resolveGroupThreadHydratePrimaryProfileId(params.profileId);
  const profileIds = listAccountSharedSqliteProfileIds({
    primaryProfileId,
    accountPublicKeyHex: params.myPublicKeyHex,
  });
  const recordGroups = await Promise.all(profileIds.map(async (profileId) => (
    dbGetGroupMessages(
      profileId,
      params.storageGroupId,
      params.pageSize,
      params.beforeReceivedAtMs,
    )
  )));
  return mergeGroupMessageRecordsForPage(recordGroups.flat(), params.pageSize);
};

export const resolveGroupStorageId = (params: Readonly<{
  conversationId: string;
  groupId?: string;
  communityId?: string;
}>): string => {
  const explicit = params.groupId?.trim() || params.communityId?.trim();
  if (explicit) {
    return explicit;
  }
  const parsed = parseGroupConversationStorageKey(params.conversationId);
  if (parsed?.groupId) {
    return parsed.groupId;
  }
  return params.conversationId.trim();
};

export const mapGroupMessageRecordToMessage = (params: Readonly<{
  record: GroupMessageRecord;
  conversationId: string;
  myPublicKeyHex: string | null;
}>): Message => {
  const myKey = (params.myPublicKeyHex ?? "").toLowerCase();
  const author = params.record.sender_pubkey as PublicKeyHex;
  return {
    id: params.record.event_id,
    eventId: params.record.event_id,
    kind: "user",
    content: params.record.plaintext,
    timestamp: new Date(params.record.received_at),
    isOutgoing: myKey.length > 0 && author.toLowerCase() === myKey,
    status: "delivered",
    senderPubkey: author,
    conversationId: params.conversationId,
  };
};

const toAscendingMessages = (
  records: ReadonlyArray<GroupMessageRecord>,
  conversationId: string,
  myPublicKeyHex: string | null,
): ReadonlyArray<Message> => (
  [...records]
    .sort((left, right) => left.received_at - right.received_at)
    .map((record) => mapGroupMessageRecordToMessage({
      record,
      conversationId,
      myPublicKeyHex,
    }))
);

export const loadGroupThreadPageFromSqlite = async (params: Readonly<{
  conversationId: string;
  groupId?: string;
  communityId?: string;
  myPublicKeyHex: string | null;
  profileId?: string;
  pageSize?: number;
  beforeReceivedAtMs?: number;
}>): Promise<ThreadHistoryPage<Message>> => {
  const emptyPage: ThreadHistoryPage<Message> = {
    messages: [],
    hasEarlier: false,
    didExpandHistory: false,
    nextCursor: null,
  };
  if (!requiresSqlitePersistence() || !isTauri()) {
    return emptyPage;
  }
  if (!params.conversationId.trim()) {
    return emptyPage;
  }
  const pageSize = params.pageSize ?? THREAD_HISTORY_DEFAULT_PAGE_SIZE;
  const storageGroupId = resolveGroupStorageId({
    conversationId: params.conversationId,
    groupId: params.groupId,
    communityId: params.communityId,
  });
  const rows = await loadGroupMessageRowsFromSqlite({
    storageGroupId,
    myPublicKeyHex: params.myPublicKeyHex,
    profileId: params.profileId,
    pageSize,
    beforeReceivedAtMs: params.beforeReceivedAtMs,
  });
  const messages = toAscendingMessages(rows, params.conversationId, params.myPublicKeyHex);
  const hasEarlier = rows.length >= pageSize;
  const earliest = messages[0];
  return {
    messages,
    hasEarlier,
    didExpandHistory: Boolean(params.beforeReceivedAtMs),
    nextCursor: hasEarlier && earliest
      ? { beforeTimestampMs: earliest.timestamp.getTime(), beforeEventId: earliest.eventId }
      : null,
  };
};

export const loadGroupThreadEarlierFromSqlite = async (params: Readonly<{
  conversationId: string;
  groupId?: string;
  communityId?: string;
  myPublicKeyHex: string | null;
  profileId?: string;
  existingMessages: ReadonlyArray<Message>;
  beforeReceivedAtMs: number;
  pageSize?: number;
}>): Promise<ThreadHistoryPage<Message>> => {
  const earlierPage = await loadGroupThreadPageFromSqlite({
    conversationId: params.conversationId,
    groupId: params.groupId,
    communityId: params.communityId,
    myPublicKeyHex: params.myPublicKeyHex,
    profileId: params.profileId,
    pageSize: params.pageSize,
    beforeReceivedAtMs: params.beforeReceivedAtMs,
  });
  if (earlierPage.messages.length === 0) {
    return {
      messages: params.existingMessages,
      hasEarlier: earlierPage.hasEarlier,
      didExpandHistory: false,
      nextCursor: earlierPage.nextCursor,
    };
  }
  const byId = new Map<string, Message>();
  [...earlierPage.messages, ...params.existingMessages].forEach((message) => {
    byId.set(message.id, message);
  });
  const merged = Array.from(byId.values()).sort(
    (left, right) => left.timestamp.getTime() - right.timestamp.getTime(),
  );
  return {
    messages: merged,
    hasEarlier: earlierPage.hasEarlier,
    didExpandHistory: true,
    nextCursor: earlierPage.nextCursor,
  };
};
