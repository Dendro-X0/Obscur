import type { GroupRecord } from "@dweb/db";
import { dbGetGroups, dbUpsertGroup, isTauri } from "@dweb/db";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import type { GroupConversation } from "@/app/features/messaging/types";
import type { PersistedGroupConversation } from "@/app/features/messaging/types";
import { deriveCommunityId } from "../utils/community-identity";
import { toGroupConversationId } from "../utils/group-conversation-id";

const groupRowKey = (group: Readonly<{ groupId: string; relayUrl?: string }>): string => (
  `${group.groupId}@@${group.relayUrl ?? ""}`
);

export const groupConversationToSqliteRecord = (
  group: GroupConversation,
  profileId: string,
): GroupRecord => ({
  id: group.groupId,
  profile_id: profileId,
  name: group.displayName?.trim() || group.groupId,
  relay_url: group.relayUrl ?? "",
  kind: group.access ?? "invite-only",
  joined_at: group.lastMessageTime?.getTime?.() ?? Date.now(),
});

export const sqliteGroupRecordToPersistedGroup = (
  record: GroupRecord,
  localPublicKeyHex: PublicKeyHex,
): PersistedGroupConversation => {
  const communityId = deriveCommunityId({
    groupId: record.id,
    relayUrl: record.relay_url,
  });
  const conversationId = toGroupConversationId({
    groupId: record.id,
    relayUrl: record.relay_url,
    communityId,
  });
  return {
    id: conversationId,
    communityId,
    groupId: record.id,
    relayUrl: record.relay_url,
    displayName: record.name,
    memberPubkeys: [localPublicKeyHex],
    lastMessage: "",
    unreadCount: 0,
    lastMessageTimeMs: record.joined_at,
    access: record.kind === "public" ? "open" : "invite-only",
    memberCount: 1,
    adminPubkeys: [],
  };
};

export const mergePersistedGroupRowsForNativeHydrate = (
  sqliteRows: ReadonlyArray<PersistedGroupConversation>,
  chatStateRows: ReadonlyArray<PersistedGroupConversation>,
): ReadonlyArray<PersistedGroupConversation> => {
  const merged = new Map<string, PersistedGroupConversation>();
  sqliteRows.forEach((row) => {
    merged.set(groupRowKey(row), row);
  });
  chatStateRows.forEach((row) => {
    const key = groupRowKey(row);
    const existing = merged.get(key);
    if (!existing || (row.memberPubkeys?.length ?? 0) >= (existing.memberPubkeys?.length ?? 0)) {
      merged.set(key, row);
    }
  });
  return Array.from(merged.values());
};

export const loadSqliteGroupPersistedRows = async (
  profileId: string,
  localPublicKeyHex: PublicKeyHex,
): Promise<ReadonlyArray<PersistedGroupConversation>> => {
  if (!requiresSqlitePersistence() || !isTauri()) {
    return [];
  }
  try {
    const records = await dbGetGroups(profileId);
    return records.map((record) => sqliteGroupRecordToPersistedGroup(record, localPublicKeyHex));
  } catch {
    return [];
  }
};

export const syncGroupConversationsToSqlite = async (
  groups: ReadonlyArray<GroupConversation>,
  profileId: string,
): Promise<void> => {
  if (!requiresSqlitePersistence() || !isTauri() || groups.length === 0) {
    return;
  }
  await Promise.all(
    groups.map((group) => dbUpsertGroup(groupConversationToSqliteRecord(group, profileId)).catch(() => undefined)),
  );
};
