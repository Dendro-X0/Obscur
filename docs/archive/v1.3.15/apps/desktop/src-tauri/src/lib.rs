#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
};
use tauri::{Emitter, Manager, WebviewWindow, Window};
#[cfg(desktop)]
use tauri::{PhysicalPosition, PhysicalSize};
use tauri_plugin_updater::UpdaterExt;
// use serde::{Serialize, Deserialize};
use serde_json::json;
#[cfg(desktop)]
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
mod net;
mod protocol;
mod profiles;
mod relay;
mod session;
mod upload;
mod wallet;

use nostr::ToBech32;
#[cfg(not(target_os = "android"))]
use keyring::Entry;
use profiles::{DesktopProfileState, ProfileIsolationSnapshot, ProfileSummary, resolve_profile_for_window};
use session::{SessionResponse, SessionState};

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
struct ResetAppStorageReport {
    js_storage_cleared: bool,
    indexed_db_cleared: bool,
    app_data_dir: Option<String>,
    removed_paths: Vec<String>,
    failed_paths: Vec<String>,
}

// Window state persistence
#[cfg(desktop)]
#[derive(serde::Serialize, serde::Deserialize, Debug)]
struct WindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
}

#[cfg(desktop)]
const MAIN_WINDOW_LABEL: &str = "main";
#[cfg(desktop)]
const DEFAULT_WINDOW_WIDTH: u32 = 1200;
#[cfg(desktop)]
const DEFAULT_WINDOW_HEIGHT: u32 = 800;
#[cfg(desktop)]
const MIN_WINDOW_WIDTH: u32 = 800;
#[cfg(desktop)]
const MIN_WINDOW_HEIGHT: u32 = 600;
#[cfg(desktop)]
const MAX_REASONABLE_WINDOW_WIDTH: u32 = 8192;
#[cfg(desktop)]
const MAX_REASONABLE_WINDOW_HEIGHT: u32 = 8192;
#[cfg(desktop)]
const MAX_REASONABLE_POSITION_ABS: i32 = 20_000;
#[cfg(desktop)]
const PERSIST_WINDOW_STATE_IN_DEBUG: bool = false;
#[cfg(desktop)]
const TRAY_ICON_ID: &str = "main-tray";
#[cfg(desktop)]
const TRAY_MENU_SHOW_ID: &str = "show";
#[cfg(desktop)]
const TRAY_MENU_HIDE_ID: &str = "hide";
#[cfg(desktop)]
const TRAY_MENU_ACCEPT_CALL_ID: &str = "accept_incoming_call";
#[cfg(desktop)]
const TRAY_MENU_DECLINE_CALL_ID: &str = "decline_incoming_call";
#[cfg(desktop)]
const TRAY_MENU_QUIT_ID: &str = "quit";
#[cfg(desktop)]
const TRAY_INCOMING_CALL_EVENT_NAME: &str = "desktop://incoming-call-action";
#[cfg(desktop)]
const INCOMING_CALL_STATE_EVENT_NAME: &str = "desktop://incoming-call-state";
#[cfg(desktop)]
const INCOMING_CALL_WINDOW_LABEL: &str = "incoming-call-popup";
#[cfg(desktop)]
const TRAY_BADGE_OVERFLOW_LABEL: &str = "99+";

#[cfg(desktop)]
#[derive(Clone)]
struct IncomingCallTrayState {
    caller_name: String,
    room_id: String,
}

#[cfg(desktop)]
struct TrayCallState {
    incoming: Mutex<Option<IncomingCallTrayState>>,
}

#[cfg(desktop)]
struct TrayBadgeState {
    base_icon: tauri::image::Image<'static>,
    cache: Mutex<HashMap<String, tauri::image::Image<'static>>>,
}

#[cfg(desktop)]
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TrayIncomingCallActionPayload {
    action: String,
    room_id: Option<String>,
}

#[cfg(desktop)]
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct IncomingCallStatePayload {
    active: bool,
    caller_name: String,
    room_id: String,
}

#[cfg(desktop)]
impl TrayBadgeState {
    fn new(base_icon: tauri::image::Image<'static>) -> Self {
        Self {
            base_icon,
            cache: Mutex::new(HashMap::new()),
        }
    }

    fn format_badge_label(unread_count: u32) -> Option<String> {
        if unread_count == 0 {
            return None;
        }
        if unread_count > 99 {
            return Some(TRAY_BADGE_OVERFLOW_LABEL.to_string());
        }
        Some(unread_count.to_string())
    }

    fn icon_for_unread_count(&self, unread_count: u32) -> Result<tauri::image::Image<'static>, String> {
        let Some(label) = Self::format_badge_label(unread_count) else {
            return Ok(self.base_icon.clone());
        };

        {
            let cache = self.cache.lock().map_err(|e| e.to_string())?;
            if let Some(cached) = cache.get(&label) {
                return Ok(cached.clone());
            }
        }

