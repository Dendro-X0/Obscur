use std::path::PathBuf;
use std::sync::Mutex;
use libobscur::db::Database;
use libobscur::storage_at_rest::{decrypt_file_to_plaintext, encrypt_file_in_place, encrypted_sidecar_path};
use tauri::AppHandle;
use crate::data_root::resolve_effective_data_root;

/// Tauri managed state wrapping the SQLite database.
pub struct DbState {
    inner: Mutex<DbStateInner>,
}

struct DbStateInner {
    db: Option<Database>,
    path: PathBuf,
}

impl DbState {
    pub fn new_lazy(path: PathBuf) -> Self {
        Self {
            inner: Mutex::new(DbStateInner { db: None, path }),
        }
    }

    pub fn with_db<F, R>(&self, f: F) -> Result<R, String>
    where
        F: FnOnce(&Database) -> Result<R, String>,
    {
        let guard = self.inner.lock().map_err(|e| e.to_string())?;
        let db = guard
            .db
            .as_ref()
            .ok_or_else(|| "Local database is locked. Unlock this profile to continue.".to_string())?;
        f(db)
    }

    pub fn close(&self) -> Result<(), String> {
        let mut guard = self.inner.lock().map_err(|e| e.to_string())?;
        guard.db = None;
        Ok(())
    }

    pub fn open_at_path(&self, path: PathBuf) -> Result<(), String> {
        let path_str = path.to_string_lossy().to_string();
        let db = Database::new(Some(&path_str))
            .map_err(|e| format!("Failed to open database: {e}"))?;
        let mut guard = self.inner.lock().map_err(|e| e.to_string())?;
        guard.path = path;
        guard.db = Some(db);
        Ok(())
    }

    pub fn unlock_with_key(&self, app: &AppHandle, key: &[u8; 32]) -> Result<(), String> {
        let (sqlite_path, encrypted_path) = sqlite_paths(app)?;
        if encrypted_path.exists() {
            decrypt_file_to_plaintext(&encrypted_path, &sqlite_path, key)?;
        }
        self.open_at_path(sqlite_path)
    }

    pub fn lock_and_encrypt(&self, app: &AppHandle, key: &[u8; 32]) -> Result<(), String> {
        let (sqlite_path, _) = sqlite_paths(app)?;
        self.close()?;
        if sqlite_path.exists() {
            encrypt_file_in_place(&sqlite_path, key)?;
            eprintln!("[STORAGE] SQLite encrypted at rest.");
        }
        Ok(())
    }

    pub fn open_plaintext_if_available(&self, app: &AppHandle) -> Result<(), String> {
        let (sqlite_path, encrypted_path) = sqlite_paths(app)?;
        if encrypted_path.exists() {
            return Ok(());
        }
        self.open_at_path(sqlite_path)
    }
}

fn sqlite_paths(app: &AppHandle) -> Result<(PathBuf, PathBuf), String> {
    let data_root = resolve_effective_data_root(app)?;
    let sqlite_path = data_root.join("obscur.sqlite3");
    let encrypted_path = encrypted_sidecar_path(&sqlite_path);
    Ok((sqlite_path, encrypted_path))
}

pub fn bootstrap_sqlite_storage(app: &AppHandle, db_state: &DbState) -> Result<(), String> {
    let (_, encrypted_path) = sqlite_paths(app)?;
    if encrypted_path.exists() {
        eprintln!("[STORAGE] SQLite at-rest envelope detected; waiting for unlock.");
        return Ok(());
    }
    db_state.open_plaintext_if_available(app)
}

/// Close the native SQLite handle before copying the data-root database bundle.
pub fn quiesce_sqlite_for_data_root_change(db_state: &DbState) -> Result<(), String> {
    db_state.close()
}

// ---------------------------------------------------------------------------
// Message commands
// ---------------------------------------------------------------------------

use tauri::State;
use libobscur::db::repositories::{
    MessageRecord, TombstoneRecord, ConversationRecord,
    GroupRecord, GroupMessageRecord, GroupTombstoneRecord, CallRecord,
    RelayCheckpointRecord, MessageSearchResult, WipeProfileLocalDataReport,
};

