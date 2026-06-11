use std::sync::Mutex;
use tauri::State;
use libobscur::db::Database;
use libobscur::db::repositories::{
    MessageRecord, TombstoneRecord, ConversationRecord,
    GroupRecord, GroupMessageRecord, GroupTombstoneRecord, CallRecord,
    RelayCheckpointRecord, MessageSearchResult, WipeProfileLocalDataReport,
};

/// Tauri managed state wrapping the SQLite database.
pub struct DbState {
    pub db: Mutex<Database>,
}

impl DbState {
    pub fn open(path: std::path::PathBuf) -> Result<Self, String> {
        let path_str = path.to_string_lossy().to_string();
        let db = Database::new(Some(&path_str))
            .map_err(|e| format!("Failed to open database: {e}"))?;
        Ok(Self { db: Mutex::new(db) })
    }
}

// ---------------------------------------------------------------------------
// Message commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn db_insert_message(
    state: State<'_, DbState>,
    msg: MessageRecord,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.insert_message(&msg).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_get_messages(
    state: State<'_, DbState>,
    profile_id: String,
    conversation_id: String,
    limit: u32,
    before_received_at: Option<i64>,
) -> Result<Vec<MessageRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_messages_by_conversation(&profile_id, &conversation_id, limit, before_received_at)
        .map_err(|e| e.to_string())
}

/// Hard-delete a single message by (event_id, profile_id).
/// Removes both the message row and any tombstone for it.
#[tauri::command]
pub fn db_delete_message(
    state: State<'_, DbState>,
    event_id: String,
    profile_id: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_message(&event_id, &profile_id).map_err(|e| e.to_string())
}

/// Bulk hard-delete messages by a list of event_ids for a profile.
#[tauri::command]
pub fn db_delete_messages(
    state: State<'_, DbState>,
    event_ids: Vec<String>,
    profile_id: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_messages(&event_ids, &profile_id).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Tombstone commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn db_insert_tombstone(
    state: State<'_, DbState>,
    tombstone: TombstoneRecord,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.insert_tombstone(&tombstone).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_insert_tombstones(
    state: State<'_, DbState>,
    tombstones: Vec<TombstoneRecord>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.insert_tombstones(&tombstones).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_get_tombstones(
    state: State<'_, DbState>,
    profile_id: String,
) -> Result<Vec<TombstoneRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_tombstones(&profile_id).map_err(|e| e.to_string())
}

/// Delete every DM tombstone row for a profile (account reset / tests).
#[tauri::command]
pub fn db_delete_all_tombstones_for_profile(
    state: State<'_, DbState>,
    profile_id: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_all_tombstones_for_profile(&profile_id)
        .map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Conversation commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn db_upsert_conversation(
    state: State<'_, DbState>,
    conversation: ConversationRecord,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.upsert_conversation(&conversation).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_get_conversations(
    state: State<'_, DbState>,
    profile_id: String,
) -> Result<Vec<ConversationRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_conversations(&profile_id).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Group commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn db_upsert_group(
    state: State<'_, DbState>,
    group: GroupRecord,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.upsert_group(&group).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_get_groups(
    state: State<'_, DbState>,
    profile_id: String,
) -> Result<Vec<GroupRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_groups(&profile_id).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Group message commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn db_insert_group_message(
    state: State<'_, DbState>,
    msg: GroupMessageRecord,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.insert_group_message(&msg).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_get_group_messages(
    state: State<'_, DbState>,
    profile_id: String,
    group_id: String,
    limit: u32,
    before_received_at: Option<i64>,
) -> Result<Vec<GroupMessageRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_group_messages(&profile_id, &group_id, limit, before_received_at)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_insert_group_tombstone(
    state: State<'_, DbState>,
    tombstone: GroupTombstoneRecord,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.insert_group_tombstone(&tombstone).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Call record commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn db_insert_call_record(
    state: State<'_, DbState>,
    record: CallRecord,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.insert_call_record(&record).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_update_call_record(
    state: State<'_, DbState>,
    record: CallRecord,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_call_record(&record).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_get_call_records(
    state: State<'_, DbState>,
    profile_id: String,
) -> Result<Vec<CallRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_call_records(&profile_id).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Relay checkpoint commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn db_upsert_relay_checkpoint(
    state: State<'_, DbState>,
    checkpoint: RelayCheckpointRecord,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.upsert_relay_checkpoint(&checkpoint).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_get_relay_checkpoint(
    state: State<'_, DbState>,
    profile_id: String,
    relay_url: String,
) -> Result<Option<RelayCheckpointRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_relay_checkpoint(&profile_id, &relay_url).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_get_relay_checkpoints(
    state: State<'_, DbState>,
    profile_id: String,
) -> Result<Vec<RelayCheckpointRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_relay_checkpoints(&profile_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_search_messages(
    state: State<'_, DbState>,
    profile_id: String,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<MessageSearchResult>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.search_messages(&profile_id, &query, limit.unwrap_or(50))
        .map_err(|e| e.to_string())
}

/// Wipe all SQLite rows for a profile slot (local reset / account removal).
#[tauri::command]
pub fn db_wipe_profile_local_data(
    state: State<'_, DbState>,
    profile_id: String,
    remove_profile_row: bool,
) -> Result<WipeProfileLocalDataReport, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.wipe_profile_local_data(&profile_id, remove_profile_row)
        .map_err(|e| e.to_string())
}
