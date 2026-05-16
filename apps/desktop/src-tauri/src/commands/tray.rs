//! Tray and notification commands

use tauri::AppHandle;
use serde_json::json;
#[cfg(desktop)]
use tauri::Manager;
#[cfg(desktop)]
use crate::models::tray::*;
#[cfg(desktop)]
use crate::services::tray::*;

/// Set tray unread badge count
#[tauri::command]
pub async fn set_tray_unread_badge_count(
    app: AppHandle,
    unread_count: u32,
) -> Result<(), String> {
    #[cfg(desktop)]
    {
        let label = TrayBadgeState::format_badge_label(unread_count);
        if let Some(tray) = app.tray_by_id(TRAY_ICON_ID) {
            if let Some(badge_str) = label {
                let new_icon = {
                    let state = app.state::<TrayBadgeState>();
                    render_badged_tray_icon(&state.base_icon, &badge_str)
                };
                tray.set_icon(Some(new_icon)).map_err(|e| e.to_string())?;
            } else {
                let state = app.state::<TrayBadgeState>();
                tray.set_icon(Some(state.base_icon.clone()))
                    .map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

/// Set incoming call state for tray
#[tauri::command]
pub async fn set_tray_incoming_call_state(
    app: AppHandle,
    active: bool,
    caller_name: Option<String>,
    room_id: Option<String>,
) -> Result<(), String> {
    #[cfg(desktop)]
    {
        if active {
            let call_state = IncomingCallTrayState {
                caller_name: caller_name.unwrap_or_else(|| "Unknown".to_string()),
                room_id: room_id.unwrap_or_default(),
            };
            {
                let state = app.state::<TrayCallState>();
                let mut guard = state.incoming.lock().map_err(|e| e.to_string())?;
                *guard = Some(call_state);
            }
            sync_incoming_call_surface_state(&app)?;
            refresh_tray_menu(&app)?;
        } else {
            clear_incoming_tray_call_state(&app)?;
            hide_incoming_call_window(&app)?;
            refresh_tray_menu(&app)?;
        }
        emit_incoming_call_state(&app)?;
    }
    Ok(())
}

/// Get current incoming call state
#[tauri::command]
pub async fn desktop_get_incoming_call_state(app: AppHandle) -> Result<serde_json::Value, String> {
    #[cfg(desktop)]
    {
        let payload = current_incoming_call_state_payload(&app)?;
        return Ok(json!({
            "active": payload.active,
            "callerName": payload.caller_name,
            "roomId": payload.room_id,
        }));
    }
    #[cfg(mobile)]
    {
        Ok(json!({
            "active": false,
            "callerName": "",
            "roomId": "",
        }))
    }
}

/// Handle incoming call action from tray
#[tauri::command]
pub async fn desktop_incoming_call_action(app: AppHandle, action: String) -> Result<(), String> {
    #[cfg(desktop)]
    {
        let normalized_action = action.trim().to_lowercase();
        match normalized_action.as_str() {
            "accept" => {
                emit_tray_call_action(&app, "accept")?;
                clear_incoming_tray_call_state(&app)?;
                hide_incoming_call_window(&app)?;
                refresh_tray_menu(&app)?;
            }
            "decline" => {
                emit_tray_call_action(&app, "decline")?;
                clear_incoming_tray_call_state(&app)?;
                hide_incoming_call_window(&app)?;
                refresh_tray_menu(&app)?;
            }
            _ => {}
        }
    }
    Ok(())
}
