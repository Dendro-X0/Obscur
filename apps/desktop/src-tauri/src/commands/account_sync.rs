//! Account-sync IPC — Step B read snapshot only.

use crate::account_sync_state::{AccountSyncNativeSnapshot, AccountSyncState};

#[tauri::command]
pub async fn account_sync_snapshot(
    state: tauri::State<'_, AccountSyncState>,
) -> Result<AccountSyncNativeSnapshot, String> {
    crate::invoke_pressure::note_invoke("account_sync_snapshot");
    Ok(state.snapshot())
}
