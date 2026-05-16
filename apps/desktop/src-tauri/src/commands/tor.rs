use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
// use std::sync::Mutex;
use crate::models::tor::{TorSettings, TorRuntimeStatus, TorState, TorStatusSnapshot};
use crate::net;

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
    use tokio::net::TcpStream;
    use tokio::time::{timeout, Duration};

    let addr = proxy_url
        .trim_start_matches("socks5h://")
        .trim_start_matches("socks5://");

    let Some((host, port_str)) = (|| {
        let mut parts = addr.split(':');
        let host = parts.next()?;
        let port = parts.next()?;
        Some((host, port.parse::<u16>().ok()?))
    })() else {
        return false;
    };

    let connect_future = TcpStream::connect((host, port_str));
    let Ok(Ok(_stream)) = timeout(Duration::from_secs(5), connect_future).await else {
        return false;
    };

    true
}

async fn refresh_tor_runtime_status_from_proxy(state: &TorState) -> Result<bool, String> {
    let (enabled, proxy_url) = {
        let settings = state.settings.lock().map_err(|e| e.to_string())?;
        (settings.enable_tor, settings.proxy_url.clone())
    };

    if !enabled {
        return Ok(false);
    }

    let is_reachable = probe_tor_proxy(&proxy_url).await;

    let current_status = state
        .runtime_status
        .lock()
        .map(|guard| *guard)
        .unwrap_or(TorRuntimeStatus::Disconnected);

    if is_reachable {
        if current_status != TorRuntimeStatus::Connected {
            let mut status = state.runtime_status.lock().map_err(|e| e.to_string())?;
            *status = TorRuntimeStatus::Connected;
        }
        Ok(true)
    } else {
        if current_status == TorRuntimeStatus::Connected {
            let mut status = state.runtime_status.lock().map_err(|e| e.to_string())?;
            *status = TorRuntimeStatus::Error;
        }
        Ok(false)
    }
}

fn build_tor_status_snapshot(state: &TorState) -> Result<TorStatusSnapshot, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    let runtime_status = state.runtime_status.lock().map_err(|e| e.to_string())?;
    let using_external = state
        .using_external_instance
        .lock()
        .map(|guard| *guard)
        .unwrap_or(false);

    let ready = *runtime_status == TorRuntimeStatus::Connected;

    Ok(TorStatusSnapshot {
        state: *runtime_status,
        configured: settings.enable_tor,
        ready,
        using_external_instance: using_external,
        proxy_url: settings.proxy_url.clone(),
    })
}

fn set_tor_runtime_status(
    app: &AppHandle,
    state: &TorState,
    status: TorRuntimeStatus,
    external: Option<bool>,
) -> Result<(), String> {
    {
        let mut guard = state.runtime_status.lock().map_err(|e| e.to_string())?;
        *guard = status;
    }
    if let Some(ext) = external {
        let mut guard = state
            .using_external_instance
            .lock()
            .map_err(|e| e.to_string())?;
        *guard = ext;
    }
    let _ = app.emit("tor-status", status);
    Ok(())
}

pub fn stop_tor_child(state: &TorState) -> Result<bool, String> {
    let mut child_opt = state.child.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = child_opt.take() {
        let _ = child.write("\n".as_bytes());
        let _ = child.kill();
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn start_tor(
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
pub async fn stop_tor(
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
pub async fn get_tor_status(
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
pub async fn get_tor_logs(state: tauri::State<'_, TorState>) -> Result<Vec<String>, String> {
    let logs = state.logs.lock().map_err(|e| e.to_string())?;
    Ok(logs.clone())
}

#[tauri::command]
pub async fn save_tor_settings(
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

pub fn load_tor_settings(app: &tauri::AppHandle) -> TorSettings {
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