        let rendered = render_badged_tray_icon(&self.base_icon, &label);
        let mut cache = self.cache.lock().map_err(|e| e.to_string())?;
        cache.insert(label, rendered.clone());
        Ok(rendered)
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct TorSettings {
    enable_tor: bool,
    proxy_url: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum TorRuntimeStatus {
    Disconnected,
    Starting,
    Connected,
    Error,
    Stopped,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TorStatusSnapshot {
    state: TorRuntimeStatus,
    configured: bool,
    ready: bool,
    using_external_instance: bool,
    proxy_url: String,
}

struct TorState {
    child: Mutex<Option<CommandChild>>,
    settings: Mutex<TorSettings>,
    runtime_status: Mutex<TorRuntimeStatus>,
    using_external_instance: Mutex<bool>,
    logs: Mutex<Vec<String>>,
}

const TOR_LOG_BUFFER_LIMIT: usize = 200;

fn append_tor_log(state: &TorState, line: impl Into<String>) -> Result<(), String> {
    let mut logs = state.logs.lock().map_err(|e| e.to_string())?;
    logs.push(line.into());
    let overflow = logs.len().saturating_sub(TOR_LOG_BUFFER_LIMIT);
    if overflow > 0 {
        logs.drain(0..overflow);
    }
    Ok(())
}

async fn probe_tor_proxy(proxy_url: &str) -> bool {
    let parsed = match url::Url::parse(proxy_url) {
        Ok(value) => value,
        Err(_) => return false,
    };
    let host = match parsed.host_str() {
        Some(value) => value.to_string(),
        None => return false,
    };
    let port = parsed.port().unwrap_or(9050);
    matches!(
        tokio::time::timeout(
            Duration::from_millis(1200),
            tokio::net::TcpStream::connect((host.as_str(), port)),
        )
        .await,
        Ok(Ok(_))
    )
}

async fn refresh_tor_runtime_status_from_proxy(state: &TorState) -> Result<bool, String> {
    let (configured, proxy_url, runtime_status) = {
        let settings = state.settings.lock().map_err(|e| e.to_string())?;
        let runtime_status = *state.runtime_status.lock().map_err(|e| e.to_string())?;
        (
            settings.enable_tor,
            settings.proxy_url.clone(),
            runtime_status,
        )
    };

    if !configured || runtime_status == TorRuntimeStatus::Connected {
        return Ok(false);
    }

    if !probe_tor_proxy(&proxy_url).await {
        return Ok(false);
    }

    let mut status_lock = state.runtime_status.lock().map_err(|e| e.to_string())?;
    *status_lock = TorRuntimeStatus::Connected;
    Ok(true)
}

fn build_tor_status_snapshot(state: &TorState) -> Result<TorStatusSnapshot, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?.clone();
    let runtime_status = *state.runtime_status.lock().map_err(|e| e.to_string())?;
    let using_external_instance = *state
        .using_external_instance
        .lock()
        .map_err(|e| e.to_string())?;
    Ok(TorStatusSnapshot {
        state: runtime_status,
        configured: settings.enable_tor,
        ready: settings.enable_tor && runtime_status == TorRuntimeStatus::Connected,
        using_external_instance,
        proxy_url: settings.proxy_url,
    })
}

fn set_tor_runtime_status(
    app: &tauri::AppHandle,
    state: &TorState,
    next_status: TorRuntimeStatus,
    using_external_instance: Option<bool>,
) -> Result<(), String> {
    {
        let mut status = state.runtime_status.lock().map_err(|e| e.to_string())?;
        *status = next_status;
    }
    if let Some(external) = using_external_instance {
        let mut external_lock = state
            .using_external_instance
            .lock()
            .map_err(|e| e.to_string())?;
        *external_lock = external;
    }
    app.emit("tor-status", next_status)
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn stop_tor_child(state: &TorState) -> Result<bool, String> {
    let child = {
        let mut lock = state.child.lock().map_err(|e| e.to_string())?;
        lock.take()
    };
    if let Some(child) = child {
        child.kill().map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
async fn check_for_updates(app: tauri::AppHandle) -> Result<String, String> {
    match app.updater_builder().build() {
        Ok(updater) => match updater.check().await {
            Ok(Some(update)) => {
                let version = update.version.clone();
                Ok(format!("Update available: {}", version))
            }
            Ok(None) => Ok("No updates available".to_string()),
            Err(e) => Err(format!("Failed to check for updates: {}", e)),
        },
        Err(e) => Err(format!("Failed to build updater: {}", e)),
    }
}

#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    match app.updater_builder().build() {
        Ok(updater) => {
            match updater.check().await {
                Ok(Some(update)) => {
                    // Download and install the update
                    match update.download_and_install(|_, _| {}, || {}).await {
                        Ok(_) => {
                            // Update installed successfully, app will restart
                            Ok(())
                        }
                        Err(e) => Err(format!("Failed to install update: {}", e)),
                    }
                }
                Ok(None) => Err("No updates available".to_string()),
                Err(e) => Err(format!("Failed to check for updates: {}", e)),
            }
        }
        Err(e) => Err(format!("Failed to build updater: {}", e)),
    }
}

// Window control commands
#[tauri::command]
async fn window_minimize(window: Window) -> Result<(), String> {
    #[cfg(desktop)]
    return window.minimize().map_err(|e| e.to_string());
    #[cfg(mobile)]
    {
        let _ = window;
        Ok(())
    }
}

#[tauri::command]
async fn window_maximize(window: Window) -> Result<(), String> {
    #[cfg(desktop)]
    return window.maximize().map_err(|e| e.to_string());
    #[cfg(mobile)]
    {
        let _ = window;
        Ok(())
    }
}

#[tauri::command]
async fn window_unmaximize(window: Window) -> Result<(), String> {
    #[cfg(desktop)]
    return window.unmaximize().map_err(|e| e.to_string());
    #[cfg(mobile)]
    {
        let _ = window;
        Ok(())
    }
}

#[tauri::command]
async fn window_close(window: Window, app: tauri::AppHandle) -> Result<(), String> {
    // For background mode, we might want this to just hide the window
    #[cfg(desktop)]
    {
        if let Some(webview_window) = app.get_webview_window(window.label()) {
            if let Ok(state) = capture_window_state(&webview_window) {
                let _ = write_window_state(&app, webview_window.label(), &state);
            }
        }
        return window.hide().map_err(|e| e.to_string());
    }
    #[cfg(mobile)]
    {
        let _ = window;
        let _ = app;
        Ok(())
    }
}

#[tauri::command]
async fn window_show_and_focus(window: Window, app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    {
        let target_window = app
            .get_webview_window(window.label())
            .or_else(|| app.get_webview_window(MAIN_WINDOW_LABEL));
        let Some(target_window) = target_window else {
            return Err("Main window unavailable".to_string());
        };
        target_window.unminimize().map_err(|e| e.to_string())?;
        target_window.show().map_err(|e| e.to_string())?;
        target_window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(mobile)]
    {
        let _ = window;
        let _ = app;
        Ok(())
    }
}

#[tauri::command]
async fn window_is_maximized(window: Window) -> Result<bool, String> {
    #[cfg(desktop)]
    return window.is_maximized().map_err(|e| e.to_string());
    #[cfg(mobile)]
    {
        let _ = window;
        Ok(true)
    }
}

#[tauri::command]
async fn window_set_fullscreen(window: Window, fullscreen: bool) -> Result<(), String> {
    #[cfg(desktop)]
    return window.set_fullscreen(fullscreen).map_err(|e| e.to_string());
    #[cfg(mobile)]
    {
        let _ = window;
        let _ = fullscreen;
        Ok(())
    }
}

#[tauri::command]
async fn window_is_fullscreen(window: Window) -> Result<bool, String> {
    #[cfg(desktop)]
    return window.is_fullscreen().map_err(|e| e.to_string());
    #[cfg(mobile)]
    {
        let _ = window;
        Ok(true)
    }
}

// Notification commands
#[tauri::command]
async fn show_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
    _tag: Option<String>,
    _data: Option<serde_json::Value>,
    _require_interaction: Option<bool>,
    _actions: Option<Vec<serde_json::Value>>,
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

        return app.notification()
            .builder()
            .title(title)
            .body(body)
            .show()
            .map_err(|e| e.to_string());
    }
}

#[tauri::command]
async fn request_notification_permission(app: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_notification::NotificationExt;

    // Check current permission status
    let permission = app
        .notification()
        .permission_state()
        .map_err(|e| e.to_string())?;

    match permission {
        tauri_plugin_notification::PermissionState::Granted => Ok("granted".to_string()),
        tauri_plugin_notification::PermissionState::Denied => Ok("denied".to_string()),
        _ => {
            // Request permission for any other state
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

#[tauri::command]
async fn is_notification_permission_granted(app: tauri::AppHandle) -> Result<bool, String> {
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

#[tauri::command]
async fn set_tray_unread_badge_count(
    app: tauri::AppHandle,
    unread_count: u32,
) -> Result<(), String> {
    #[cfg(desktop)]
    {
        let badge_state = app.state::<TrayBadgeState>();
        let icon = badge_state.icon_for_unread_count(unread_count)?;
        if let Some(tray) = app.tray_by_id(TRAY_ICON_ID) {
            tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;
            if unread_count > 0 {
                let badge_label = TrayBadgeState::format_badge_label(unread_count)
                    .unwrap_or_else(|| unread_count.to_string());
                let tooltip = format!("Obscur ({badge_label} unread)");
                let _ = tray.set_tooltip(Some(tooltip));
            } else {
                let _ = tray.set_tooltip(Some("Obscur"));
            }
        }
        return Ok(());
    }
    #[cfg(mobile)]
    {
        let _ = app;
        let _ = unread_count;
        Ok(())
    }
}

#[tauri::command]
async fn set_tray_incoming_call_state(
    app: tauri::AppHandle,
    active: bool,
    caller_name: Option<String>,
    room_id: Option<String>,
) -> Result<(), String> {
    #[cfg(desktop)]
    {
        let state = app.state::<TrayCallState>();
        let mut guard = state.incoming.lock().map_err(|e| e.to_string())?;
        if active {
            let caller = caller_name.unwrap_or_else(|| "Unknown caller".to_string());
            let room = room_id.unwrap_or_default();
            *guard = Some(IncomingCallTrayState {
                caller_name: caller,
                room_id: room,
            });
        } else {
            *guard = None;
        }
        drop(guard);
        refresh_tray_menu(&app)?;
        sync_incoming_call_surface_state(&app)?;
        return Ok(());
    }
    #[cfg(mobile)]
    {
        let _ = app;
        let _ = active;
        let _ = caller_name;
        let _ = room_id;
        Ok(())
    }
}

#[tauri::command]
async fn desktop_get_incoming_call_state(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
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
        let _ = app;
        Ok(json!({
            "active": false,
            "callerName": "",
            "roomId": "",
        }))
    }
}

#[tauri::command]
async fn desktop_incoming_call_action(app: tauri::AppHandle, action: String) -> Result<(), String> {
    #[cfg(desktop)]
    {
        let normalized_action = action.trim().to_lowercase();
        let mapped_action = match normalized_action.as_str() {
            "accept" => "accept",
            "decline" => "decline",
            "dismiss" => "decline",
            "open_chat" => "open_chat",
            _ => return Err("Unsupported incoming call action".to_string()),
        };
        emit_tray_call_action(&app, mapped_action)?;
        if mapped_action == "accept" || mapped_action == "decline" {
            clear_incoming_tray_call_state(&app)?;
            refresh_tray_menu(&app)?;
        }
        sync_incoming_call_surface_state(&app)?;
        return Ok(());
    }
    #[cfg(mobile)]
    {
        let _ = app;
        let _ = action;
        Ok(())
    }
}

#[tauri::command]
async fn register_push_token(
    _app: tauri::AppHandle,
    pubkey: String,
    token: String,
) -> Result<(), String> {
    eprintln!("[PUSH] Registering push token for {}: {}", pubkey, token);
    Ok(())
}

#[tauri::command]
async fn mine_pow(
    unsigned_event: nostr::prelude::UnsignedEvent,
    difficulty: u8,
) -> Result<nostr::prelude::UnsignedEvent, String> {
    libobscur::crypto::pow::mine_pow(unsigned_event, difficulty)
}

#[tauri::command]
async fn request_biometric_auth() -> Result<bool, String> {
    eprintln!("[BIOMETRIC] Triggering biometric authentication...");
    Ok(true)
}

// Theme detection commands
#[tauri::command]
async fn get_system_theme() -> Result<String, String> {
    // Platform-specific theme detection
    #[cfg(target_os = "windows")]
    {
        // Windows theme detection via registry
        use std::process::Command;
        let output = Command::new("reg")
            .args(&[
                "query",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
                "/v",
                "AppsUseLightTheme",
            ])
            .output();

        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.contains("0x0") {
                return Ok("dark".to_string());
            } else if stdout.contains("0x1") {
                return Ok("light".to_string());
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        // macOS theme detection via defaults
        use std::process::Command;
        let output = Command::new("defaults")
            .args(&["read", "-g", "AppleInterfaceStyle"])
            .output();

        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.trim() == "Dark" {
                return Ok("dark".to_string());
            }
        }
        // Falls through to default if not dark or if command fails
    }

    #[cfg(target_os = "linux")]
    {
        // Linux theme detection via gsettings (GNOME)
        use std::process::Command;
        let output = Command::new("gsettings")
            .args(&["get", "org.gnome.desktop.interface", "gtk-theme"])
            .output();

        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let theme = stdout.trim().to_lowercase();
            if theme.contains("dark") {
                return Ok("dark".to_string());
            }
        }
    }

    // Default fallback
    Ok("light".to_string())
}

#[tauri::command]
async fn start_tor(
    app: tauri::AppHandle,
    state: tauri::State<'_, TorState>,
) -> Result<String, String> {
    let already_running = {
        let lock = state.child.lock().map_err(|e| e.to_string())?;
        lock.is_some()
    };
    if already_running {
        let _ = refresh_tor_runtime_status_from_proxy(&state).await;
        let snapshot = build_tor_status_snapshot(&state)?;
        let reuse_message = "Tor process already running. Reusing shared runtime instance.";
        append_tor_log(&state, reuse_message)?;
        let _ = app.emit("tor-log", reuse_message);
        let _ = app.emit("tor-status", snapshot.state);
        return Ok("Tor is already running".to_string());
    }

    let sidecar = app.shell().sidecar("tor").map_err(|e| e.to_string())?;
    let (mut rx, child) = sidecar.spawn().map_err(|e| e.to_string())?;

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            let tor_state = app_handle.state::<TorState>();
            match event {
                CommandEvent::Stdout(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    let _ = append_tor_log(&tor_state, line_str.to_string());
                    let _ = app_handle.emit("tor-log", line_str.clone());
                    if line_str.contains("Bootstrapped 100%") {
                        let _ = set_tor_runtime_status(
                            &app_handle,
                            &tor_state,
                            TorRuntimeStatus::Connected,
                            Some(false),
                        );
                    } else if line_str.contains("Address already in use") {
                        let message = "Detected existing Tor instance on port 9050. Using existing connection...";
                        let _ = append_tor_log(&tor_state, message);
                        let _ = app_handle.emit("tor-log", message);
                        let _ = set_tor_runtime_status(
                            &app_handle,
                            &tor_state,
                            TorRuntimeStatus::Connected,
                            Some(true),
                        );
                    }
                }
                CommandEvent::Stderr(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    let _ = append_tor_log(&tor_state, line_str.to_string());
                    let _ = app_handle.emit("tor-error", line_str.clone());
                    if line_str.contains("Address already in use") {
                        let message = "Detected existing Tor instance on port 9050. Using existing connection...";
                        let _ = append_tor_log(&tor_state, message);
                        let _ = app_handle.emit("tor-log", message);
                        let _ = set_tor_runtime_status(
                            &app_handle,
                            &tor_state,
                            TorRuntimeStatus::Connected,
                            Some(true),
                        );
                    }
                }
                CommandEvent::Terminated(_payload) => {
                    if let Ok(mut child) = tor_state.child.lock() {
                        child.take();
                    }
                    let using_external_instance = tor_state
                        .using_external_instance
                        .lock()
                        .map(|guard| *guard)
                        .unwrap_or(false);
                    if !using_external_instance {
                        let _ = set_tor_runtime_status(
                            &app_handle,
                            &tor_state,
                            TorRuntimeStatus::Stopped,
                            Some(false),
                        );
                    }
                }
                _ => {}
            }
        }
    });

