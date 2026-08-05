//! Notification and tray commands

use serde_json::Value;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

use crate::net::NativeNetworkRuntime;

const NOTIFICATION_ICON_CACHE_DIR: &str = "notification-icons";
const NOTIFICATION_ICON_FETCH_TIMEOUT_SECS: u64 = 3;
const NOTIFICATION_ICON_MAX_BYTES: usize = 512 * 1024;

fn sha256_hex(input: &str) -> String {
    let digest = Sha256::digest(input.as_bytes());
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn extension_from_content_type(content_type: Option<&str>) -> &'static str {
    let lowered = content_type.unwrap_or("").to_ascii_lowercase();
    if lowered.contains("png") {
        ".png"
    } else if lowered.contains("jpeg") || lowered.contains("jpg") {
        ".jpg"
    } else if lowered.contains("webp") {
        ".webp"
    } else if lowered.contains("gif") {
        ".gif"
    } else {
        ".img"
    }
}

fn extension_from_url(url: &str) -> Option<&'static str> {
    let path = url::Url::parse(url).ok()?.path().to_ascii_lowercase();
    if path.ends_with(".png") {
        Some(".png")
    } else if path.ends_with(".jpg") || path.ends_with(".jpeg") {
        Some(".jpg")
    } else if path.ends_with(".webp") {
        Some(".webp")
    } else if path.ends_with(".gif") {
        Some(".gif")
    } else {
        None
    }
}

fn notification_icon_cache_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data dir: {error}"))?;
    let dir = root.join(NOTIFICATION_ICON_CACHE_DIR);
    std::fs::create_dir_all(&dir)
        .map_err(|error| format!("Failed to create notification icon cache: {error}"))?;
    Ok(dir)
}

fn existing_cached_icon(dir: &Path, hash: &str) -> Option<PathBuf> {
    for ext in [".png", ".jpg", ".webp", ".gif", ".img"] {
        let candidate = dir.join(format!("{hash}{ext}"));
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

async fn resolve_notification_image_path(
    app: &AppHandle,
    net_runtime: &NativeNetworkRuntime,
    icon: Option<&str>,
) -> Option<PathBuf> {
    let trimmed = icon?.trim();
    if trimmed.is_empty() {
        return None;
    }

    if trimmed.starts_with("https://") {
        let cache_dir = notification_icon_cache_dir(app).ok()?;
        let hash = sha256_hex(trimmed);
        if let Some(cached) = existing_cached_icon(&cache_dir, &hash) {
            return Some(cached);
        }

        let client = net_runtime.build_reqwest_client().ok()?;
        let response = client
            .get(trimmed)
            .timeout(Duration::from_secs(NOTIFICATION_ICON_FETCH_TIMEOUT_SECS))
            .send()
            .await
            .ok()?;
        if !response.status().is_success() {
            return None;
        }
        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .map(str::to_owned);
        let bytes = response.bytes().await.ok()?;
        if bytes.is_empty() || bytes.len() > NOTIFICATION_ICON_MAX_BYTES {
            return None;
        }
        let ext = extension_from_url(trimmed)
            .unwrap_or_else(|| extension_from_content_type(content_type.as_deref()));
        let path = cache_dir.join(format!("{hash}{ext}"));
        std::fs::write(&path, &bytes).ok()?;
        return Some(path);
    }

    let as_path = PathBuf::from(trimmed);
    if as_path.is_file() {
        return Some(as_path);
    }
    None
}

fn parse_notification_actions(actions: Option<&Vec<Value>>) -> Vec<(String, String)> {
    let Some(items) = actions else {
        return Vec::new();
    };
    let mut parsed = Vec::new();
    for item in items {
        let action = item
            .get("action")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let title = item
            .get("title")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty());
        if let (Some(action), Some(title)) = (action, title) {
            parsed.push((action.to_string(), title.to_string()));
        }
    }
    parsed
}

fn default_overlay_action(data: Option<&Value>) -> String {
    data.and_then(|value| value.get("overlayAction"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("open_chat")
        .to_string()
}

#[cfg(desktop)]
fn focus_main_window(app: &AppHandle) {
    use crate::models::window::MAIN_WINDOW_LABEL;
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Show a system notification
#[tauri::command]
pub async fn show_notification(
    app: AppHandle,
    net_runtime: State<'_, NativeNetworkRuntime>,
    title: String,
    body: String,
    _tag: Option<String>,
    icon: Option<String>,
    data: Option<Value>,
    require_interaction: Option<bool>,
    actions: Option<Vec<Value>>,
) -> Result<(), String> {
    let image_path = resolve_notification_image_path(&app, &net_runtime, icon.as_deref()).await;
    let parsed_actions = parse_notification_actions(actions.as_ref());
    let default_action = default_overlay_action(data.as_ref());
    let require_interaction = require_interaction.unwrap_or(false);

    #[cfg(target_os = "windows")]
    {
        use tauri_winrt_notification::{Duration as ToastDuration, IconCrop, Scenario, Toast};

        let app_id = app.config().identifier.clone();
        let mut toast = Toast::new(&app_id).title(&title).text1(&body);

        if let Some(path) = image_path.as_ref() {
            // Circular app-logo placement (left of title) — not inline/hero image preview.
            toast = toast.icon(path, IconCrop::Circular, "avatar");
        }

        let is_incoming_call = parsed_actions.iter().any(|(action, _)| action == "accept")
            && parsed_actions.iter().any(|(action, _)| action == "decline");
        if is_incoming_call {
            toast = toast.scenario(Scenario::IncomingCall);
        }
        toast = toast.duration(if require_interaction || is_incoming_call {
            ToastDuration::Long
        } else {
            ToastDuration::Short
        });

        for (action_id, label) in &parsed_actions {
            toast = toast.add_button(label, action_id);
        }

        let app_for_activation = app.clone();
        let default_action_for_activation = default_action.clone();
        let call_toast = is_incoming_call;
        toast = toast.on_activated(move |action| {
            #[cfg(desktop)]
            {
                focus_main_window(&app_for_activation);
                if call_toast {
                    let resolved = match action.as_deref() {
                        Some(value) if !value.is_empty() => value,
                        _ => default_action_for_activation.as_str(),
                    };
                    let _ = crate::services::tray::emit_tray_call_action(&app_for_activation, resolved);
                }
            }
            Ok(())
        });

        return toast
            .show()
            .map_err(|error| format!("Failed to show Windows notification: {error:?}"));
    }

    #[cfg(not(target_os = "windows"))]
    {
        use tauri_plugin_notification::NotificationExt;

        let _ = (
            parsed_actions,
            default_action,
            require_interaction,
        );

        let mut builder = app.notification().builder().title(title).body(body);
        if let Some(path) = image_path.as_ref() {
            if let Some(path_str) = path.to_str() {
                builder = builder.icon(path_str);
            }
        }
        return builder.show().map_err(|e| e.to_string());
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
