use base64::Engine;
use tauri::{AppHandle, State, WebviewWindow};
use crate::commands::db::DbState;
use crate::profiles::{DesktopProfileState, resolve_profile_for_window};
use crate::session::SessionState;
use crate::storage_at_rest_state::StorageAtRestState;

fn decode_key_material(key_material_b64: &str) -> Result<[u8; 32], String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(key_material_b64.trim())
        .map_err(|e| format!("Invalid storage key encoding: {e}"))?;
    if bytes.len() != 32 {
        return Err("Storage key must be 32 bytes.".to_string());
    }
    let mut key = [0u8; 32];
    key.copy_from_slice(&bytes);
    Ok(key)
}

#[tauri::command]
pub async fn desktop_storage_at_rest_unlock(
    app: AppHandle,
    window: WebviewWindow,
    profiles: State<'_, DesktopProfileState>,
    storage_keys: State<'_, StorageAtRestState>,
    db_state: State<'_, DbState>,
    profile_id: Option<String>,
    key_material_b64: String,
) -> Result<(), String> {
    let resolved_profile_id = match profile_id {
        Some(value) if !value.trim().is_empty() => value.trim().to_string(),
        _ => resolve_profile_for_window(&app, &profiles, &window).await?,
    };
    let key = decode_key_material(&key_material_b64)?;
    storage_keys.set_key(&resolved_profile_id, key);
    db_state.unlock_with_key(&app, &key)?;
    Ok(())
}

#[tauri::command]
pub async fn desktop_storage_at_rest_lock(
    app: AppHandle,
    window: WebviewWindow,
    session: State<'_, SessionState>,
    profiles: State<'_, DesktopProfileState>,
    storage_keys: State<'_, StorageAtRestState>,
    db_state: State<'_, DbState>,
    profile_id: Option<String>,
) -> Result<(), String> {
    let resolved_profile_id = match profile_id {
        Some(value) if !value.trim().is_empty() => value.trim().to_string(),
        _ => resolve_profile_for_window(&app, &profiles, &window).await?,
    };
    session.clear(Some(&resolved_profile_id)).await;
    let should_encrypt = {
        let keys = session.keys.lock().await;
        keys.is_empty()
    };
    if should_encrypt {
        if let Some(key) = storage_keys.take_key(&resolved_profile_id) {
            db_state.lock_and_encrypt(&app, &key)?;
        }
    } else {
        let _ = storage_keys.take_key(&resolved_profile_id);
    }
    Ok(())
}
