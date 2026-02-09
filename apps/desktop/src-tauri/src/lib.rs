#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_updater::UpdaterExt;
use tauri::{
    Emitter, Manager, WebviewWindow, Window,
};
#[cfg(desktop)]
use tauri::{PhysicalPosition, PhysicalSize};
#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
};
// use serde::{Serialize, Deserialize};
use serde_json::json;
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandEvent, CommandChild};
use std::sync::Mutex;
mod upload;
mod relay;
mod wallet;
mod net;
mod session;

use nostr::ToBech32;
use session::{SessionState, SessionResponse};

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

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct TorSettings {
    enable_tor: bool,
    proxy_url: String,
}

struct TorState {
    child: Mutex<Option<CommandChild>>,
    settings: Mutex<TorSettings>,
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
async fn window_close(window: Window) -> Result<(), String> {
    // For background mode, we might want this to just hide the window
    #[cfg(desktop)]
    return window.hide().map_err(|e| e.to_string());
    #[cfg(mobile)]
    {
        let _ = window;
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

#[tauri::command]
async fn start_tor(app: tauri::AppHandle, state: tauri::State<'_, TorState>) -> Result<String, String> {
    let mut lock = state.child.lock().unwrap();
    if lock.is_some() {
        return Ok("Tor is already running".to_string());
    }

    let sidecar = app.shell().sidecar("bin/tor").map_err(|e| e.to_string())?;
    let (mut rx, child) = sidecar.spawn().map_err(|e| e.to_string())?;

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    app_handle.emit("tor-log", line_str.clone()).unwrap();
                    if line_str.contains("Bootstrapped 100%") {
                        app_handle.emit("tor-status", "connected").unwrap();
                    }
                }
                CommandEvent::Stderr(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    app_handle.emit("tor-error", line_str).unwrap();
                }
                CommandEvent::Terminated(payload) => {
                    app_handle.emit("tor-status", format!("terminated: {}", payload.code.unwrap_or(-1))).unwrap();
                }
                _ => {}
            }
        }
    });

    *lock = Some(child);
    app.emit("tor-status", "starting").unwrap();
    Ok("Tor started".to_string())
}

#[tauri::command]
async fn stop_tor(state: tauri::State<'_, TorState>, app: tauri::AppHandle) -> Result<String, String> {
    let mut lock = state.child.lock().unwrap();
    if let Some(child) = lock.take() {
        child.kill().map_err(|e| e.to_string())?;
        app.emit("tor-status", "stopped").unwrap();
        Ok("Tor stopped".to_string())
    } else {
        Ok("Tor is not running".to_string())
    }
}

#[tauri::command]
async fn get_tor_status(state: tauri::State<'_, TorState>) -> Result<bool, String> {
    let lock = state.child.lock().unwrap();
    Ok(lock.is_some())
}

#[tauri::command]
async fn save_tor_settings(
    app: tauri::AppHandle,
    state: tauri::State<'_, TorState>,
    net_runtime: tauri::State<'_, net::NativeNetworkRuntime>,
    enable_tor: bool,
    proxy_url: String
) -> Result<(), String> {
    let mut settings = state.settings.lock().unwrap();
    settings.enable_tor = enable_tor;
    settings.proxy_url = proxy_url.clone();

    net_runtime.set(enable_tor, proxy_url.clone());

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
        proxy_url: "socks5://127.0.0.1:9050".to_string(),
    };

    let Ok(app_dir) = app.path().app_data_dir() else { return default; };
    let path = app_dir.join("tor_settings.json");
    let Ok(json) = std::fs::read_to_string(path) else { return default; };
    serde_json::from_str(&json).unwrap_or(default)
}


#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
    app.restart();
}

