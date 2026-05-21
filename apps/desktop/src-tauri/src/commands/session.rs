// Session management commands for native authentication

use tauri::{AppHandle, WebviewWindow};
use crate::native_keychain;
use crate::profiles::{DesktopProfileState, resolve_profile_for_window};
use crate::session::{SessionResponse, SessionState};
use nostr::ToBech32;

#[tauri::command]
pub async fn init_native_session(
    app: AppHandle,
    window: WebviewWindow,
    session: tauri::State<'_, SessionState>,
    profiles: tauri::State<'_, DesktopProfileState>,
    nsec: String,
) -> Result<SessionResponse, String> {
    let profile_id = resolve_profile_for_window(&app, &profiles, &window).await?;
    match session.set_keys(&profile_id, &nsec).await {
        Ok(pubkey) => {
            native_keychain::write_nsec_for_profile(&profile_id, &nsec)?;
            let npub = pubkey.to_bech32().map_err(|e| e.to_string())?;
            eprintln!("[SESSION] Native session initialized and persisted for {} on profile {}", npub, profile_id);
            Ok(SessionResponse {
                success: true,
                npub: Some(npub),
                message: None,
            })
        }
        Err(e) => Ok(SessionResponse {
            success: false,
            npub: None,
            message: Some(e),
        }),
    }
}

#[tauri::command]
pub async fn clear_native_session(
    app: AppHandle,
    window: WebviewWindow,
    session: tauri::State<'_, SessionState>,
    profiles: tauri::State<'_, DesktopProfileState>,
) -> Result<(), String> {
    let profile_id = resolve_profile_for_window(&app, &profiles, &window).await?;
    session.clear(Some(&profile_id)).await;
    eprintln!("[SESSION] Native session cleared for profile {}", profile_id);
    Ok(())
}

#[tauri::command]
pub async fn get_session_status(
    app: AppHandle,
    window: WebviewWindow,
    session: tauri::State<'_, SessionState>,
    profiles: tauri::State<'_, DesktopProfileState>,
) -> Result<crate::session::SessionStatus, String> {
    let profile_id = resolve_profile_for_window(&app, &profiles, &window).await?;
    if session.get_keys(&profile_id).await.is_none() {
        if let Ok(Some(nsec)) = native_keychain::read_nsec_for_profile(&profile_id) {
            let _ = session.set_keys(&profile_id, &nsec).await;
        }
    }
    let keys_opt = session.get_keys(&profile_id).await;
    let npub = keys_opt.map(|k| k.public_key().to_string());
    let is_active = npub.is_some();

    Ok(crate::session::SessionStatus {
        is_active,
        npub,
        is_native: true,
    })
}
