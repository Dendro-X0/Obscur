import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import type { PersistedGroupMessage } from "@/app/features/messaging/types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { resolveGroupConversationIdAliases } from "@/app/features/groups/utils/group-conversation-id";
import { listAccountSharedSqliteProfileIds } from "@/app/features/profiles/services/account-shared-sqlite-profile-ids";
import { readActiveDesktopProfileId } from "@/app/features/profiles/services/read-active-desktop-profile-id";
import { getDefaultProfileId } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { logAppEvent } from "@/app/shared/log-app-event";
import type { GroupMessageRecord } from "@dweb/db";
import { dbGetGroupMessages, dbInsertGroupMessage, isTauri } from "@dweb/db";

export type SealedGroupMessageRecord = Readonly<{
  id: string;
  pubkey: string;
  created_at: number;
  content: string;
}>;

const MAX_PERSISTED_GROUP_MESSAGES = 200;
const pendingSqliteWriteTasks = new Set<Promise<void>>();

const toPersistedGroupMessage = (message: SealedGroupMessageRecord): PersistedGroupMessage => ({
  id: message.id,
  pubkey: message.pubkey,
  created_at: message.created_at,
  content: message.content,
});

/** Stable profile slot for sealed-group durability across cold desktop restart. */
const resolveSealedGroupPersistenceProfileId = (profileId?: string): string => {
  const explicit = profileId?.trim();
  if (explicit) {
    return explicit;
  }
  if (isTauri()) {
    return readActiveDesktopProfileId().trim() || getDefaultProfileId();
  }
  return getResolvedProfileId().trim() || getDefaultProfileId();
};

const mergeSealedGroupMessageRecords = (
  records: ReadonlyArray<SealedGroupMessageRecord>,
): ReadonlyArray<SealedGroupMessageRecord> => {
  const byEventId = new Map<string, SealedGroupMessageRecord>();
  records.forEach((record) => {
    const existing = byEventId.get(record.id);
    if (!existing || record.created_at >= existing.created_at) {
      byEventId.set(record.id, record);
    }
  });
  return Array.from(byEventId.values())
    .sort((left, right) => right.created_at - left.created_at)
    .slice(0, MAX_PERSISTED_GROUP_MESSAGES);
};

const trackPendingSqliteWrite = (task: Promise<void>): Promise<void> => {
  pendingSqliteWriteTasks.add(task);
  return task.finally(() => {
    pendingSqliteWriteTasks.delete(task);
  });
};

export const flushPendingSealedGroupSqliteWrites = async (): Promise<void> => {
  if (pendingSqliteWriteTasks.size === 0) {
    return;
  }
  await Promise.allSettled([...pendingSqliteWriteTasks]);
};

const mapSqliteGroupMessageRecord = (record: GroupMessageRecord): SealedGroupMessageRecord => ({
  id: record.event_id,
  pubkey: record.sender_pubkey,
  created_at: Math.floor(record.created_at / 1000),
  content: record.plaintext,
});

const mergeSqliteGroupMessageRecords = (
  records: ReadonlyArray<GroupMessageRecord>,
): ReadonlyArray<SealedGroupMessageRecord> => (
  mergeSealedGroupMessageRecords(records.map(mapSqliteGroupMessageRecord))
);

const loadSqliteGroupMessages = async (params: Readonly<{
  groupId: string;
  publicKeyHex: PublicKeyHex;
  profileId?: string;
}>): Promise<ReadonlyArray<SealedGroupMessageRecord>> => {
  const primaryProfileId = resolveSealedGroupPersistenceProfileId(params.profileId);
  const profileIds = listAccountSharedSqliteProfileIds({
    primaryProfileId,
    accountPublicKeyHex: params.publicKeyHex,
  });
  const recordGroups = await Promise.all(profileIds.map(async (profileId) => (
    dbGetGroupMessages(profileId, params.groupId, MAX_PERSISTED_GROUP_MESSAGES)
  )));
  return mergeSqliteGroupMessageRecords(recordGroups.flat());
};

const loadGroupMessagesFromChatStateAliases = (params: Readonly<{
  conversationId: string;
  groupId: string;
  relayUrl?: string;
  communityId?: string;
  publicKeyHex: PublicKeyHex;
  profileId: string;
}>): ReadonlyArray<SealedGroupMessageRecord> => {
  const profileIds = listAccountSharedSqliteProfileIds({
    primaryProfileId: params.profileId,
    accountPublicKeyHex: params.publicKeyHex,
  });
  const aliasIds = resolveGroupConversationIdAliases({
    conversationId: params.conversationId,
    groupId: params.groupId,
    relayUrl: params.relayUrl,
    communityId: params.communityId,
  });
  const merged: SealedGroupMessageRecord[] = [];
  profileIds.forEach((scopedProfileId) => {
    const persisted = chatStateStoreService.load(params.publicKeyHex, { profileId: scopedProfileId });
    aliasIds.forEach((aliasId) => {
      const rows = persisted?.groupMessages?.[aliasId] ?? [];
      rows.forEach((row) => {
        if (!row.id?.trim()) {
          return;
        }
        merged.push({
          id: row.id,
          pubkey: row.pubkey,
          created_at: row.created_at,
          content: row.content,
        });
      });
    });
  });
  return mergeSealedGroupMessageRecords(merged);
};