    let mut lock = state.child.lock().map_err(|e| e.to_string())?;
    *lock = Some(child);
    drop(lock);
    append_tor_log(&state, "Tor sidecar started. Waiting for bootstrap confirmation...")?;
    let _ = app.emit(
        "tor-log",
        "Tor sidecar started. Waiting for bootstrap confirmation...",
    );
    set_tor_runtime_status(&app, &state, TorRuntimeStatus::Starting, Some(false))?;
    Ok("Tor started".to_string())
}

#[tauri::command]
async fn stop_tor(
    state: tauri::State<'_, TorState>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    if stop_tor_child(&state)? {
        append_tor_log(&state, "Tor sidecar stopped.")?;
        let _ = app.emit("tor-log", "Tor sidecar stopped.");
        set_tor_runtime_status(&app, &state, TorRuntimeStatus::Stopped, Some(false))?;
        Ok("Tor stopped".to_string())
    } else {
        set_tor_runtime_status(&app, &state, TorRuntimeStatus::Stopped, Some(false))?;
        Ok("Tor is not running".to_string())
    }
}

#[tauri::command]
async fn get_tor_status(
    app: tauri::AppHandle,
    state: tauri::State<'_, TorState>,
) -> Result<TorStatusSnapshot, String> {
    if refresh_tor_runtime_status_from_proxy(&state).await? {
        let snapshot = build_tor_status_snapshot(&state)?;
        let _ = app.emit("tor-status", snapshot.state);
        return Ok(snapshot);
    }
    build_tor_status_snapshot(&state)
}

