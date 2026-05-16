import { invoke } from "@tauri-apps/api/core";
import type { MessageRecord, TombstoneRecord, ConversationRecord, GroupRecord, GroupMessageRecord, GroupTombstoneRecord, CallRecord, RelayCheckpointRecord, MessageSearchResult } from "./types";

/**
 * Returns true when running inside Tauri (desktop).
 * Use this to guard all db calls so the PWA can fall back gracefully.
 */
export const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function dbInsertMessage(msg: MessageRecord): Promise<void> {
  await invoke<void>("db_insert_message", { msg });
}

export async function dbGetMessages(
  profileId: string,
  conversationId: string,
  limit = 200,
  beforeReceivedAt?: number,
): Promise<MessageRecord[]> {
  return invoke<MessageRecord[]>("db_get_messages", {
    profileId,
    conversationId,
    limit,
    beforeReceivedAt: beforeReceivedAt ?? null,
  });
}

export async function dbDeleteMessage(eventId: string, profileId: string): Promise<void> {
  await invoke<void>("db_delete_message", { eventId, profileId });
}

export async function dbDeleteMessages(eventIds: string[], profileId: string): Promise<void> {
  await invoke<void>("db_delete_messages", { eventIds, profileId });
}

// ---------------------------------------------------------------------------
// Tombstones
// ---------------------------------------------------------------------------

export async function dbInsertTombstone(tombstone: TombstoneRecord): Promise<void> {
  await invoke<void>("db_insert_tombstone", { tombstone });
}

export async function dbInsertTombstones(tombstones: TombstoneRecord[]): Promise<void> {
  await invoke<void>("db_insert_tombstones", { tombstones });
}

export async function dbGetTombstones(profileId: string): Promise<TombstoneRecord[]> {
  return invoke<TombstoneRecord[]>("db_get_tombstones", { profileId });
}

export async function dbDeleteAllTombstonesForProfile(profileId: string): Promise<void> {
  await invoke<void>("db_delete_all_tombstones_for_profile", { profileId });
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export async function dbUpsertConversation(conversation: ConversationRecord): Promise<void> {
  await invoke<void>("db_upsert_conversation", { conversation });
}

export async function dbGetConversations(profileId: string): Promise<ConversationRecord[]> {
  return invoke<ConversationRecord[]>("db_get_conversations", { profileId });
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export async function dbUpsertGroup(group: GroupRecord): Promise<void> {
  await invoke<void>("db_upsert_group", { group });
}

export async function dbGetGroups(profileId: string): Promise<GroupRecord[]> {
  return invoke<GroupRecord[]>("db_get_groups", { profileId });
}

// ---------------------------------------------------------------------------
// Group messages
// ---------------------------------------------------------------------------

export async function dbInsertGroupMessage(msg: GroupMessageRecord): Promise<void> {
  await invoke<void>("db_insert_group_message", { msg });
}

export async function dbGetGroupMessages(
  profileId: string,
  groupId: string,
  limit = 200,
  beforeReceivedAt?: number,
): Promise<GroupMessageRecord[]> {
  return invoke<GroupMessageRecord[]>("db_get_group_messages", {
    profileId,
    groupId,
    limit,
    beforeReceivedAt: beforeReceivedAt ?? null,
  });
}

export async function dbInsertGroupTombstone(tombstone: GroupTombstoneRecord): Promise<void> {
  await invoke<void>("db_insert_group_tombstone", { tombstone });
}

// ---------------------------------------------------------------------------
// Call records
// ---------------------------------------------------------------------------

export async function dbInsertCallRecord(record: CallRecord): Promise<void> {
  await invoke<void>("db_insert_call_record", { record });
}

export async function dbUpdateCallRecord(record: CallRecord): Promise<void> {
  await invoke<void>("db_update_call_record", { record });
}

export async function dbGetCallRecords(profileId: string): Promise<CallRecord[]> {
  return invoke<CallRecord[]>("db_get_call_records", { profileId });
}

// ---------------------------------------------------------------------------
// Relay checkpoints
// ---------------------------------------------------------------------------

export async function dbUpsertRelayCheckpoint(checkpoint: RelayCheckpointRecord): Promise<void> {
  await invoke<void>("db_upsert_relay_checkpoint", { checkpoint });
}

export async function dbGetRelayCheckpoint(
  profileId: string,
  relayUrl: string,
): Promise<RelayCheckpointRecord | null> {
  return invoke<RelayCheckpointRecord | null>("db_get_relay_checkpoint", { profileId, relayUrl });
}

export async function dbGetRelayCheckpoints(profileId: string): Promise<RelayCheckpointRecord[]> {
  return invoke<RelayCheckpointRecord[]>("db_get_relay_checkpoints", { profileId });
}

// ---------------------------------------------------------------------------
// Unified FTS5 search
// ---------------------------------------------------------------------------

export async function dbSearchMessages(
  profileId: string,
  query: string,
  limit?: number,
): Promise<MessageSearchResult[]> {
  return invoke<MessageSearchResult[]>("db_search_messages", { profileId, query, limit });
}
