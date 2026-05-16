// Session management commands for native authentication

use tauri::{AppHandle, WebviewWindow};
use crate::profiles::{DesktopProfileState, resolve_profile_for_window};
use crate::session::{SessionResponse, SessionState};
use nostr::ToBech32;
#[cfg(not(target_os = "android"))]
use keyring::Entry;

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
            #[cfg(not(target_os = "android"))]
            {
                let entry_name = format!("nsec:: {}", profile_id);
                let entry = Entry::new("app.obscur.desktop", &entry_name).map_err(|e| e.to_string())?;
                entry.set_password(&nsec).map_err(|e| e.to_string())?;
            }
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
    let keys_opt = session.get_keys(&profile_id).await;
    let npub = keys_opt.map(|k| k.public_key().to_string());
    let is_active = npub.is_some();

    Ok(crate::session::SessionStatus {
        is_active,
        npub,
        is_native: true,
    })
}