#[tauri::command]
async fn get_tor_logs(state: tauri::State<'_, TorState>) -> Result<Vec<String>, String> {
    let logs = state.logs.lock().map_err(|e| e.to_string())?;
    Ok(logs.clone())
}

#[tauri::command]
async fn save_tor_settings(
    app: tauri::AppHandle,
    state: tauri::State<'_, TorState>,
    net_runtime: tauri::State<'_, net::NativeNetworkRuntime>,
    enable_tor: bool,
    proxy_url: String,
) -> Result<(), String> {
    let mut settings = state.settings.lock().unwrap();
    settings.enable_tor = enable_tor;
    settings.proxy_url = proxy_url.clone();

    net_runtime.set(enable_tor, proxy_url.clone());

    if !enable_tor {
        let _ = set_tor_runtime_status(&app, &state, TorRuntimeStatus::Disconnected, Some(false));
    }

    // Save to file
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    let path = app_dir.join("tor_settings.json");
    let json = serde_json::to_string(&*settings).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())?;

    Ok(())
}

fn load_tor_settings(app: &tauri::AppHandle) -> TorSettings {
    let default = TorSettings {
        enable_tor: false,
        proxy_url: "socks5h://127.0.0.1:9050".to_string(),
    };

    let Ok(app_dir) = app.path().app_data_dir() else {
        return default;
    };
    let path = app_dir.join("tor_settings.json");
    let Ok(json) = std::fs::read_to_string(path) else {
        return default;
    };
    let mut settings: TorSettings = serde_json::from_str(&json).unwrap_or(default.clone());
    if settings.proxy_url == "socks5://127.0.0.1:9050" {
        settings.proxy_url = default.proxy_url;
    }
    settings
}

#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
    app.restart();
}

#[tauri::command]
async fn reset_app_storage(
    window: WebviewWindow,
    app: tauri::AppHandle,
) -> Result<ResetAppStorageReport, String> {
    let mut removed_paths: Vec<String> = Vec::new();
    let mut failed_paths: Vec<String> = Vec::new();
    let js_storage_script: &str =
        "try { localStorage.clear(); } catch (e) {}\ntry { sessionStorage.clear(); } catch (e) {}";
    let indexed_db_script: &str = "(async () => {\n  try {\n    if (!('indexedDB' in window)) return false;\n    const dbs = indexedDB.databases ? await indexedDB.databases() : [];\n    const names = Array.isArray(dbs) ? dbs.map((d) => d && d.name).filter(Boolean) : [];\n    await Promise.all(names.map((n) => new Promise((resolve) => {\n      try {\n        const req = indexedDB.deleteDatabase(n);\n        req.onsuccess = () => resolve(true);\n        req.onerror = () => resolve(false);\n        req.onblocked = () => resolve(false);\n      } catch (e) { resolve(false); }\n    })));\n    return true;\n  } catch (e) {\n    return false;\n  }\n})()";

    let js_storage_cleared: bool = window.eval(js_storage_script).is_ok();
    let indexed_db_cleared: bool = window.eval(indexed_db_script).is_ok();

    let app_data_dir = app.path().app_data_dir().ok();
    if let Some(dir) = &app_data_dir {
        let files_to_remove: [(&str, bool); 2] =
            [("tor_settings.json", false), ("window_state.json", false)];
        for (name, _) in files_to_remove {
            let path = dir.join(name);
            if path.exists() {
                match std::fs::remove_file(&path) {
                    Ok(_) => removed_paths.push(path.to_string_lossy().to_string()),
                    Err(_) => failed_paths.push(path.to_string_lossy().to_string()),
                }
            }
        }

        let dirs_to_remove: [&str; 8] = [
            "EBWebView",
            "WebView2",
            "webview",
            "cache",
            "Code Cache",
            "GPUCache",
            "Service Worker",
            "IndexedDB",
        ];
        for name in dirs_to_remove {
            let path = dir.join(name);
            if path.exists() {
                match std::fs::remove_dir_all(&path) {
                    Ok(_) => removed_paths.push(path.to_string_lossy().to_string()),
                    Err(_) => failed_paths.push(path.to_string_lossy().to_string()),
                }
            }
        }
    }

    Ok(ResetAppStorageReport {
        js_storage_cleared,
        indexed_db_cleared,
        app_data_dir: app_data_dir.map(|p| p.to_string_lossy().to_string()),
        removed_paths,
        failed_paths,
    })
}

