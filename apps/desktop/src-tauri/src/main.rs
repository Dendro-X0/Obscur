#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_updater::UpdaterExt;
use tauri::{Manager, PhysicalPosition, PhysicalSize, Window, Emitter, WebviewWindow};
use serde_json::json;
use tauri_plugin_deep_link::DeepLinkExt;

// Window state persistence
#[derive(serde::Serialize, serde::Deserialize, Debug)]
struct WindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
}

#[tauri::command]
async fn check_for_updates(app: tauri::AppHandle) -> Result<String, String> {
    match app.updater_builder().build() {
        Ok(updater) => {
            match updater.check().await {
                Ok(Some(update)) => {
                    let version = update.version.clone();
                    Ok(format!("Update available: {}", version))
                }
                Ok(None) => Ok("No updates available".to_string()),
                Err(e) => Err(format!("Failed to check for updates: {}", e)),
            }
        }
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
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
async fn window_maximize(window: Window) -> Result<(), String> {
    window.maximize().map_err(|e| e.to_string())
}

#[tauri::command]
async fn window_unmaximize(window: Window) -> Result<(), String> {
    window.unmaximize().map_err(|e| e.to_string())
}

#[tauri::command]
async fn window_close(window: Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
async fn window_is_maximized(window: Window) -> Result<bool, String> {
    window.is_maximized().map_err(|e| e.to_string())
}

#[tauri::command]
async fn window_set_fullscreen(window: Window, fullscreen: bool) -> Result<(), String> {
    window.set_fullscreen(fullscreen).map_err(|e| e.to_string())
}

#[tauri::command]
async fn window_is_fullscreen(window: Window) -> Result<bool, String> {
    window.is_fullscreen().map_err(|e| e.to_string())
}

// Notification commands
#[tauri::command]
async fn show_notification(app: tauri::AppHandle, title: String, body: String) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn request_notification_permission(app: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_notification::NotificationExt;
    
    // Check current permission status
    let permission = app.notification().permission_state().map_err(|e| e.to_string())?;
    
    match permission {
        tauri_plugin_notification::PermissionState::Granted => Ok("granted".to_string()),
        tauri_plugin_notification::PermissionState::Denied => Ok("denied".to_string()),
        _ => {
            // Request permission for any other state
            app.notification().request_permission().map_err(|e| e.to_string())?;
            let new_permission = app.notification().permission_state().map_err(|e| e.to_string())?;
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
    
    let permission = app.notification().permission_state().map_err(|e| e.to_string())?;
    Ok(matches!(permission, tauri_plugin_notification::PermissionState::Granted))
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
            .args(&["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize", "/v", "AppsUseLightTheme"])
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

// Save window state to storage
#[tauri::command]
async fn save_window_state(window: WebviewWindow, app: tauri::AppHandle) -> Result<(), String> {
    let position = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let maximized = window.is_maximized().map_err(|e| e.to_string())?;

    let state = WindowState {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        maximized,
    };

    let state_json = serde_json::to_string(&state).map_err(|e| e.to_string())?;
    
    // Store in app data directory
    if let Some(app_dir) = app.path().app_data_dir().ok() {
        std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
        let state_path = app_dir.join("window_state.json");
        std::fs::write(state_path, state_json).map_err(|e| e.to_string())?;
    }

    Ok(())
}

// Load window state from storage
fn load_window_state(app: &tauri::AppHandle) -> Option<WindowState> {
    let app_dir = app.path().app_data_dir().ok()?;
    let state_path = app_dir.join("window_state.json");
    let state_json = std::fs::read_to_string(state_path).ok()?;
    serde_json::from_str(&state_json).ok()
}

// Apply saved window state
fn apply_window_state(window: &WebviewWindow, state: WindowState) {
    if state.maximized {
        let _ = window.maximize();
    } else {
        let _ = window.set_position(PhysicalPosition::new(state.x, state.y));
        let _ = window.set_size(PhysicalSize::new(state.width, state.height));
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            // Get the main window
            let window = app.get_webview_window("main").expect("Failed to get main window");
            
            // Load and apply saved window state
            if let Some(state) = load_window_state(&app.handle()) {
                apply_window_state(&window, state);
            }

            // Save window state on close
            let app_handle = app.handle().clone();
            let window_clone = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { .. } = event {
                    let _ = tauri::async_runtime::block_on(async {
                        save_window_state(window_clone.clone(), app_handle.clone()).await
                    });
                }
            });

            // Register deep link handler
            let app_handle = app.handle().clone();
            app.deep_link().register_all()?;
            app.deep_link().on_open_url(move |event| {
                let urls = event.urls();
                let url = urls.first().map(|u| u.as_str()).unwrap_or("").to_string();
                println!("Deep link opened: {}", url);
                
                // Emit event to frontend
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.emit("deep-link", json!({ "url": url }));
                }
            });

            // Check for updates on startup
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(updater) = app_handle.updater_builder().build() {
                    if let Ok(Some(update)) = updater.check().await {
                        println!("Update available: {}", update.version);
                        // The dialog is enabled in tauri.conf.json, so it will show automatically
                    }
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
            window_is_maximized,
            window_set_fullscreen,
            window_is_fullscreen,
            save_window_state,
            show_notification,
            request_notification_permission,
            is_notification_permission_granted,
            get_system_theme
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
