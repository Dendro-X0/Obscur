import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupMessageRecord, GroupRecord, MessageRecord } from "@dweb/db";
import {
  dbGetConversations,
  dbGetGroupMessages,
  dbGetGroups,
  dbGetMessages,
  dbInsertGroupMessage,
  dbInsertMessage,
  dbUpsertGroup,
  isTauri,
} from "@dweb/db";
import { syncPersistedGroupsToSqliteFromChatState } from "@/app/features/groups/services/community-group-sqlite-store";
import type { PersistedChatState } from "@/app/features/messaging/types";
import { listAccountSharedSqliteProfileIds } from "@/app/features/profiles/services/account-shared-sqlite-profile-ids";
import { getDefaultProfileId } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import type { NativeSqliteBackupEvidenceSnapshot } from "../account-sync-contracts";

const DM_MESSAGE_LIMIT = 200;
const GROUP_MESSAGE_LIMIT = 200;

const groupRecordKey = (record: GroupRecord): string => (
  `${record.id}@@${record.relay_url}`
);

const sqliteRowInvolvesAccount = (
  record: MessageRecord,
  accountPublicKeyHex: string,
): boolean => {
  const account = accountPublicKeyHex.trim().toLowerCase();
  const sender = record.sender_pubkey.trim().toLowerCase();
  const recipient = record.recipient_pubkey.trim().toLowerCase();
  return sender === account || recipient === account;
};

const mergeMessageRecords = (
  records: ReadonlyArray<MessageRecord>,
): ReadonlyArray<MessageRecord> => {
  const byEventId = new Map<string, MessageRecord>();
  records.forEach((record) => {
    const existing = byEventId.get(record.event_id);
    if (!existing || record.received_at >= existing.received_at) {
      byEventId.set(record.event_id, record);
    }
  });
  return Array.from(byEventId.values());
};

const mergeGroupMessageRecords = (
  records: ReadonlyArray<GroupMessageRecord>,
): ReadonlyArray<GroupMessageRecord> => {
  const byEventId = new Map<string, GroupMessageRecord>();
  records.forEach((record) => {
    const existing = byEventId.get(record.event_id);
    if (!existing || record.received_at >= existing.received_at) {
      byEventId.set(record.event_id, record);
    }
  });
  return Array.from(byEventId.values());
};

const mergeGroupRecords = (
  records: ReadonlyArray<GroupRecord>,
): ReadonlyArray<GroupRecord> => {
  const byKey = new Map<string, GroupRecord>();
  records.forEach((record) => {
    const key = groupRecordKey(record);
    const existing = byKey.get(key);
    if (!existing || record.joined_at >= existing.joined_at) {
      byKey.set(key, record);
    }
  });
  return Array.from(byKey.values());
};

const isMessageRecord = (value: unknown): value is MessageRecord => (
  !!value
  && typeof value === "object"
  && typeof (value as MessageRecord).event_id === "string"
  && typeof (value as MessageRecord).conversation_id === "string"
  && typeof (value as MessageRecord).plaintext === "string"
);

const isGroupMessageRecord = (value: unknown): value is GroupMessageRecord => (
  !!value
  && typeof value === "object"
  && typeof (value as GroupMessageRecord).event_id === "string"
  && typeof (value as GroupMessageRecord).group_id === "string"
  && typeof (value as GroupMessageRecord).plaintext === "string"
);

const isGroupRecord = (value: unknown): value is GroupRecord => (
  !!value
  && typeof value === "object"
  && typeof (value as GroupRecord).id === "string"
  && typeof (value as GroupRecord).relay_url === "string"
);

export const parseNativeSqliteBackupEvidence = (
  value: unknown,
): NativeSqliteBackupEvidenceSnapshot | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const parsed = value as Partial<NativeSqliteBackupEvidenceSnapshot>;
  if (typeof parsed.collectedAtUnixMs !== "number" || typeof parsed.primaryProfileId !== "string") {
    return undefined;
  }
  const dmMessages = Array.isArray(parsed.dmMessages)
    ? parsed.dmMessages.filter(isMessageRecord)
    : [];
  const groupMessages = Array.isArray(parsed.groupMessages)
    ? parsed.groupMessages.filter(isGroupMessageRecord)
    : [];
  const groupRecords = Array.isArray(parsed.groupRecords)
    ? parsed.groupRecords.filter(isGroupRecord)
    : [];
  if (dmMessages.length === 0 && groupMessages.length === 0 && groupRecords.length === 0) {
    return undefined;
  }
  return {
    collectedAtUnixMs: parsed.collectedAtUnixMs,
    primaryProfileId: parsed.primaryProfileId.trim() || getDefaultProfileId(),
    dmMessages,
    groupMessages,
    groupRecords,
  };
};

