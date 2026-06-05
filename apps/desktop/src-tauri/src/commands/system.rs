//! System and utility commands

use serde_json::json;
use serde_json::Value;
use tauri::{AppHandle, Manager, WebviewWindow};
use crate::models::app::ResetAppStorageReport;
use crate::update_channel;

/// Fetch remote text (manifests on raw.githubusercontent.com, etc.) without webview CORS limits.
#[tauri::command]
pub async fn fetch_remote_text(url: String) -> Result<String, String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err("URL is empty".to_string());
    }
    if !trimmed.starts_with("https://") {
        return Err("Only https:// URLs are allowed".to_string());
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {error}"))?;
    let response = client
        .get(trimmed)
        .header(reqwest::header::ACCEPT, "application/json, text/plain, */*")
        .send()
        .await
        .map_err(|error| format!("Failed to fetch remote text: {error}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "Remote fetch failed with status {}",
            response.status().as_u16()
        ));
    }
    response
        .text()
        .await
        .map_err(|error| format!("Failed to read remote response: {error}"))
}

/// Check for available updates (repo stable channel feed, in-app — no installer dialog).
#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<String, String> {
    match update_channel::build_updater(&app) {
        Ok(updater) => match updater.check().await {
            Ok(Some(update)) => {
                let version = update.version.clone();
                Ok(format!("Update available: {}", version))
            }
            Ok(None) => Ok("No updates available".to_string()),
            Err(e) => Err(format!("Failed to check for updates: {}", e)),
        },
        Err(e) => Err(e),
    }
}

/// Download and install update in-process (Tauri updater; `dialog: false` in config).
#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    match update_channel::build_updater(&app) {
        Ok(updater) => match updater.check().await {
            Ok(Some(update)) => match update.download_and_install(|_, _| {}, || {}).await {
                Ok(_) => Ok(()),
                Err(e) => Err(format!("Failed to install update: {}", e)),
            },
            Ok(None) => Err("No updates available".to_string()),
            Err(e) => Err(format!("Failed to check for updates: {}", e)),
        },
        Err(e) => Err(e),
    }
}

/// Get system theme preference
#[tauri::command]
pub async fn get_system_theme() -> Result<String, String> {
    #[cfg(desktop)]
    {
        // Use dark-light crate or tauri API
        // For now return a default
        Ok("dark".to_string())
    }
    #[cfg(mobile)]
    {
        Ok("dark".to_string())
    }
}

/// Request biometric authentication (mobile primarily)
#[tauri::command]
pub async fn request_biometric_auth() -> Result<bool, String> {
    #[cfg(mobile)]
    {
        // Would use tauri-plugin-biometric
        Ok(false)
    }
    #[cfg(not(mobile))]
    {
        Ok(false)
    }
}

/// Mine proof-of-work (stub for compatibility)
#[tauri::command]
pub async fn mine_pow(difficulty: u8, data: String) -> Result<Value, String> {
    // This would be implemented with actual PoW mining
    // For now return a stub response
    Ok(json!({
        "nonce": 0,
        "hash": "stub",
        "difficulty": difficulty,
        "data": data
    }))
}

/// Register push token (stub for compatibility)
#[tauri::command]
pub async fn register_push_token(
    _app: AppHandle,
    pubkey: String,
    token: String,
) -> Result<(), String> {
    eprintln!("[PUSH] Registering push token for {}: {}", pubkey, token);
    Ok(())
}

/// Restart the application
#[tauri::command]
pub fn restart_app(app: AppHandle) {
    app.restart();
}

/// Reset application storage
#[tauri::command]
pub async fn reset_app_storage(
    window: WebviewWindow,
    app: AppHandle,
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

/// Open storage path in system file manager
#[tauri::command]
pub async fn desktop_open_storage_path(path: String) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Storage path is empty".to_string());
    }

    #[cfg(desktop)]
    {
        let target = std::path::PathBuf::from(trimmed);
        let parent = if target.is_file() {
            target.parent().map(|p| p.to_path_buf())
        } else {
            Some(target)
        };
        if let Some(dir) = parent {
            let _ = std::process::Command::new("explorer")
                .arg("/select,")
                .arg(&dir)
                .spawn();
        }
    }
    Ok(())
}
