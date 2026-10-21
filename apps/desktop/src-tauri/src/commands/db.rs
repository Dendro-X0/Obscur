use std::path::PathBuf;
use std::sync::Mutex;
use libobscur::db::Database;
use libobscur::storage_at_rest::{decrypt_file_to_plaintext, encrypt_file_in_place, encrypted_sidecar_path};
use tauri::{AppHandle, State};
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

    pub fn is_open(&self) -> Result<bool, String> {
        let guard = self.inner.lock().map_err(|e| e.to_string())?;
        Ok(guard.db.is_some())
    }

    /// Reopen plaintext SQLite when closed without an at-rest envelope.
    /// Encrypted envelopes still require `desktop_storage_at_rest_unlock` (PDK).
    pub fn ensure_open_for_writes(&self, app: &AppHandle) -> Result<(), String> {
        if self.is_open()? {
            return Ok(());
        }
        let (sqlite_path, encrypted_path) = sqlite_paths(app)?;
        if encrypted_path.exists() {
            return Err(
                "Local database is locked. Unlock this profile to continue.".to_string(),
            );
        }
        self.open_at_path(sqlite_path)
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

/// Soft-lock drift repair: reopen plaintext DB, or report locked when encrypted.
#[tauri::command]
pub fn desktop_db_ensure_open(
    app: AppHandle,
    db_state: State<'_, DbState>,
) -> Result<bool, String> {
    db_state.ensure_open_for_writes(&app)?;
    Ok(true)
}

// ---------------------------------------------------------------------------
// Message / conversation write IPC — tombstoned (Track B 2026-10).
// Use engine_invoke dm.insertMessage / dm.upsertConversation.
// @see specs/backend/db-insert-upsert-legacy-parallel-tombstone-design-2026-10.md
// ---------------------------------------------------------------------------

// Slice 15 — DM read IPC tombstoned. Use engine_invoke dm.getThread / dm.listConversations.
// @see specs/backend/r-dm-read-tombstone-slice15-design-2026-07.md

// Slice 21 — DM delete/tombstone IPC tombstoned; use engine_invoke dm.deleteMessages /
// deleteMessage / insertTombstone / listTombstones / deleteAllTombstones.
// @see specs/backend/r-dm-delete-tombstone-ipc-slice21-design-2026-07.md

// Group list/message/tombstone IPC tombstoned. Use engine_invoke workspace.listGroups /
// upsertGroup / listGroupMessages / insertGroupMessage / insertGroupTombstone.
// @see specs/backend/community-group-db-ipc-tombstone-design-2026-07.md

// Slice 19 — call-record IPC tombstoned; use engine_invoke persistence.listCallRecords /
// upsertCallRecord. @see specs/backend/r-call-ipc-tombstone-slice19-design-2026-07.md

// Slice 11 — checkpoint IPC tombstoned; use engine_invoke transport.listRelayCheckpoints /
// upsertRelayCheckpoint. @see specs/backend/r-transport-checkpoint-tombstone-slice11-design-2026-07.md

// Slice 17 — vault media index IPC tombstoned; use engine_invoke persistence.listVaultMediaIndex /
// upsertVaultMediaIndex / deleteVaultMediaIndex / deleteAllVaultMediaIndex.
// @see specs/backend/r-vault-ipc-tombstone-slice17-design-2026-07.md

// Slice 23 — search/wipe IPC tombstoned; use engine_invoke persistence.searchMessages /
// wipeProfileLocalData. @see specs/backend/r-search-wipe-ipc-tombstone-slice23-design-2026-07.md