#[tauri::command]
async fn reset_app_storage(window: WebviewWindow, app: tauri::AppHandle) -> Result<ResetAppStorageReport, String> {
    let mut removed_paths: Vec<String> = Vec::new();
    let mut failed_paths: Vec<String> = Vec::new();
    let js_storage_script: &str = "try { localStorage.clear(); } catch (e) {}\ntry { sessionStorage.clear(); } catch (e) {}";
    let indexed_db_script: &str = "(async () => {\n  try {\n    if (!('indexedDB' in window)) return false;\n    const dbs = indexedDB.databases ? await indexedDB.databases() : [];\n    const names = Array.isArray(dbs) ? dbs.map((d) => d && d.name).filter(Boolean) : [];\n    await Promise.all(names.map((n) => new Promise((resolve) => {\n      try {\n        const req = indexedDB.deleteDatabase(n);\n        req.onsuccess = () => resolve(true);\n        req.onerror = () => resolve(false);\n        req.onblocked = () => resolve(false);\n      } catch (e) { resolve(false); }\n    })));\n    return true;\n  } catch (e) {\n    return false;\n  }\n})()";

    let js_storage_cleared: bool = window.eval(js_storage_script).is_ok();
    let indexed_db_cleared: bool = window.eval(indexed_db_script).is_ok();

    let app_data_dir = app.path().app_data_dir().ok();
    if let Some(dir) = &app_data_dir {
        let files_to_remove: [(&str, bool); 2] = [("tor_settings.json", false), ("window_state.json", false)];
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
async fn init_native_session(
    session: tauri::State<'_, SessionState>,
    nsec: String,
) -> Result<SessionResponse, String> {
    match session.set_keys(&nsec).await {
        Ok(pubkey) => {
            let npub = pubkey.to_bech32().map_err(|e| e.to_string())?;
            eprintln!("[SESSION] Native session initialized for {}", npub);
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
async fn clear_native_session(session: tauri::State<'_, SessionState>) -> Result<(), String> {
    session.clear().await;
    eprintln!("[SESSION] Native session cleared");
    Ok(())
}


// Save window state to storage
#[tauri::command]
async fn save_window_state(window: WebviewWindow, app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    {
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
    let app_dir = app.path().app_data_dir().ok()?;
    let state_path = app_dir.join("window_state.json");
    let state_json = std::fs::read_to_string(state_path).ok()?;
    serde_json::from_str(&state_json).ok()
}

// Apply saved window state
#[cfg(desktop)]
fn apply_window_state(window: &WebviewWindow, state: WindowState) {
    if state.maximized {
        let _ = window.maximize();
    } else {
        let _ = window.set_position(PhysicalPosition::new(state.x, state.y));
        let _ = window.set_size(PhysicalSize::new(state.width, state.height));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            app.manage(relay::RelayPool::new());
            let settings = load_tor_settings(&app.handle());

            app.manage(net::NativeNetworkRuntime::new(settings.enable_tor, settings.proxy_url.clone()));
            
            // Manage SessionState
            app.manage(SessionState::new());

            // Manage TorState with loaded settings
            app.manage(TorState { 
                child: Mutex::new(None),
                settings: Mutex::new(settings.clone()),
            });

            // Start Tor if enabled
            if settings.enable_tor {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let _ = start_tor(handle.clone(), handle.state()).await;
                });
            }

            // Create main window with proxy if enabled
            let mut window_builder = tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()));

            #[cfg(desktop)]
            {
                window_builder = window_builder
                    .title("Obscur")
                    .inner_size(1200.0, 800.0)
                    .min_inner_size(800.0, 600.0)
                    .resizable(true)
                    .visible(false); // Hide initially to apply state
            }

            let _window = window_builder.build().expect("Failed to build main window");
            #[cfg(desktop)]
            {
                let show_i = MenuItem::with_id(app, "show", "Show Obscur", true, None::<&str>)?;
                let hide_i = MenuItem::with_id(app, "hide", "Hide to Tray", true, None::<&str>)?;
                let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&show_i, &hide_i, &quit_i])?;

                let _tray = TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "hide" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.hide();
                            }
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
                            // Prevent the window from closing and hide it instead
                            api.prevent_close();
                            let _ = window_clone.hide();
                            
                            // Save state asynchronously
                            let wh = window_clone.clone();
                            let ah = app_handle.clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = save_window_state(wh, ah).await;
                            });
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
            window_is_maximized,
            window_set_fullscreen,
            window_is_fullscreen,
            save_window_state,
            reset_app_storage,
            show_notification,
            request_notification_permission,
            is_notification_permission_granted,
            get_system_theme,
            upload::nip96_upload,
            upload::nip96_upload_v2,
            relay::connect_relay,
            relay::probe_relay,
            relay::disconnect_relay,
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
            start_tor,
            stop_tor,
            get_tor_status,
            save_tor_settings,
            restart_app,
            init_native_session,
            clear_native_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
