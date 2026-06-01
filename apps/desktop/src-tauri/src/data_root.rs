use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const DATA_ROOT_POINTER_FILE: &str = "obscur_data_root.json";
pub const WORKSPACE_EXPORTS_DIR: &str = "workspace-exports";
pub const PROFILE_ARCHIVES_DIR: &str = "profile-archives";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObscurDataRootConfig {
    pub version: u8,
    pub default_path: String,
    pub custom_path: Option<String>,
    pub effective_path: String,
    pub requires_restart: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DataRootPointer {
    version: u8,
    custom_path: String,
    updated_at_unix_ms: u64,
}

fn now_unix_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

pub fn default_app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn read_pointer(default_dir: &Path) -> Option<String> {
    let pointer_path = default_dir.join(DATA_ROOT_POINTER_FILE);
    let raw = fs::read_to_string(pointer_path).ok()?;
    let pointer = serde_json::from_str::<DataRootPointer>(&raw).ok()?;
    let trimmed = pointer.custom_path.trim().to_string();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

fn write_pointer(default_dir: &Path, custom_path: Option<&str>) -> Result<(), String> {
    let pointer_path = default_dir.join(DATA_ROOT_POINTER_FILE);
    match custom_path {
        Some(path) if !path.trim().is_empty() => {
            let payload = DataRootPointer {
                version: 1,
                custom_path: path.trim().to_string(),
                updated_at_unix_ms: now_unix_ms(),
            };
            fs::write(
                pointer_path,
                serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?,
            )
            .map_err(|e| e.to_string())?;
        }
        _ => {
            if pointer_path.exists() {
                fs::remove_file(pointer_path).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

fn validate_custom_root(path: &Path) -> Result<(), String> {
    if !path.is_absolute() {
        return Err("Data root must be an absolute path.".to_string());
    }
    fs::create_dir_all(path).map_err(|e| format!("Unable to create data root directory: {e}"))?;
    let probe = path.join(".obscur-write-probe");
    fs::write(&probe, b"ok").map_err(|e| format!("Data root is not writable: {e}"))?;
    let _ = fs::remove_file(probe);
    Ok(())
}

pub fn resolve_effective_data_root(app: &AppHandle) -> Result<PathBuf, String> {
    let default_dir = default_app_data_dir(app)?;
    if let Some(custom) = read_pointer(&default_dir) {
        let custom_path = PathBuf::from(custom);
        if validate_custom_root(&custom_path).is_ok() {
            return Ok(custom_path);
        }
    }
    Ok(default_dir)
}

pub fn workspace_exports_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = resolve_effective_data_root(app)?.join(WORKSPACE_EXPORTS_DIR);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

pub fn profile_archives_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = resolve_effective_data_root(app)?.join(PROFILE_ARCHIVES_DIR);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveLibraryContext {
    pub data_root_path: String,
    pub exports_folder_path: String,
    pub profile_archives_folder_path: String,
    pub scan_roots: Vec<String>,
}

pub fn build_save_library_context(app: &AppHandle) -> Result<SaveLibraryContext, String> {
    let data_root = resolve_effective_data_root(app)?;
    let exports = workspace_exports_dir(app)?;
    let archives = profile_archives_dir(app)?;
    let mut scan_roots = vec![
        exports.to_string_lossy().to_string(),
        archives.to_string_lossy().to_string(),
        data_root.to_string_lossy().to_string(),
    ];
    if let Ok(downloads) = app.path().download_dir() {
        if downloads.is_dir() {
            scan_roots.push(downloads.to_string_lossy().to_string());
        }
    }
    if let Ok(documents) = app.path().document_dir() {
        if documents.is_dir() {
            scan_roots.push(documents.to_string_lossy().to_string());
        }
    }
    scan_roots.sort();
    scan_roots.dedup();
    Ok(SaveLibraryContext {
        data_root_path: data_root.to_string_lossy().to_string(),
        exports_folder_path: exports.to_string_lossy().to_string(),
        profile_archives_folder_path: archives.to_string_lossy().to_string(),
        scan_roots,
    })
}

pub fn read_data_root_config(app: &AppHandle) -> Result<ObscurDataRootConfig, String> {
    let default_dir = default_app_data_dir(app)?;
    let default_path = default_dir.to_string_lossy().to_string();
    let custom_path = read_pointer(&default_dir);
    let effective_path = resolve_effective_data_root(app)?
        .to_string_lossy()
        .to_string();
    Ok(ObscurDataRootConfig {
        version: 1,
        default_path,
        custom_path,
        effective_path,
        requires_restart: false,
    })
}

pub fn set_data_root_config(app: &AppHandle, custom_path: Option<String>) -> Result<ObscurDataRootConfig, String> {
    let default_dir = default_app_data_dir(app)?;
    match custom_path.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
        Some(path) => {
            let custom = PathBuf::from(path);
            validate_custom_root(&custom)?;
            write_pointer(&default_dir, Some(path))?;
        }
        None => write_pointer(&default_dir, None)?,
    }
    let mut config = read_data_root_config(app)?;
    config.requires_restart = true;
    Ok(config)
}

pub fn write_export_file(
    app: &AppHandle,
    file_name: &str,
    contents: &[u8],
) -> Result<String, String> {
    let sanitized = file_name
        .trim()
        .replace(['\\', '/', ':', '*', '?', '"', '<', '>', '|'], "-");
    let allowed = sanitized.ends_with(".obscur-bundle")
        || sanitized.ends_with(".json")
        || sanitized.ends_with(".obscur-profile.json")
        || sanitized.ends_with(".obscur-save.json");
    if sanitized.is_empty() || !allowed {
        return Err(
            "Export file name must end with .json, .obscur-save.json, .obscur-profile.json, or .obscur-bundle"
                .to_string(),
        );
    }
    let path = workspace_exports_dir(app)?.join(sanitized);
    fs::write(&path, contents).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

pub fn reveal_path_in_file_manager(path: &str) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Path is empty".to_string());
    }
    let target = PathBuf::from(trimmed);
    if !target.exists() {
        return Err(format!("Path does not exist: {trimmed}"));
    }

    #[cfg(target_os = "windows")]
    {
        if target.is_file() {
            std::process::Command::new("explorer")
                .arg(format!("/select,{}", target.to_string_lossy()))
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
            std::process::Command::new("explorer")
                .arg(target.as_os_str())
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        if target.is_file() {
            std::process::Command::new("open")
                .arg("-R")
                .arg(&target)
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
            std::process::Command::new("open")
                .arg(&target)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        return Ok(());
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let open_target = if target.is_file() {
            target
                .parent()
                .map(|parent| parent.to_path_buf())
                .unwrap_or(target)
        } else {
            target
        };
        std::process::Command::new("xdg-open")
            .arg(open_target)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}
