use base64::Engine;
use tauri::{AppHandle, State, WebviewWindow};
use crate::commands::db::DbState;
use crate::native_keychain;
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
    if let Err(error) = native_keychain::write_pdk_for_profile(&resolved_profile_id, &key) {
        eprintln!(
            "[STORAGE] Failed to persist profile data key to keychain for profile {}: {}",
            resolved_profile_id, error
        );
    }
    Ok(())
}

#[tauri::command]
pub async fn desktop_storage_at_rest_restore_keychain(
    app: AppHandle,
    window: WebviewWindow,
    profiles: State<'_, DesktopProfileState>,
    storage_keys: State<'_, StorageAtRestState>,
    db_state: State<'_, DbState>,
    profile_id: Option<String>,
) -> Result<Option<String>, String> {
    let resolved_profile_id = match profile_id {
        Some(value) if !value.trim().is_empty() => value.trim().to_string(),
        _ => resolve_profile_for_window(&app, &profiles, &window).await?,
    };
    let Some(key) = native_keychain::read_pdk_for_profile(&resolved_profile_id)? else {
        return Ok(None);
    };
    storage_keys.set_key(&resolved_profile_id, key);
    db_state.unlock_with_key(&app, &key)?;
    Ok(Some(
        base64::engine::general_purpose::STANDARD.encode(key),
    ))
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
    // Cut 0.4: always encrypt this profile's DB when PDK is available.
    // Do not wait for every profile session to clear (previous bug left clear durable SQLite).
    let key = storage_keys
        .take_key(&resolved_profile_id)
        .map(|k| *k)
        .or_else(|| native_keychain::read_pdk_for_profile(&resolved_profile_id).ok().flatten());
    if let Some(key) = key {
        db_state.lock_and_encrypt(&app, &key)?;
        return Ok(());
    }
    db_state.close()?;
    if db_state.has_clear_durable_sqlite(&app)? {
        return Err(
            "Cannot lock: PDK unavailable to encrypt local database (Cut 0.4)."
                .to_string(),
        );
    }
    Ok(())
}