#[tauri::command]
pub fn db_insert_message(
    state: State<'_, DbState>,
    msg: MessageRecord,
) -> Result<(), String> {
    state.with_db(|db| db.insert_message(&msg).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_get_messages(
    state: State<'_, DbState>,
    profile_id: String,
    conversation_id: String,
    limit: u32,
    before_received_at: Option<i64>,
) -> Result<Vec<MessageRecord>, String> {
    state.with_db(|db| {
        db.get_messages_by_conversation(&profile_id, &conversation_id, limit, before_received_at)
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn db_delete_message(
    state: State<'_, DbState>,
    event_id: String,
    profile_id: String,
) -> Result<(), String> {
    state.with_db(|db| db.delete_message(&event_id, &profile_id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_delete_messages(
    state: State<'_, DbState>,
    event_ids: Vec<String>,
    profile_id: String,
) -> Result<(), String> {
    state.with_db(|db| db.delete_messages(&event_ids, &profile_id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_insert_tombstone(
    state: State<'_, DbState>,
    tombstone: TombstoneRecord,
) -> Result<(), String> {
    state.with_db(|db| db.insert_tombstone(&tombstone).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_insert_tombstones(
    state: State<'_, DbState>,
    tombstones: Vec<TombstoneRecord>,
) -> Result<(), String> {
    state.with_db(|db| db.insert_tombstones(&tombstones).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_get_tombstones(
    state: State<'_, DbState>,
    profile_id: String,
) -> Result<Vec<TombstoneRecord>, String> {
    state.with_db(|db| db.get_tombstones(&profile_id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_delete_all_tombstones_for_profile(
    state: State<'_, DbState>,
    profile_id: String,
) -> Result<(), String> {
    state.with_db(|db| {
        db.delete_all_tombstones_for_profile(&profile_id)
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn db_upsert_conversation(
    state: State<'_, DbState>,
    conversation: ConversationRecord,
) -> Result<(), String> {
    state.with_db(|db| db.upsert_conversation(&conversation).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_get_conversations(
    state: State<'_, DbState>,
    profile_id: String,
) -> Result<Vec<ConversationRecord>, String> {
    state.with_db(|db| db.get_conversations(&profile_id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_upsert_group(
    state: State<'_, DbState>,
    group: GroupRecord,
) -> Result<(), String> {
    state.with_db(|db| db.upsert_group(&group).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_get_groups(
    state: State<'_, DbState>,
    profile_id: String,
) -> Result<Vec<GroupRecord>, String> {
    state.with_db(|db| db.get_groups(&profile_id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_insert_group_message(
    state: State<'_, DbState>,
    msg: GroupMessageRecord,
) -> Result<(), String> {
    state.with_db(|db| db.insert_group_message(&msg).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_get_group_messages(
    state: State<'_, DbState>,
    profile_id: String,
    group_id: String,
    limit: u32,
    before_received_at: Option<i64>,
) -> Result<Vec<GroupMessageRecord>, String> {
    state.with_db(|db| {
        db.get_group_messages(&profile_id, &group_id, limit, before_received_at)
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn db_insert_group_tombstone(
    state: State<'_, DbState>,
    tombstone: GroupTombstoneRecord,
) -> Result<(), String> {
    state.with_db(|db| db.insert_group_tombstone(&tombstone).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_insert_call_record(
    state: State<'_, DbState>,
    record: CallRecord,
) -> Result<(), String> {
    state.with_db(|db| db.insert_call_record(&record).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_update_call_record(
    state: State<'_, DbState>,
    record: CallRecord,
) -> Result<(), String> {
    state.with_db(|db| db.update_call_record(&record).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_get_call_records(
    state: State<'_, DbState>,
    profile_id: String,
) -> Result<Vec<CallRecord>, String> {
    state.with_db(|db| db.get_call_records(&profile_id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_upsert_relay_checkpoint(
    state: State<'_, DbState>,
    checkpoint: RelayCheckpointRecord,
) -> Result<(), String> {
    state.with_db(|db| db.upsert_relay_checkpoint(&checkpoint).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_get_relay_checkpoint(
    state: State<'_, DbState>,
    profile_id: String,
    relay_url: String,
) -> Result<Option<RelayCheckpointRecord>, String> {
    state.with_db(|db| {
        db.get_relay_checkpoint(&profile_id, &relay_url)
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn db_get_relay_checkpoints(
    state: State<'_, DbState>,
    profile_id: String,
) -> Result<Vec<RelayCheckpointRecord>, String> {
    state.with_db(|db| db.get_relay_checkpoints(&profile_id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn db_search_messages(
    state: State<'_, DbState>,
    profile_id: String,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<MessageSearchResult>, String> {
    state.with_db(|db| {
        db.search_messages(&profile_id, &query, limit.unwrap_or(50))
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn db_wipe_profile_local_data(
    state: State<'_, DbState>,
    profile_id: String,
    remove_profile_row: bool,
) -> Result<WipeProfileLocalDataReport, String> {
    state.with_db(|db| {
        db.wipe_profile_local_data(&profile_id, remove_profile_row)
            .map_err(|e| e.to_string())
    })
}
