//! AUTH-K4 — OS keychain login assist (passphrase only; no private key material).

use crate::native_keychain;

#[tauri::command]
pub async fn auth_login_assist_read(profile_id: String) -> Result<Option<String>, String> {
    let trimmed = profile_id.trim();
    if trimmed.is_empty() {
        return Err("profile_id is required".to_string());
    }
    native_keychain::read_login_assist_for_profile(trimmed)
}

#[tauri::command]
pub async fn auth_login_assist_write(profile_id: String, payload: String) -> Result<(), String> {
    let trimmed = profile_id.trim();
    if trimmed.is_empty() {
        return Err("profile_id is required".to_string());
    }
    if payload.trim().is_empty() {
        return Err("payload is required".to_string());
    }
    native_keychain::write_login_assist_for_profile(trimmed, payload.trim())
}

#[tauri::command]
pub async fn auth_login_assist_delete(profile_id: String) -> Result<(), String> {
    let trimmed = profile_id.trim();
    if trimmed.is_empty() {
        return Err("profile_id is required".to_string());
    }
    native_keychain::delete_login_assist_for_profile(trimmed)
}
