//! Notification and tray commands

use serde_json::Value;
use tauri::AppHandle;

/// Show a system notification
#[tauri::command]
pub async fn show_notification(
    app: AppHandle,
    title: String,
    body: String,
    _tag: Option<String>,
    _data: Option<Value>,
    _require_interaction: Option<bool>,
    _actions: Option<Vec<Value>>,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let mut notification = notify_rust::Notification::new();
        notification.summary(&title).body(&body);
        notification.app_id(&app.config().identifier);
        return notification
            .show()
            .map(|_| ())
            .map_err(|e| e.to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        use tauri_plugin_notification::NotificationExt;

        return app
            .notification()
            .builder()
            .title(title)
            .body(body)
            .show()
            .map_err(|e| e.to_string());
    }
}

/// Request notification permission
#[tauri::command]
pub async fn request_notification_permission(app: AppHandle) -> Result<String, String> {
    use tauri_plugin_notification::NotificationExt;

    let permission = app
        .notification()
        .permission_state()
        .map_err(|e| e.to_string())?;

    match permission {
        tauri_plugin_notification::PermissionState::Granted => Ok("granted".to_string()),
        tauri_plugin_notification::PermissionState::Denied => Ok("denied".to_string()),
        _ => {
            app.notification()
                .request_permission()
                .map_err(|e| e.to_string())?;
            let new_permission = app
                .notification()
                .permission_state()
                .map_err(|e| e.to_string())?;
            match new_permission {
                tauri_plugin_notification::PermissionState::Granted => Ok("granted".to_string()),
                _ => Ok("denied".to_string()),
            }
        }
    }
}

/// Check if notification permission is granted
#[tauri::command]
pub async fn is_notification_permission_granted(app: AppHandle) -> Result<bool, String> {
    use tauri_plugin_notification::NotificationExt;
    let permission = app
        .notification()
        .permission_state()
        .map_err(|e| e.to_string())?;
    Ok(matches!(
        permission,
        tauri_plugin_notification::PermissionState::Granted
    ))
}
