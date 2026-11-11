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

    /// Soft-lock probe only — Cut 0.4 forbids reopening clear durable SQLite.
    /// Encrypted or leftover plaintext both require `desktop_storage_at_rest_unlock` (PDK).
    pub fn ensure_open_for_writes(&self, app: &AppHandle) -> Result<(), String> {
        if self.is_open()? {
            return Ok(());
        }
        let (_sqlite_path, _encrypted_path) = sqlite_paths(app)?;
        Err("Local database is locked. Unlock this profile to continue.".to_string())
    }

    /// True when a clear `obscur.sqlite3` exists without a `.obscur-enc` sibling.
    pub fn has_clear_durable_sqlite(&self, app: &AppHandle) -> Result<bool, String> {
        let (sqlite_path, encrypted_path) = sqlite_paths(app)?;
        Ok(has_clear_durable_pair(&sqlite_path, &encrypted_path))
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

}

fn sqlite_paths(app: &AppHandle) -> Result<(PathBuf, PathBuf), String> {
    let data_root = resolve_effective_data_root(app)?;
    let sqlite_path = data_root.join("obscur.sqlite3");
    let encrypted_path = encrypted_sidecar_path(&sqlite_path);
    Ok((sqlite_path, encrypted_path))
}

pub fn bootstrap_sqlite_storage(app: &AppHandle, db_state: &DbState) -> Result<(), String> {
    let (sqlite_path, encrypted_path) = sqlite_paths(app)?;
    if encrypted_path.exists() {
        eprintln!("[STORAGE] SQLite at-rest envelope detected; waiting for unlock.");
        return Ok(());
    }
    // Cut 0.4: do not open clear durable DB at boot — unlock path creates/opens under PDK.
    if sqlite_path.exists() {
        eprintln!(
            "[STORAGE] Clear SQLite present without envelope; waiting for unlock to bind PDK (Cut 0.4)."
        );
    }
    let _ = db_state;
    Ok(())
}

/// Close the native SQLite handle before copying the data-root database bundle.
pub fn quiesce_sqlite_for_data_root_change(db_state: &DbState) -> Result<(), String> {
    db_state.close()
}

/// Soft-lock probe — Cut 0.4 always requires PDK unlock (no clear reopen).
#[tauri::command]
pub fn desktop_db_ensure_open(
    app: AppHandle,
    db_state: State<'_, DbState>,
) -> Result<bool, String> {
    db_state.ensure_open_for_writes(&app)?;
    Ok(true)
}

#[cfg(test)]
mod cut0_at_rest_tests {
    use super::has_clear_durable_pair;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_pair() -> (std::path::PathBuf, std::path::PathBuf, std::path::PathBuf) {
        let dir = std::env::temp_dir().join(format!(
            "obscur-db-cut0-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("time")
                .as_nanos()
        ));
        fs::create_dir_all(&dir).expect("dir");
        let plain = dir.join("obscur.sqlite3");
        let enc = libobscur::storage_at_rest::encrypted_sidecar_path(&plain);
        (dir, plain, enc)
    }

    #[test]
    fn clear_durable_detected_without_envelope() {
        let (dir, plain, enc) = temp_pair();
        fs::write(&plain, b"x").expect("write");
        assert!(has_clear_durable_pair(&plain, &enc));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn envelope_means_not_clear_durable() {
        let (dir, plain, enc) = temp_pair();
        fs::write(&enc, b"envelope").expect("write");
        assert!(!has_clear_durable_pair(&plain, &enc));
        let _ = fs::remove_dir_all(dir);
    }
}

fn has_clear_durable_pair(sqlite_path: &std::path::Path, encrypted_path: &std::path::Path) -> bool {
    sqlite_path.exists() && !encrypted_path.exists()
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