/** Path B B4-1 — collect DM/group sqlite rows for encrypted backup publish on native. */
export const collectNativeSqliteBackupEvidence = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId?: string;
}>): Promise<NativeSqliteBackupEvidenceSnapshot | undefined> => {
  if (!requiresSqlitePersistence() || !isTauri()) {
    return undefined;
  }
  const primaryProfileId = params.profileId?.trim()
    || getResolvedProfileId()?.trim()
    || getDefaultProfileId();
  const profileIds = listAccountSharedSqliteProfileIds({
    primaryProfileId,
    accountPublicKeyHex: params.publicKeyHex,
  });
  const account = params.publicKeyHex.trim().toLowerCase();
  const dmRows: MessageRecord[] = [];
  const groupMessageRows: GroupMessageRecord[] = [];
  const groupRows: GroupRecord[] = [];

  await Promise.all(profileIds.map(async (profileId) => {
    const conversations = await dbGetConversations(profileId).catch(() => []);
    const conversationRows = await Promise.all(conversations.map(async (conversation) => (
      dbGetMessages(profileId, conversation.id, DM_MESSAGE_LIMIT).catch(() => [])
    )));
    conversationRows.flat().forEach((row) => {
      if (sqliteRowInvolvesAccount(row, account)) {
        dmRows.push(row);
      }
    });

    const groups = await dbGetGroups(profileId).catch(() => []);
    groupRows.push(...groups);
    const messageGroups = await Promise.all(groups.map(async (group) => (
      dbGetGroupMessages(profileId, group.id, GROUP_MESSAGE_LIMIT).catch(() => [])
    )));
    groupMessageRows.push(...messageGroups.flat());
  }));

  const dmMessages = mergeMessageRecords(dmRows);
  const groupMessages = mergeGroupMessageRecords(groupMessageRows);
  const groupRecords = mergeGroupRecords(groupRows);
  if (dmMessages.length === 0 && groupMessages.length === 0 && groupRecords.length === 0) {
    return undefined;
  }
  return {
    collectedAtUnixMs: Date.now(),
    primaryProfileId,
    dmMessages,
    groupMessages,
    groupRecords,
  };
};

export const mergeNativeSqliteBackupEvidence = (
  left: NativeSqliteBackupEvidenceSnapshot | null | undefined,
  right: NativeSqliteBackupEvidenceSnapshot | null | undefined,
): NativeSqliteBackupEvidenceSnapshot | undefined => {
  if (!left && !right) {
    return undefined;
  }
  if (!left) {
    return right ?? undefined;
  }
  if (!right) {
    return left;
  }
  return {
    collectedAtUnixMs: Math.max(left.collectedAtUnixMs, right.collectedAtUnixMs),
    primaryProfileId: right.primaryProfileId || left.primaryProfileId,
    dmMessages: mergeMessageRecords([...left.dmMessages, ...right.dmMessages]),
    groupMessages: mergeGroupMessageRecords([...left.groupMessages, ...right.groupMessages]),
    groupRecords: mergeGroupRecords([...left.groupRecords, ...right.groupRecords]),
  };
};

/** Path B B4-1 restore leg — write sqlite evidence rows on native after backup restore. */
export const applyNativeSqliteBackupEvidence = async (params: Readonly<{
  profileId: string;
  evidence: NativeSqliteBackupEvidenceSnapshot | null | undefined;
}>): Promise<void> => {
  if (!requiresSqlitePersistence() || !isTauri() || !params.evidence) {
    return;
  }
  const profileId = params.profileId.trim();
  if (!profileId) {
    return;
  }
  await Promise.all([
    ...params.evidence.groupRecords.map((group) => (
      dbUpsertGroup({ ...group, profile_id: profileId }).catch(() => undefined)
    )),
    ...params.evidence.dmMessages.map((message) => (
      dbInsertMessage({ ...message, profile_id: profileId }).catch(() => undefined)
    )),
    ...params.evidence.groupMessages.map((message) => (
      dbInsertGroupMessage({ ...message, profile_id: profileId }).catch(() => undefined)
    )),
  ]);
};

/** Path B B4-2 — restore group list + sqlite message bodies on native. */
export const applyNativeRestoreSqliteMaterialization = async (params: Readonly<{
  profileId: string;
  chatState: PersistedChatState | null | undefined;
  nativeSqliteEvidence?: NativeSqliteBackupEvidenceSnapshot | null | undefined;
}>): Promise<void> => {
  if (!requiresSqlitePersistence() || !isTauri()) {
    return;
  }
  const profileId = params.profileId.trim();
  if (!profileId) {
    return;
  }
  if (params.chatState?.createdGroups?.length) {
    await syncPersistedGroupsToSqliteFromChatState(params.chatState.createdGroups, profileId);
  }
  await applyNativeSqliteBackupEvidence({
    profileId,
    evidence: params.nativeSqliteEvidence,
  });
};