export const loadPersistedSealedGroupMessages = async (params: Readonly<{
  conversationId: string;
  groupId: string;
  relayUrl?: string;
  communityId?: string;
  publicKeyHex: PublicKeyHex;
  profileId?: string;
}>): Promise<ReadonlyArray<SealedGroupMessageRecord>> => {
  const profileId = resolveSealedGroupPersistenceProfileId(params.profileId);
  const chatStateRecords = loadGroupMessagesFromChatStateAliases({
    conversationId: params.conversationId,
    groupId: params.groupId,
    relayUrl: params.relayUrl,
    communityId: params.communityId,
    publicKeyHex: params.publicKeyHex,
    profileId,
  });

  if (!isTauri()) {
    return chatStateRecords;
  }

  let sqliteRecords: ReadonlyArray<SealedGroupMessageRecord> = [];
  try {
    sqliteRecords = await loadSqliteGroupMessages({
      groupId: params.groupId,
      publicKeyHex: params.publicKeyHex,
      profileId,
    });
  } catch (error) {
    logAppEvent({
      name: "groups.message_sqlite_load_failed",
      level: "warn",
      scope: { feature: "groups", action: "message_hydrate" },
      context: {
        groupIdHint: params.groupId.slice(0, 16),
        profileId: profileId.slice(0, 32),
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }

  return mergeSealedGroupMessageRecords([...sqliteRecords, ...chatStateRecords]);
};

export const persistSealedGroupMessagesToSqlite = async (params: Readonly<{
  groupId: string;
  messages: ReadonlyArray<SealedGroupMessageRecord>;
  profileId?: string;
  publicKeyHex?: PublicKeyHex;
}>): Promise<void> => {
  if (!isTauri() || params.messages.length === 0) {
    return;
  }
  const profileId = resolveSealedGroupPersistenceProfileId(params.profileId);
  if (!profileId) {
    return;
  }
  const receivedAt = Date.now();
  const writeTask = Promise.all(params.messages.map(async (message) => {
    const senderPubkey = message.pubkey?.trim()
      || params.publicKeyHex?.trim()
      || "";
    if (!senderPubkey) {
      return;
    }
    try {
      await dbInsertGroupMessage({
        event_id: message.id,
        group_id: params.groupId,
        profile_id: profileId,
        sender_pubkey: senderPubkey,
        plaintext: message.content,
        created_at: message.created_at * 1000,
        received_at: receivedAt,
      });
    } catch (error) {
      logAppEvent({
        name: "groups.message_sqlite_persist_failed",
        level: "warn",
        scope: { feature: "groups", action: "message_persist" },
        context: {
          groupIdHint: params.groupId.slice(0, 16),
          eventIdHint: message.id.slice(0, 16),
          profileId: profileId.slice(0, 32),
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  })).then(() => undefined);
  await trackPendingSqliteWrite(writeTask);
};

export const mirrorSealedGroupMessagesToChatState = (params: Readonly<{
  conversationId: string;
  publicKeyHex: PublicKeyHex;
  messages: ReadonlyArray<SealedGroupMessageRecord>;
  profileId?: string;
}>): void => {
  if (typeof window === "undefined" || params.messages.length === 0) {
    return;
  }
  const profileId = resolveSealedGroupPersistenceProfileId(params.profileId);
  const persisted = chatStateStoreService.load(params.publicKeyHex, { profileId });
  const existing = persisted?.groupMessages?.[params.conversationId] ?? [];
  const byId = new Map<string, PersistedGroupMessage>();
  existing.forEach((message) => {
    byId.set(message.id, message);
  });
  params.messages.forEach((message) => {
    byId.set(message.id, toPersistedGroupMessage(message));
  });
  const merged = Array.from(byId.values())
    .sort((left, right) => right.created_at - left.created_at)
    .slice(0, MAX_PERSISTED_GROUP_MESSAGES);
  chatStateStoreService.update(
    params.publicKeyHex,
    (prev) => ({
      ...prev,
      groupMessages: {
        ...prev.groupMessages,
        [params.conversationId]: merged,
      },
    }),
    { debounceMs: 0 },
  );
};

/** Canonical durable write after relay-confirmed group message (native SQLite + web chat-state). */
export const commitSealedGroupMessages = async (params: Readonly<{
  conversationId: string;
  groupId: string;
  publicKeyHex: PublicKeyHex;
  messages: ReadonlyArray<SealedGroupMessageRecord>;
  profileId?: string;
}>): Promise<void> => {
  if (params.messages.length === 0) {
    return;
  }
  await persistSealedGroupMessagesToSqlite({
    groupId: params.groupId,
    messages: params.messages,
    profileId: params.profileId,
    publicKeyHex: params.publicKeyHex,
  });
  mirrorSealedGroupMessagesToChatState({
    conversationId: params.conversationId,
    publicKeyHex: params.publicKeyHex,
    messages: params.messages,
    profileId: params.profileId,
  });
};

export const persistSealedGroupMessages = (params: Readonly<{
  conversationId: string;
  publicKeyHex: PublicKeyHex;
  messages: ReadonlyArray<SealedGroupMessageRecord>;
  profileId?: string;
}>): void => {
  if (requiresSqlitePersistence()) {
    return;
  }
  mirrorSealedGroupMessagesToChatState(params);
};