#[tauri::command]
async fn desktop_open_storage_path(path: String) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Storage path is empty".to_string());
    }

    #[cfg(desktop)]
    {
        let target = std::path::PathBuf::from(trimmed);
        if !target.exists() {
            std::fs::create_dir_all(&target).map_err(|e| e.to_string())?;
        }

        #[cfg(target_os = "windows")]
        let mut command = {
            let mut cmd = std::process::Command::new("explorer");
            cmd.arg(&target);
            cmd
        };

        #[cfg(target_os = "macos")]
        let mut command = {
            let mut cmd = std::process::Command::new("open");
            cmd.arg(&target);
            cmd
        };

        #[cfg(target_os = "linux")]
        let mut command = {
            let mut cmd = std::process::Command::new("xdg-open");
            cmd.arg(&target);
            cmd
        };

        command
            .spawn()
            .map_err(|e| format!("Failed to open storage path: {e}"))?;
        Ok(())
    }

    #[cfg(mobile)]
    {
        let _ = trimmed;
        Err("Opening storage paths is not supported on mobile runtime".to_string())
    }
}

#[tauri::command]
async fn init_native_session(
    app: tauri::AppHandle,
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
                let entry_name = format!("nsec::{}", profile_id);
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
async fn clear_native_session(
    app: tauri::AppHandle,
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
async fn get_session_status(
    app: tauri::AppHandle,
    window: WebviewWindow,
    session: tauri::State<'_, SessionState>,
    profiles: tauri::State<'_, DesktopProfileState>,
) -> Result<session::SessionStatus, String> {
    let profile_id = resolve_profile_for_window(&app, &profiles, &window).await?;
    let keys_opt = session.get_keys(&profile_id).await;
    let npub = keys_opt.map(|k| k.public_key().to_string());
    let is_active = npub.is_some();

    Ok(session::SessionStatus {
        is_active,
        npub,
        is_native: true,
    })
}

#[tauri::command]
async fn desktop_get_profile_isolation_snapshot(
    app: tauri::AppHandle,
    window: WebviewWindow,
    profiles: tauri::State<'_, DesktopProfileState>,
) -> Result<ProfileIsolationSnapshot, String> {
    profiles.snapshot_for_window(&app, window.label()).await
}

#[tauri::command]
async fn desktop_list_profiles(
    profiles: tauri::State<'_, DesktopProfileState>,
) -> Result<Vec<ProfileSummary>, String> {
    Ok(profiles.list_profiles().await)
}

#[tauri::command]
async fn desktop_create_profile(
    app: tauri::AppHandle,
    window: WebviewWindow,
    profiles: tauri::State<'_, DesktopProfileState>,
    label: String,
) -> Result<ProfileIsolationSnapshot, String> {
    profiles.create_profile(&app, &label, window.label()).await
}

#[tauri::command]
async fn desktop_rename_profile(
    app: tauri::AppHandle,
    window: WebviewWindow,
    profiles: tauri::State<'_, DesktopProfileState>,
    profile_id: String,
    label: String,
) -> Result<ProfileIsolationSnapshot, String> {
    profiles.rename_profile(&app, &profile_id, &label, window.label()).await
}

#[tauri::command]
async fn desktop_open_profile_window(
    app: tauri::AppHandle,
    profiles: tauri::State<'_, DesktopProfileState>,
    profile_id: String,
) -> Result<(), String> {
    profiles.open_profile_window(&app, &profile_id).await
}

#[tauri::command]
async fn desktop_bind_window_profile(
    app: tauri::AppHandle,
    window: WebviewWindow,
    profiles: tauri::State<'_, DesktopProfileState>,
    profile_id: String,
) -> Result<ProfileIsolationSnapshot, String> {
    profiles.bind_window_profile(&app, window.label(), &profile_id).await
}

#[tauri::command]
async fn desktop_remove_profile(
    app: tauri::AppHandle,
    window: WebviewWindow,
    profiles: tauri::State<'_, DesktopProfileState>,
    profile_id: String,
) -> Result<ProfileIsolationSnapshot, String> {
    profiles.remove_profile(&app, window.label(), &profile_id).await
}

// Save window state to storage
#[tauri::command]
async fn save_window_state(window: WebviewWindow, app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    {
        let state = capture_window_state(&window)?;
        write_window_state(&app, window.label(), &state)?;
    }
    #[cfg(mobile)]
    {
        let _ = window;
        let _ = app;
    }

    Ok(())
}

// Load window state from storage
#[cfg(desktop)]
fn load_window_state(app: &tauri::AppHandle) -> Option<WindowState> {
    if cfg!(debug_assertions) && !PERSIST_WINDOW_STATE_IN_DEBUG {
        return None;
    }
    let app_dir = app.path().app_data_dir().ok()?;
    let state_path = app_dir.join("window_state.json");
    let state_json = std::fs::read_to_string(state_path).ok()?;
    let raw = serde_json::from_str::<WindowState>(&state_json).ok()?;
    Some(sanitize_window_state(raw))
}

// Apply saved window state
#[cfg(desktop)]
fn apply_window_state(window: &WebviewWindow, state: WindowState) {
    let _ = window.set_resizable(true);
    if state.maximized {
        let _ = window.maximize();
    } else {
        if is_reasonable_window_position(state.x, state.y) {
            let _ = window.set_position(PhysicalPosition::new(state.x, state.y));
        }
        let _ = window.set_size(PhysicalSize::new(state.width, state.height));
    }
}

#[cfg(desktop)]
fn sanitize_window_state(state: WindowState) -> WindowState {
    let width = state
        .width
        .clamp(MIN_WINDOW_WIDTH, MAX_REASONABLE_WINDOW_WIDTH);
    let height = state
        .height
        .clamp(MIN_WINDOW_HEIGHT, MAX_REASONABLE_WINDOW_HEIGHT);
    let x = state.x.clamp(-MAX_REASONABLE_POSITION_ABS, MAX_REASONABLE_POSITION_ABS);
    let y = state.y.clamp(-MAX_REASONABLE_POSITION_ABS, MAX_REASONABLE_POSITION_ABS);

    let width = if width == 0 { DEFAULT_WINDOW_WIDTH } else { width };
    let height = if height == 0 { DEFAULT_WINDOW_HEIGHT } else { height };

    WindowState {
        x,
        y,
        width,
        height,
        maximized: state.maximized,
    }
}

#[cfg(desktop)]
fn is_reasonable_window_position(x: i32, y: i32) -> bool {
    x.abs() <= MAX_REASONABLE_POSITION_ABS && y.abs() <= MAX_REASONABLE_POSITION_ABS
}

#[cfg(desktop)]
fn capture_window_state(window: &WebviewWindow) -> Result<WindowState, String> {
    let position = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let maximized = window.is_maximized().map_err(|e| e.to_string())?;
    Ok(sanitize_window_state(WindowState {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        maximized,
    }))
}

#[cfg(desktop)]
fn write_window_state(
    app: &tauri::AppHandle,
    window_label: &str,
    state: &WindowState,
) -> Result<(), String> {
    if cfg!(debug_assertions) && !PERSIST_WINDOW_STATE_IN_DEBUG {
        return Ok(());
    }
    if window_label != MAIN_WINDOW_LABEL {
        return Ok(());
    }

    let state_json = serde_json::to_string(state).map_err(|e| e.to_string())?;
    if let Ok(app_dir) = app.path().app_data_dir() {
        std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
        let state_path = app_dir.join("window_state.json");
        std::fs::write(state_path, state_json).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(desktop)]
fn create_tray_menu(
    app: &tauri::AppHandle,
    incoming_call: Option<&IncomingCallTrayState>,
) -> Result<Menu<tauri::Wry>, tauri::Error> {
    let show_i = MenuItem::with_id(app, TRAY_MENU_SHOW_ID, "Show Obscur", true, None::<&str>)?;
    let hide_i = MenuItem::with_id(app, TRAY_MENU_HIDE_ID, "Hide to Tray", true, None::<&str>)?;
    let (accept_label, decline_label, call_enabled) = if let Some(call) = incoming_call {
        let caller = call.caller_name.trim();
        let caller_hint = if caller.is_empty() { "caller" } else { caller };
        (
            format!("Accept call from {caller_hint}"),
            format!("Decline call from {caller_hint}"),
            true,
        )
    } else {
        (
            "Accept incoming call".to_string(),
            "Decline incoming call".to_string(),
            false,
        )
    };
    let accept_i = MenuItem::with_id(
        app,
        TRAY_MENU_ACCEPT_CALL_ID,
        accept_label,
        call_enabled,
        None::<&str>,
    )?;
    let decline_i = MenuItem::with_id(
        app,
        TRAY_MENU_DECLINE_CALL_ID,
        decline_label,
        call_enabled,
        None::<&str>,
    )?;
    let quit_i = MenuItem::with_id(app, TRAY_MENU_QUIT_ID, "Quit", true, None::<&str>)?;
    Menu::with_items(app, &[&show_i, &hide_i, &accept_i, &decline_i, &quit_i])
}

#[cfg(desktop)]
fn current_incoming_tray_call_state(app: &tauri::AppHandle) -> Result<Option<IncomingCallTrayState>, String> {
    let state = app.state::<TrayCallState>();
    let guard = state.incoming.lock().map_err(|e| e.to_string())?;
    Ok(guard.clone())
}

#[cfg(desktop)]
fn current_incoming_call_state_payload(app: &tauri::AppHandle) -> Result<IncomingCallStatePayload, String> {
    let incoming = current_incoming_tray_call_state(app)?;
    if let Some(value) = incoming {
        return Ok(IncomingCallStatePayload {
            active: true,
            caller_name: value.caller_name,
            room_id: value.room_id,
        });
    }
    Ok(IncomingCallStatePayload {
        active: false,
        caller_name: String::new(),
        room_id: String::new(),
    })
}

#[cfg(desktop)]
fn emit_incoming_call_state(app: &tauri::AppHandle) -> Result<(), String> {
    let payload = current_incoming_call_state_payload(app)?;
    app.emit(INCOMING_CALL_STATE_EVENT_NAME, payload)
        .map_err(|e| e.to_string())
}

#[cfg(desktop)]
fn position_incoming_call_window(window: &WebviewWindow) {
    let monitor = window.current_monitor().ok().flatten();
    let Some(monitor) = monitor else {
        return;
    };
    let monitor_size = monitor.size();
    let monitor_position = monitor.position();
    let window_size = window.outer_size().unwrap_or(PhysicalSize::new(460, 260));
    let x = monitor_position.x + monitor_size.width as i32 - window_size.width as i32 - 24;
    let y = monitor_position.y + monitor_size.height as i32 - window_size.height as i32 - 48;
    let _ = window.set_position(PhysicalPosition::new(x, y));
}

#[cfg(desktop)]
fn ensure_incoming_call_window(app: &tauri::AppHandle) -> Result<WebviewWindow, String> {
    if let Some(existing) = app.get_webview_window(INCOMING_CALL_WINDOW_LABEL) {
        let _ = existing.unminimize();
        let _ = existing.show();
        let _ = existing.set_focus();
        position_incoming_call_window(&existing);
        return Ok(existing);
    }

    let window = tauri::WebviewWindowBuilder::new(
        app,
        INCOMING_CALL_WINDOW_LABEL,
        tauri::WebviewUrl::App("index.html?incomingCallPopup=1".into()),
    )
    .title("Incoming call")
    .inner_size(460.0, 260.0)
    .min_inner_size(420.0, 220.0)
    .maximizable(false)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .focused(true)
    .visible(true)
    .build()
    .map_err(|e| e.to_string())?;
    position_incoming_call_window(&window);
    Ok(window)
}

#[cfg(desktop)]
fn hide_incoming_call_window(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(INCOMING_CALL_WINDOW_LABEL) {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(desktop)]
fn refresh_tray_menu(app: &tauri::AppHandle) -> Result<(), String> {
    let incoming = current_incoming_tray_call_state(app)?;
    let menu = create_tray_menu(app, incoming.as_ref()).map_err(|e| e.to_string())?;
    if let Some(tray) = app.tray_by_id(TRAY_ICON_ID) {
        tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(desktop)]
fn clear_incoming_tray_call_state(app: &tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<TrayCallState>();
    let mut guard = state.incoming.lock().map_err(|e| e.to_string())?;
    *guard = None;
    Ok(())
}

#[cfg(desktop)]
fn sync_incoming_call_surface_state(app: &tauri::AppHandle) -> Result<(), String> {
    let payload = current_incoming_call_state_payload(app)?;
    if payload.active {
        let _ = ensure_incoming_call_window(app)?;
    } else {
        hide_incoming_call_window(app)?;
    }
    emit_incoming_call_state(app)?;
    Ok(())
}

#[cfg(desktop)]
fn emit_tray_call_action(app: &tauri::AppHandle, action: &str) -> Result<(), String> {
    let room_id = current_incoming_tray_call_state(app)?
        .map(|value| value.room_id);
    app.emit(
        TRAY_INCOMING_CALL_EVENT_NAME,
        TrayIncomingCallActionPayload {
            action: action.to_string(),
            room_id,
        },
    )
    .map_err(|e| e.to_string())
}

#[cfg(desktop)]
fn glyph_rows(character: char) -> Option<[u8; 5]> {
    match character {
        '0' => Some([0b111, 0b101, 0b101, 0b101, 0b111]),
        '1' => Some([0b010, 0b110, 0b010, 0b010, 0b111]),
        '2' => Some([0b111, 0b001, 0b111, 0b100, 0b111]),
        '3' => Some([0b111, 0b001, 0b111, 0b001, 0b111]),
        '4' => Some([0b101, 0b101, 0b111, 0b001, 0b001]),
        '5' => Some([0b111, 0b100, 0b111, 0b001, 0b111]),
        '6' => Some([0b111, 0b100, 0b111, 0b101, 0b111]),
        '7' => Some([0b111, 0b001, 0b001, 0b001, 0b001]),
        '8' => Some([0b111, 0b101, 0b111, 0b101, 0b111]),
        '9' => Some([0b111, 0b101, 0b111, 0b001, 0b111]),
        '+' => Some([0b000, 0b010, 0b111, 0b010, 0b000]),
        _ => None,
    }
}

#[cfg(desktop)]
fn set_pixel_rgba(
    rgba: &mut [u8],
    width: usize,
    height: usize,
    x: usize,
    y: usize,
    color: [u8; 4],
) {
    if x >= width || y >= height {
        return;
    }
    let index = ((y * width) + x) * 4;
    if index + 3 >= rgba.len() {
        return;
    }
    rgba[index] = color[0];
    rgba[index + 1] = color[1];
    rgba[index + 2] = color[2];
    rgba[index + 3] = color[3];
}

#[cfg(desktop)]
fn draw_badge_background(
    rgba: &mut [u8],
    width: usize,
    height: usize,
    x: usize,
    y: usize,
    bubble_width: usize,
    bubble_height: usize,
    color: [u8; 4],
) {
    if bubble_width == 0 || bubble_height == 0 {
        return;
    }
    let radius = bubble_height / 2;
    let center_y = y + radius;
    let left_center_x = x + radius;
    let right_center_x = x + bubble_width.saturating_sub(radius + 1);

    for current_y in y..(y + bubble_height) {
        if current_y >= height {
            break;
        }
        for current_x in x..(x + bubble_width) {
            if current_x >= width {
                break;
            }

            let inside_middle = current_x >= left_center_x && current_x <= right_center_x;
            let within_left_arc = {
                let dx = left_center_x as isize - current_x as isize;
                let dy = center_y as isize - current_y as isize;
                (dx * dx + dy * dy) <= (radius as isize * radius as isize)
            };
            let within_right_arc = {
                let dx = right_center_x as isize - current_x as isize;
                let dy = center_y as isize - current_y as isize;
                (dx * dx + dy * dy) <= (radius as isize * radius as isize)
            };

            if inside_middle || within_left_arc || within_right_arc {
                set_pixel_rgba(rgba, width, height, current_x, current_y, color);
            }
        }
    }
}

#[cfg(desktop)]
fn draw_glyph(
    rgba: &mut [u8],
    width: usize,
    height: usize,
    x: usize,
    y: usize,
    character: char,
    scale: usize,
    color: [u8; 4],
) {
    let Some(rows) = glyph_rows(character) else {
        return;
    };
    for (row_index, row_bits) in rows.iter().enumerate() {
        for col_index in 0..3 {
            let bit_mask = 1 << (2 - col_index);
            if (row_bits & bit_mask) == 0 {
                continue;
            }
            for sy in 0..scale {
                for sx in 0..scale {
                    set_pixel_rgba(
                        rgba,
                        width,
                        height,
                        x + (col_index * scale) + sx,
                        y + (row_index * scale) + sy,
                        color,
                    );
                }
            }
        }
    }
}

#[cfg(desktop)]
fn render_badged_tray_icon(
    base_icon: &tauri::image::Image<'static>,
    badge_label: &str,
) -> tauri::image::Image<'static> {
    let width = base_icon.width() as usize;
    let height = base_icon.height() as usize;
    let mut rgba = base_icon.rgba().to_vec();
    if width == 0 || height == 0 || badge_label.is_empty() {
        return tauri::image::Image::new_owned(rgba, base_icon.width(), base_icon.height());
    }

    let label_chars: Vec<char> = badge_label.chars().take(3).collect();
    let glyph_width = 3usize;
    let glyph_height = 5usize;
    let spacing = 1usize;
    let scale = if width >= 48 || height >= 48 { 3usize } else { 2usize };
    let text_width = ((label_chars.len() * glyph_width) + (label_chars.len().saturating_sub(1) * spacing)) * scale;
    let text_height = glyph_height * scale;

    let padding_x = scale + 1;
    let padding_y = scale;
    let mut bubble_height = text_height + (padding_y * 2);
    bubble_height = bubble_height.max((height / 2).max(12));
    let mut bubble_width = text_width + (padding_x * 2);
    bubble_width = bubble_width.max(bubble_height);
    bubble_width = bubble_width.min(width.saturating_sub(1));
    bubble_height = bubble_height.min(height.saturating_sub(1));

    let bubble_x = width.saturating_sub(bubble_width + 1);
    let bubble_y = 1usize;

    draw_badge_background(
        &mut rgba,
        width,
        height,
        bubble_x,
        bubble_y,
        bubble_width,
        bubble_height,
        [220, 38, 38, 255],
    );

    let text_x = bubble_x + (bubble_width.saturating_sub(text_width) / 2);
    let text_y = bubble_y + (bubble_height.saturating_sub(text_height) / 2);
    for (index, character) in label_chars.iter().enumerate() {
        let glyph_x = text_x + (index * (glyph_width + spacing) * scale);
        draw_glyph(
            &mut rgba,
            width,
            height,
            glyph_x,
            text_y,
            *character,
            scale,
            [255, 255, 255, 255],
        );
    }

    tauri::image::Image::new_owned(
        rgba,
        base_icon.width(),
        base_icon.height(),
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init());

    #[cfg(mobile)]
    let builder = builder.plugin(tauri_plugin_store::Builder::new().build());

    builder
        .setup(|app| {
            app.manage(relay::RelayPool::new());
            let settings = load_tor_settings(&app.handle());

            app.manage(net::NativeNetworkRuntime::new(
                settings.enable_tor,
                settings.proxy_url.clone(),
            ));

            // Manage SessionState
            app.manage(SessionState::new());
            app.manage(DesktopProfileState::new(&app.handle()));
            let protocol_db_path = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."))
                .join("protocol_state.sqlite3");
            app.manage(protocol::ProtocolState::new(protocol_db_path));

            // Manage TorState with loaded settings
            app.manage(TorState {
                child: Mutex::new(None),
                settings: Mutex::new(settings.clone()),
                runtime_status: Mutex::new(TorRuntimeStatus::Disconnected),
                using_external_instance: Mutex::new(false),
                logs: Mutex::new(Vec::new()),
            });

            // Start Tor if enabled
            if settings.enable_tor {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let _ = start_tor(handle.clone(), handle.state()).await;
                });
            }

            // Create main window with proxy if enabled
            let app_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            let main_data_dir = app_dir.join("profiles").join("default");
            std::fs::create_dir_all(&main_data_dir).expect("Failed to create profile directory");

            let mut window_builder = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .data_directory(main_data_dir);

            #[cfg(desktop)]
            {
                window_builder = window_builder
                    .title("Obscur")
                    .inner_size(1200.0, 800.0)
                    .min_inner_size(800.0, 600.0)
                    .resizable(true)
                    .decorations(false)
                    .shadow(true) // We keep window shadow but remove OS border decorations
                    .visible(false); // Hide initially to apply state
            }

            let _window = window_builder.build().expect("Failed to build main window");
            let profile_state = app.state::<DesktopProfileState>();
            let _ = tauri::async_runtime::block_on(profile_state.reset_startup_window_bindings(&app.handle()));
            #[cfg(desktop)]
            {
                let base_icon = app
                    .default_window_icon()
                    .cloned()
                    .ok_or("default window icon missing")?
                    .to_owned();
                app.manage(TrayCallState {
                    incoming: Mutex::new(None),
                });
                app.manage(TrayBadgeState::new(base_icon.clone()));
                let menu = create_tray_menu(&app.handle(), None)?;

                let _tray = TrayIconBuilder::with_id(TRAY_ICON_ID)
                    .icon(base_icon)
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        TRAY_MENU_QUIT_ID => {
                            let state = app.state::<TorState>();
                            let _ = stop_tor_child(&state);
                            app.exit(0);
                        }
                        TRAY_MENU_SHOW_ID => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.unminimize();
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        TRAY_MENU_HIDE_ID => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.hide();
                            }
                        }
                        TRAY_MENU_ACCEPT_CALL_ID => {
                            let _ = emit_tray_call_action(app, "accept");
                            let _ = clear_incoming_tray_call_state(app);
                            let _ = refresh_tray_menu(app);
                            let _ = sync_incoming_call_surface_state(app);
                        }
                        TRAY_MENU_DECLINE_CALL_ID => {
                            let _ = emit_tray_call_action(app, "decline");
                            let _ = clear_incoming_tray_call_state(app);
                            let _ = refresh_tray_menu(app);
                            let _ = sync_incoming_call_surface_state(app);
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Left,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.unminimize();
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    })
                    .build(app)?;
            }

            // Load and apply saved window state
            #[cfg(desktop)]
            {
                if let Some(state) = load_window_state(&app.handle()) {
                    apply_window_state(&_window, state);
                }

                // Show the window now
                let _ = _window.unminimize();
                let _ = _window.show();
                let _ = _window.set_focus();
            }

            // Save window state and intercept close
            #[cfg(desktop)]
            {
                let app_handle = app.handle().clone();
                let window_clone = _window.clone();
                _window.on_window_event(move |event| {
                    match event {
                        tauri::WindowEvent::CloseRequested { api, .. } => {
                            if let Ok(state) = capture_window_state(&window_clone) {
                                let _ = write_window_state(&app_handle, window_clone.label(), &state);
                            }
                            // Prevent the window from closing and hide it instead
                            api.prevent_close();
                            let _ = window_clone.hide();
                        }
                        tauri::WindowEvent::Destroyed => {
                            let state = app_handle.state::<TorState>();
                            let _ = stop_tor_child(&state);
                        }
                        _ => {}
                    }
                });
            }

            // Register deep link handler
            let app_handle = app.handle().clone();
            // Deep link registration might be platform specific or handled by plugin
            // #[cfg(desktop)]
            // app.deep_link().register_all()?;

            app.deep_link().on_open_url(move |event| {
                let urls = event.urls();
                let url = urls.first().map(|u| u.as_str()).unwrap_or("").to_string();

                // Emit event to frontend
                if let Some(window) = app_handle.get_webview_window("main") {
                    #[cfg(desktop)]
                    {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                    let _ = window.emit("deep-link", json!({ "url": url }));
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_for_updates,
            install_update,
            window_minimize,
            window_maximize,
            window_unmaximize,
            window_close,
            window_show_and_focus,
            window_is_maximized,
            window_set_fullscreen,
            window_is_fullscreen,
            save_window_state,
            reset_app_storage,
            desktop_get_profile_isolation_snapshot,
            desktop_list_profiles,
            desktop_create_profile,
            desktop_rename_profile,
            desktop_open_profile_window,
            desktop_bind_window_profile,
            desktop_remove_profile,
            show_notification,
            request_notification_permission,
            is_notification_permission_granted,
            set_tray_unread_badge_count,
            set_tray_incoming_call_state,
            desktop_get_incoming_call_state,
            desktop_incoming_call_action,
            get_system_theme,
            upload::nip96_upload,
            upload::nip96_upload_v2,
            relay::connect_relay,
            relay::probe_relay,
            relay::disconnect_relay,
            relay::recycle_relays,
            relay::publish_event,
            relay::subscribe_relay,
            relay::unsubscribe_relay,
            relay::send_relay_message,
            wallet::get_native_npub,
            wallet::import_native_nsec,
            wallet::generate_native_nsec,
            wallet::sign_event_native,
            wallet::logout_native,
            wallet::encrypt_nip04,
            wallet::decrypt_nip04,
            wallet::encrypt_nip44,
            wallet::decrypt_nip44,
            wallet::encrypt_gift_wrap,
            wallet::decrypt_gift_wrap,
            wallet::get_session_nsec,
            start_tor,
            stop_tor,
            get_tor_status,
            get_tor_logs,
            save_tor_settings,
            restart_app,
            init_native_session,
            desktop_open_storage_path,
            clear_native_session,
            get_session_status,
            request_biometric_auth,
            register_push_token,
            mine_pow,
            protocol::protocol_get_identity_root_state,
            protocol::protocol_get_session_state,
            protocol::protocol_authorize_device,
            protocol::protocol_revoke_device,
            protocol::protocol_x3dh_handshake,
            protocol::protocol_get_ratchet_session,
            protocol::protocol_verify_message_envelope,
            protocol::protocol_publish_with_quorum,
            protocol::protocol_check_storage_health,
            protocol::protocol_run_storage_recovery
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
