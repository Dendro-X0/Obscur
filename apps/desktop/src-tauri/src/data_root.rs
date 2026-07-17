use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use crate::data_root_bind::{
    self, AnchorPrepareMode, InstallBindOutcome, StorageBindMode,
};

const DATA_ROOT_POINTER_FILE: &str = "obscur_data_root.json";
const CUSTOM_ROOT_POINTER_FILE: &str = "obscur_data_root.pointer.json";
const DATA_ROOT_SUPERSEDED_MARKER: &str = ".obscur-data-root-superseded.json";
const DATA_ROOT_ENV_VAR: &str = "OBSCUR_DATA_ROOT";
const PORTABLE_SIDECAR_FILE: &str = "obscur-data-root.path";
#[cfg(not(windows))]
const XDG_POINTER_RELATIVE: &str = ".config/obscur/desktop/custom-data-root.json";
pub const DATA_ROOT_MANIFEST_FILE: &str = "obscur.json";
pub const WORKSPACE_EXPORTS_DIR: &str = "workspace-exports";
pub const PROFILE_ARCHIVES_DIR: &str = "profile-archives";
pub const VAULT_MEDIA_DIR: &str = "vault-media";
pub const PROFILE_VAULT_SUBDIR: &str = "vault";

const MIGRATABLE_ROOT_FILES: &[&str] = &[
    "profiles_registry.json",
    DATA_ROOT_MANIFEST_FILE,
];

const SQLITE_BUNDLE_FILES: &[&str] = &[
    "obscur.sqlite3",
    "obscur.sqlite3-wal",
    "obscur.sqlite3-shm",
    "obscur.sqlite3.obscur-enc",
];

const MIGRATABLE_ROOT_DIRS: &[&str] = &[
    "profiles",
    WORKSPACE_EXPORTS_DIR,
    PROFILE_ARCHIVES_DIR,
    VAULT_MEDIA_DIR,
    "auth-assistant",
];

pub const DATA_ROOT_MIGRATION_PROGRESS_EVENT: &str = "obscur-data-root-migration-progress";
const DATA_ROOT_HEALTH_PROBE_TIMEOUT_MS: u64 = 4_000;
/// Writable sibling of the install anchor when the bound physical root is unreachable.
pub const RECOVERY_WEBVIEW_DIR: &str = "obscur-offline-webview";
const DATA_ROOT_SLOW_PROBE_THRESHOLD_MS: u128 = 2_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataRootHealthSnapshot {
    pub available: bool,
    pub slow: bool,
    pub issue: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataRootMigrationProgress {
    pub phase: String,
    pub items_copied: u32,
    pub items_total: u32,
    pub bytes_copied: u64,
    pub bytes_total: u64,
    pub current_item: Option<String>,
}

#[derive(Debug, Clone)]
struct MigrationFilePlan {
    source: PathBuf,
    destination: PathBuf,
    bytes: u64,
}

struct MigrationProgressReporter<'a> {
    app: Option<&'a AppHandle>,
    phase: String,
    items_total: u32,
    items_copied: u32,
    bytes_total: u64,
    bytes_copied: u64,
    last_emit: Option<Instant>,
}

impl<'a> MigrationProgressReporter<'a> {
    fn new(app: Option<&'a AppHandle>) -> Self {
        Self {
            app,
            phase: "preparing".to_string(),
            items_total: 0,
            items_copied: 0,
            bytes_total: 0,
            bytes_copied: 0,
            last_emit: None,
        }
    }

    fn set_phase(&mut self, phase: &str) {
        self.phase = phase.to_string();
        self.emit_now(None);
    }

    fn set_totals(&mut self, items_total: u32, bytes_total: u64) {
        self.items_total = items_total;
        self.bytes_total = bytes_total;
        self.emit_now(None);
    }

    fn file_copied(&mut self, bytes: u64, destination: &Path) {
        self.items_copied += 1;
        self.bytes_copied = self.bytes_copied.saturating_add(bytes);
        let current_item = destination
            .file_name()
            .map(|name| name.to_string_lossy().to_string());
        self.emit_throttled(current_item);
    }

    fn emit_throttled(&mut self, current_item: Option<String>) {
        let now = Instant::now();
        let should_emit = self.last_emit.is_none()
            || self.phase == "complete"
            || self
                .last_emit
                .map(|last| now.duration_since(last).as_millis() >= 100)
                .unwrap_or(true);
        if should_emit {
            self.last_emit = Some(now);
            self.emit_now(current_item);
        }
    }

    fn emit_now(&mut self, current_item: Option<String>) {
        let Some(app) = self.app else {
            return;
        };
        let snapshot = DataRootMigrationProgress {
            phase: self.phase.clone(),
            items_copied: self.items_copied,
            items_total: self.items_total,
            bytes_copied: self.bytes_copied,
            bytes_total: self.bytes_total,
            current_item,
        };
        let _ = app.emit(DATA_ROOT_MIGRATION_PROGRESS_EVENT, &snapshot);
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObscurDataRootConfig {
    pub version: u8,
    pub default_path: String,
    pub custom_path: Option<String>,
    pub effective_path: String,
    pub requires_restart: bool,
    pub exports_path: String,
    pub profile_archives_path: String,
    pub vault_media_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub migration_source_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub migration_destination_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub migration_copied_count: Option<u32>,
    pub can_import_from_default: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recoverable_custom_path: Option<String>,
    pub authority_source: String,
    pub pointer_healed: bool,
    pub app_data_path: String,
    pub storage_mode: String,
    pub physical_path_available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub physical_path_issue: Option<String>,
    pub physical_path_slow: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub migration_skipped_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObscurDataRootChangePlan {
    pub target_path: String,
    pub source_path: String,
    pub anchor_path: String,
    pub target_has_obscur_data: bool,
    pub anchor_has_obscur_data: bool,
    pub anchor_would_be_replaced: bool,
    pub paths_equivalent: bool,
    pub recommended_action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObscurDataRootManifest {
    pub version: u8,
    pub updated_at_unix_ms: u64,
    pub user_data_path: String,
    pub exports_path: String,
    pub profile_archives_path: String,
    pub vault_media_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DataRootPointer {
    version: u8,
    custom_path: String,
    updated_at_unix_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DataRootSupersededMarker {
    version: u8,
    superseded_by: String,
    migrated_at_unix_ms: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DataRootAuthority {
    Environment,
    PortableSidecar,
    AppDataPointer,
    Registry,
    XdgConfig,
    SupersededMarker,
}

impl DataRootAuthority {
    fn as_config_str(self) -> &'static str {
        match self {
            Self::Environment => "environment",
            Self::PortableSidecar => "portable_sidecar",
            Self::AppDataPointer => "appdata_pointer",
            Self::Registry => "registry",
            Self::XdgConfig => "xdg_config",
            Self::SupersededMarker => "superseded_marker",
        }
    }
}

#[derive(Debug, Clone)]
pub struct DataRootMigrationSummary {
    pub source_path: String,
    pub destination_path: String,
    pub copied_count: u32,
    pub skipped_count: u32,
}

fn now_unix_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

pub fn default_app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    if data_root_bind::is_redirect_at_anchor(&dir) {
        // Junction/symlink anchor already exists; create_dir_all returns OS error 183.
        return Ok(dir);
    }
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn read_pointer(default_dir: &Path) -> Option<String> {
    read_pointer_payload(&default_dir.join(DATA_ROOT_POINTER_FILE))
}

fn write_pointer(default_dir: &Path, custom_path: Option<&str>) -> Result<(), String> {
    let pointer_path = default_dir.join(DATA_ROOT_POINTER_FILE);
    match custom_path {
        Some(path) if !path.trim().is_empty() => {
            let trimmed = path.trim().to_string();
            let payload = DataRootPointer {
                version: 1,
                custom_path: trimmed.clone(),
                updated_at_unix_ms: now_unix_ms(),
            };
            fs::write(
                pointer_path,
                serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?,
            )
            .map_err(|e| e.to_string())?;
            write_pointer_backups(&trimmed)?;
        }
        _ => {
            if pointer_path.exists() {
                fs::remove_file(pointer_path).map_err(|e| e.to_string())?;
            }
            clear_pointer_backups()?;
        }
    }
    Ok(())
}

fn read_pointer_payload(path: &Path) -> Option<String> {
    let raw = fs::read_to_string(path).ok()?;
    let pointer = serde_json::from_str::<DataRootPointer>(&raw).ok()?;
    let trimmed = pointer.custom_path.trim().to_string();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

fn write_custom_root_pointer(custom_root: &Path, custom_path: &str) -> Result<(), String> {
    let payload = DataRootPointer {
        version: 1,
        custom_path: custom_path.trim().to_string(),
        updated_at_unix_ms: now_unix_ms(),
    };
    fs::write(
        custom_root.join(CUSTOM_ROOT_POINTER_FILE),
        serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}

#[cfg(windows)]
fn write_registry_pointer(custom_path: &str) -> Result<(), String> {
    use winreg::enums::*;
    use winreg::RegKey;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = hkcu
        .create_subkey(r"Software\Obscur\Desktop")
        .map_err(|e| e.to_string())?;
    key.set_value("CustomDataRootPath", &custom_path.trim().to_string())
        .map_err(|e| e.to_string())
}

#[cfg(not(windows))]
fn write_registry_pointer(_custom_path: &str) -> Result<(), String> {
    Ok(())
}

#[cfg(windows)]
fn read_registry_pointer() -> Option<String> {
    use winreg::enums::*;
    use winreg::RegKey;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key = hkcu.open_subkey(r"Software\Obscur\Desktop").ok()?;
    key.get_value::<String, _>("CustomDataRootPath").ok().and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

#[cfg(not(windows))]
fn read_registry_pointer() -> Option<String> {
    None
}

#[cfg(windows)]
fn clear_registry_pointer() -> Result<(), String> {
    use winreg::enums::*;
    use winreg::RegKey;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(key) = hkcu.open_subkey(r"Software\Obscur\Desktop") {
        let _ = key.delete_value("CustomDataRootPath");
    }
    Ok(())
}

#[cfg(not(windows))]
fn clear_registry_pointer() -> Result<(), String> {
    Ok(())
}

fn write_pointer_backups(custom_path: &str) -> Result<(), String> {
    write_registry_pointer(custom_path)?;
    write_xdg_pointer(custom_path)?;
    let custom_root = PathBuf::from(custom_path);
    if custom_root.is_dir() {
        let _ = write_custom_root_pointer(&custom_root, custom_path);
    }
    Ok(())
}

fn clear_pointer_backups() -> Result<(), String> {
    clear_registry_pointer()?;
    clear_xdg_pointer()
}

fn read_env_pointer() -> Option<String> {
    std::env::var(DATA_ROOT_ENV_VAR).ok().and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn read_portable_sidecar(app: &AppHandle) -> Option<String> {
    let exe_dir = app.path().executable_dir().ok()?;
    let sidecar = exe_dir.join(PORTABLE_SIDECAR_FILE);
    let raw = fs::read_to_string(sidecar).ok()?;
    let trimmed = raw.lines().next()?.trim().to_string();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

#[cfg(any(target_os = "android", target_os = "ios"))]
fn read_portable_sidecar(_app: &AppHandle) -> Option<String> {
    None
}

#[cfg(not(windows))]
fn xdg_pointer_path() -> Option<PathBuf> {
    std::env::var("HOME")
        .ok()
        .map(|home| PathBuf::from(home).join(XDG_POINTER_RELATIVE))
}

#[cfg(not(windows))]
fn read_xdg_pointer() -> Option<String> {
    xdg_pointer_path().and_then(|path| read_pointer_payload(&path))
}

#[cfg(windows)]
fn read_xdg_pointer() -> Option<String> {
    None
}

#[cfg(not(windows))]
fn write_xdg_pointer(custom_path: &str) -> Result<(), String> {
    let path = xdg_pointer_path().ok_or_else(|| "HOME is not set.".to_string())?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let payload = DataRootPointer {
        version: 1,
        custom_path: custom_path.trim().to_string(),
        updated_at_unix_ms: now_unix_ms(),
    };
    fs::write(
        path,
        serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}

#[cfg(windows)]
fn write_xdg_pointer(_custom_path: &str) -> Result<(), String> {
    Ok(())
}

#[cfg(not(windows))]
fn clear_xdg_pointer() -> Result<(), String> {
    if let Some(path) = xdg_pointer_path() {
        if path.is_file() {
            fs::remove_file(path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[cfg(windows)]
fn clear_xdg_pointer() -> Result<(), String> {
    Ok(())
}

fn read_superseded_marker(default_dir: &Path) -> Option<String> {
    let raw = fs::read_to_string(default_dir.join(DATA_ROOT_SUPERSEDED_MARKER)).ok()?;
    let marker = serde_json::from_str::<DataRootSupersededMarker>(&raw).ok()?;
    let trimmed = marker.superseded_by.trim().to_string();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

fn is_resolved_custom_data_root(path: &Path) -> bool {
    if validate_custom_root(path).is_err() {
        return false;
    }
    destination_has_obscur_data(path)
        || path.join(DATA_ROOT_MANIFEST_FILE).is_file()
        || path.join(CUSTOM_ROOT_POINTER_FILE).is_file()
}

fn clear_app_data_pointer(app_data: &Path) {
    let pointer = app_data.join(DATA_ROOT_POINTER_FILE);
    let _ = fs::remove_file(pointer);
}

fn pointer_target_path(app_data: &Path) -> Option<PathBuf> {
    read_pointer(app_data).map(PathBuf::from)
}

/// Where bytes live on disk (redirect target, pointer, or anchor).
fn physical_storage_path(app_data: &Path) -> PathBuf {
    data_root_bind::physical_path_from_anchor(
        app_data,
        pointer_target_path(app_data).as_deref(),
    )
}

fn storage_mode_for(app_data: &Path) -> StorageBindMode {
    data_root_bind::storage_bind_mode_at(app_data, read_pointer(app_data).is_some())
}

/// Drop redirect/pointer bind at the install anchor so bytes can live in a real AppData folder again.
fn clear_data_root_bind(anchor: &Path) -> Result<(), String> {
    if data_root_bind::is_redirect_at_anchor(anchor) {
        data_root_bind::remove_redirect_at_anchor(anchor)?;
        fs::create_dir_all(anchor).map_err(|e| e.to_string())?;
        return Ok(());
    }
    if read_pointer(anchor).is_some() && data_root_bind::anchor_only_has_bind_metadata(anchor) {
        fs::remove_dir_all(anchor).map_err(|e| e.to_string())?;
        fs::create_dir_all(anchor).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn install_data_root_bind(
    app_data: &Path,
    target: &Path,
    replace_anchor: bool,
) -> Result<StorageBindMode, String> {
    validate_custom_root(target)?;
    let prepare_mode = if replace_anchor {
        AnchorPrepareMode::ReplaceForPhysicalRoot
    } else {
        AnchorPrepareMode::Strict
    };
    match data_root_bind::install_data_root_redirect(app_data, target, prepare_mode) {
        Ok(InstallBindOutcome::AlreadyBound) | Ok(InstallBindOutcome::RedirectInstalled) => {
            clear_app_data_pointer(app_data);
            write_pointer_backups(&target.to_string_lossy())?;
            Ok(StorageBindMode::Redirect)
        }
        Err(redirect_error) => {
            let already_pointer = read_pointer(app_data)
                .as_deref()
                .map(|path| {
                    normalize_path_for_compare(Path::new(path))
                        == normalize_path_for_compare(target)
                })
                .unwrap_or(false);
            if !already_pointer {
                eprintln!(
                    "[obscur] data root redirect failed ({}); falling back to pointer bind",
                    redirect_error
                );
            }
            write_pointer(app_data, Some(&target.to_string_lossy()))?;
            Ok(StorageBindMode::Pointer)
        }
    }
}

fn try_heal_data_root(app: &AppHandle, app_data: &Path) -> Result<Option<DataRootAuthority>, String> {
    if data_root_bind::is_redirect_at_anchor(app_data) {
        clear_app_data_pointer(app_data);
        return Ok(None);
    }
    if let Some(path) = read_pointer(app_data) {
        let target = PathBuf::from(&path);
        if is_resolved_custom_data_root(&target) {
            match install_data_root_bind(app_data, &target, true)? {
                StorageBindMode::Redirect => {
                    return Ok(Some(DataRootAuthority::AppDataPointer));
                }
                StorageBindMode::Pointer => return Ok(None),
                StorageBindMode::AppData => {}
            }
        }
        return Ok(None);
    }
    for (path, authority) in heal_target_candidates(app, app_data) {
        let target = PathBuf::from(&path);
        if !is_resolved_custom_data_root(&target) {
            continue;
        }
        if destination_has_obscur_data(app_data) {
            continue;
        }
        match install_data_root_bind(app_data, &target, false)? {
            StorageBindMode::Redirect | StorageBindMode::Pointer => return Ok(Some(authority)),
            StorageBindMode::AppData => {}
        }
    }
    Ok(None)
}

fn read_recoverable_custom_path(app: &AppHandle, app_data: &Path) -> Option<String> {
    if data_root_bind::is_redirect_at_anchor(app_data) || read_pointer(app_data).is_some() {
        return None;
    }
    for (path, _authority) in heal_target_candidates(app, app_data) {
        let target = PathBuf::from(&path);
        if is_resolved_custom_data_root(&target) && !destination_has_obscur_data(app_data) {
            return Some(path);
        }
    }
    None
}

fn heal_target_candidates(app: &AppHandle, app_data: &Path) -> Vec<(String, DataRootAuthority)> {
    let mut candidates: Vec<(String, DataRootAuthority)> = Vec::new();
    if let Some(path) = read_env_pointer() {
        candidates.push((path, DataRootAuthority::Environment));
    }
    if let Some(path) = read_portable_sidecar(app) {
        candidates.push((path, DataRootAuthority::PortableSidecar));
    }
    if let Some(path) = read_pointer(app_data) {
        candidates.push((path, DataRootAuthority::AppDataPointer));
    }
    if let Some(path) = read_registry_pointer() {
        candidates.push((path, DataRootAuthority::Registry));
    }
    if let Some(path) = read_xdg_pointer() {
        candidates.push((path, DataRootAuthority::XdgConfig));
    }
    if let Some(path) = read_superseded_marker(app_data) {
        candidates.push((path, DataRootAuthority::SupersededMarker));
    }
    candidates
}

fn validate_custom_root(path: &Path) -> Result<(), String> {
    if !path.is_absolute() {
        return Err("Data root must be an absolute path.".to_string());
    }
    fs::create_dir_all(path).map_err(map_data_root_io_error)?;
    let probe = path.join(".obscur-write-probe");
    fs::write(&probe, b"ok").map_err(map_data_root_io_error)?;
    let _ = fs::remove_file(probe);
    Ok(())
}

fn is_file_locked_io_error(error: &std::io::Error) -> bool {
    matches!(error.raw_os_error(), Some(32) | Some(33))
}

pub fn map_data_root_io_error(error: std::io::Error) -> String {
    if error.raw_os_error() == Some(3) {
        return format!(
            "The data folder path could not be reached (OS error 3). Reconnect the drive, choose a folder on a local drive, or pick a new empty folder to start fresh. ({})",
            error
        );
    }
    if is_file_locked_io_error(&error) {
        return format!(
            "A file is locked by another process (OS error {}). Quit Obscur completely and close apps using the data folder, then retry.",
            error.raw_os_error().unwrap_or(32)
        );
    }
    let raw = error.to_string();
    let lower = raw.to_ascii_lowercase();
    if lower.contains("access is denied") || error.raw_os_error() == Some(5) {
        return format!(
            "Windows blocked write access to the data folder. Allow obscur_desktop_app.exe in Windows Security → Virus & threat protection → Ransomware protection → Controlled folder access, or choose a folder outside protected locations. ({raw})"
        );
    }
    raw
}

fn is_migration_cache_path(path: &Path) -> bool {
    let normalized = path.to_string_lossy().to_ascii_lowercase();
    normalized.contains("ebwebview")
        || normalized.contains("webview2")
        || normalized.contains("\\webview\\")
        || normalized.contains("/webview/")
        || normalized.contains("gpucache")
        || normalized.contains("shadercache")
        || normalized.contains("code cache")
        || normalized.contains("browsermetrics")
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MigrationCopyOutcome {
    Copied,
    SkippedCache,
}

fn copy_migration_file(source: &Path, destination: &Path) -> Result<MigrationCopyOutcome, String> {
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(map_data_root_io_error)?;
    }
    let mut last_error: Option<std::io::Error> = None;
    for attempt in 0..2 {
        match fs::copy(source, destination) {
            Ok(_) => return Ok(MigrationCopyOutcome::Copied),
            Err(error) if is_file_locked_io_error(&error) && attempt == 0 => {
                last_error = Some(error);
                std::thread::sleep(Duration::from_millis(120));
            }
            Err(error) if is_file_locked_io_error(&error) && is_migration_cache_path(source) => {
                eprintln!(
                    "[obscur] skipping locked browser cache file during migration: {}",
                    source.display()
                );
                return Ok(MigrationCopyOutcome::SkippedCache);
            }
            Err(error) => return Err(map_data_root_io_error(error)),
        }
    }
    Err(map_data_root_io_error(
        last_error.unwrap_or_else(|| std::io::Error::new(std::io::ErrorKind::Other, "copy failed")),
    ))
}

pub fn preflight_data_root_migration(
    source: &Path,
    destination: &Path,
    overwrite_destination: bool,
) -> Result<(), String> {
    if !source.is_dir() {
        return Err(format!(
            "Current data folder does not exist: {}",
            source.to_string_lossy()
        ));
    }
    let source_health = assess_physical_data_root_health(source);
    if !source_health.available {
        return Err(source_health.issue.unwrap_or_else(|| {
            "Source data folder is not readable.".to_string()
        }));
    }
    if paths_overlap(source, destination)? {
        return Err("Source and destination paths overlap.".to_string());
    }
    if destination_has_obscur_data(destination) && !overwrite_destination {
        return Err(format!(
            "Destination already contains Obscur data. Choose an empty folder, reconnect to use it, or confirm overwrite at {}.",
            destination.to_string_lossy()
        ));
    }
    validate_custom_root(destination)?;
    Ok(())
}

pub fn data_root_boot_hint_script(health: &DataRootHealthSnapshot) -> String {
    let issue_json =
        serde_json::to_string(health.issue.as_deref().unwrap_or("")).unwrap_or_else(|_| "\"\"".into());
    format!(
        "window.__obscurDataRootAvailable={};window.__obscurDataRootSlow={};window.__obscurDataRootIssue={issue_json};",
        health.available, health.slow, issue_json = issue_json
    )
}

fn run_path_io_with_timeout<T, F>(timeout_ms: u64, operation: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> T + Send + 'static,
{
    let (sender, receiver) = mpsc::channel();
    std::thread::spawn(move || {
        let _ = sender.send(operation());
    });
    receiver
        .recv_timeout(Duration::from_millis(timeout_ms))
        .map_err(|_| {
            format!(
                "Data folder did not respond within {timeout_ms}ms. The drive may be disconnected, ejected, or extremely slow."
            )
        })
}

fn path_exists_with_timeout(path: &Path, timeout_ms: u64) -> Result<bool, String> {
    let path = path.to_path_buf();
    run_path_io_with_timeout(timeout_ms, move || path.exists())
}

pub fn assess_physical_data_root_health(path: &Path) -> DataRootHealthSnapshot {
    if !path.is_absolute() {
        return DataRootHealthSnapshot {
            available: false,
            slow: false,
            issue: Some("Data root path is not absolute.".to_string()),
        };
    }

    let started = Instant::now();
    match path_exists_with_timeout(path, DATA_ROOT_HEALTH_PROBE_TIMEOUT_MS) {
        Err(issue) => DataRootHealthSnapshot {
            available: false,
            slow: false,
            issue: Some(issue),
        },
        Ok(false) => DataRootHealthSnapshot {
            available: false,
            slow: false,
            issue: Some(format!(
                "Data folder is not reachable at {}. Reconnect the drive or choose another folder in Settings.",
                path.to_string_lossy()
            )),
        },
        Ok(true) => {
            let slow = started.elapsed().as_millis() > DATA_ROOT_SLOW_PROBE_THRESHOLD_MS;
            match validate_custom_root(path) {
                Ok(()) => DataRootHealthSnapshot {
                    available: true,
                    slow,
                    issue: if slow {
                        Some(
                            "This data folder is responding slowly. A local SSD is recommended for daily use."
                                .to_string(),
                        )
                    } else {
                        None
                    },
                },
                Err(issue) => DataRootHealthSnapshot {
                    available: false,
                    slow,
                    issue: Some(issue),
                },
            }
        }
    }
}

pub fn recovery_webview_root(anchor: &Path) -> PathBuf {
    anchor
        .parent()
        .map(|parent| parent.join(RECOVERY_WEBVIEW_DIR))
        .unwrap_or_else(|| std::env::temp_dir().join(RECOVERY_WEBVIEW_DIR))
}

pub fn assess_data_root_bind_health(anchor: &Path) -> DataRootHealthSnapshot {
    let physical = physical_storage_path(anchor);
    let mut health = assess_physical_data_root_health(&physical);
    if health.available {
        return health;
    }
    if data_root_bind::is_redirect_at_anchor(anchor) {
        if let Some(target) = data_root_bind::redirect_target(anchor) {
            health.issue = Some(format!(
                "Data folder is not reachable at {} (bound via {}). Reconnect the drive or choose another folder in Settings.",
                target.display(),
                anchor.display()
            ));
        }
    } else if let Some(pointer) = read_pointer(anchor) {
        health.issue = Some(format!(
            "Data folder is not reachable at {} (configured in pointer). Reconnect the drive or choose another folder in Settings.",
            pointer
        ));
    }
    health
}

/// WebView profile workspace on a real writable directory — never a broken junction anchor.
pub fn resolve_webview_profile_workspace(
    app: &AppHandle,
    profile_id: &str,
) -> Result<PathBuf, String> {
    let anchor = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let health = assess_data_root_bind_health(&anchor);
    let workspace_root = if health.available {
        physical_storage_path(&anchor)
    } else {
        eprintln!(
            "[obscur] physical data root unavailable ({}); using offline webview workspace at {}",
            health.issue.as_deref().unwrap_or("unknown"),
            recovery_webview_root(&anchor).display()
        );
        recovery_webview_root(&anchor)
    };
    let profile_dir = workspace_root.join("profiles").join(profile_id);
    if let Err(primary_error) = fs::create_dir_all(&profile_dir) {
        if health.available {
            return Err(map_data_root_io_error(primary_error));
        }
        let emergency = std::env::temp_dir()
            .join(RECOVERY_WEBVIEW_DIR)
            .join("profiles")
            .join(profile_id);
        fs::create_dir_all(&emergency).map_err(map_data_root_io_error)?;
        let _ = fs::create_dir_all(emergency.join(PROFILE_VAULT_SUBDIR));
        for category in ["images", "videos", "audio", "files"] {
            let _ = fs::create_dir_all(emergency.join(PROFILE_VAULT_SUBDIR).join(category));
        }
        eprintln!(
            "[obscur] offline webview workspace fell back to {}",
            emergency.display()
        );
        return Ok(emergency);
    }
    let vault_dir = profile_dir.join(PROFILE_VAULT_SUBDIR);
    let _ = fs::create_dir_all(&vault_dir);
    for category in ["images", "videos", "audio", "files"] {
        let _ = fs::create_dir_all(vault_dir.join(category));
    }
    // LES greenfield tree (authoritative replacement for vault runtime).
    let les_dir = profile_dir.join("les");
    let _ = fs::create_dir_all(&les_dir);
    for category in ["images", "videos", "audio", "files"] {
        let _ = fs::create_dir_all(les_dir.join(category));
    }
    Ok(profile_dir)
}

pub fn resolve_effective_data_root(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = default_app_data_dir(app)?;
    let _ = try_heal_data_root(app, &app_data)?;
    Ok(physical_storage_path(&app_data))
}

pub fn bootstrap_data_root_authority(app: &AppHandle) -> Result<(), String> {
    let app_data = default_app_data_dir(app)?;
    if let Ok(Some(authority)) = try_heal_data_root(app, &app_data) {
        let physical = physical_storage_path(&app_data);
        eprintln!(
            "[obscur] data root bind healed authority={} anchor={} physical={} mode={}",
            authority.as_config_str(),
            app_data.display(),
            physical.display(),
            storage_mode_for(&app_data).as_config_str(),
        );
    }
    Ok(())
}

pub fn probe_obscur_data_root(path: &str) -> Result<bool, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Ok(false);
    }
    let custom_path = PathBuf::from(trimmed);
    if validate_custom_root(&custom_path).is_err() {
        return Ok(false);
    }
    Ok(is_resolved_custom_data_root(&custom_path))
}

fn anchor_would_be_replaced_for_bind(app_data: &Path, target: &Path) -> bool {
    if data_root_bind::redirect_points_to(app_data, target) {
        return false;
    }
    if !app_data.exists() {
        return false;
    }
    if data_root_bind::is_redirect_at_anchor(app_data) {
        return true;
    }
    destination_has_obscur_data(app_data)
        || data_root_bind::anchor_only_has_bind_metadata(app_data)
        || read_pointer(app_data).is_some()
}

pub fn plan_data_root_change(app: &AppHandle, target_path: &str) -> Result<ObscurDataRootChangePlan, String> {
    let trimmed = target_path.trim();
    if trimmed.is_empty() {
        return Err("Data folder path is empty.".to_string());
    }
    let target = PathBuf::from(trimmed);
    validate_custom_root(&target).map_err(|error| error)?;
    let app_data = default_app_data_dir(app)?;
    let source = physical_storage_path(&app_data);
    let target_has_obscur_data = is_resolved_custom_data_root(&target);
    let anchor_has_obscur_data = !data_root_bind::is_redirect_at_anchor(&app_data)
        && destination_has_obscur_data(&app_data);
    let anchor_would_be_replaced = anchor_would_be_replaced_for_bind(&app_data, &target);
    let paths_equivalent =
        normalize_path_for_compare(&source) == normalize_path_for_compare(&target);
    let recommended_action = if paths_equivalent {
        "already_bound".to_string()
    } else if target_has_obscur_data {
        "reconnect".to_string()
    } else {
        "migrate".to_string()
    };
    Ok(ObscurDataRootChangePlan {
        target_path: target.to_string_lossy().to_string(),
        source_path: source.to_string_lossy().to_string(),
        anchor_path: app_data.to_string_lossy().to_string(),
        target_has_obscur_data,
        anchor_has_obscur_data,
        anchor_would_be_replaced,
        paths_equivalent,
        recommended_action,
    })
}

pub fn reconnect_data_root(app: &AppHandle, custom_path: String) -> Result<ObscurDataRootConfig, String> {
    let trimmed = custom_path.trim();
    if trimmed.is_empty() {
        return Err("Data folder path is empty.".to_string());
    }
    let custom = PathBuf::from(trimmed);
    validate_custom_root(&custom)?;
    if !is_resolved_custom_data_root(&custom) {
        return Err(format!(
            "No Obscur data found at {}. Choose the folder that contains profiles/, obscur.sqlite3, or profiles_registry.json.",
            custom.to_string_lossy()
        ));
    }
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    clear_stale_anchor_bind(&app_data)?;
    install_data_root_bind(&app_data, &custom, true)?;
    build_data_root_config(app, true, None)
}

/// Remove a broken junction/symlink at the install anchor without touching the new physical root.
fn clear_stale_anchor_bind(anchor: &Path) -> Result<(), String> {
    #[cfg(windows)]
    {
        if crate::windows_junction::is_reparse_point(anchor) {
            return crate::windows_junction::remove_junction_link(anchor);
        }
    }
    if data_root_bind::is_redirect_at_anchor(anchor) {
        return data_root_bind::remove_redirect_at_anchor(anchor);
    }
    Ok(())
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

fn build_data_root_config(
    app: &AppHandle,
    requires_restart: bool,
    migration: Option<DataRootMigrationSummary>,
) -> Result<ObscurDataRootConfig, String> {
    let app_data = default_app_data_dir(app)?;
    let default_path = app_data.to_string_lossy().to_string();
    let recoverable_custom_path = read_recoverable_custom_path(app, &app_data);
    let pointer_healed = matches!(try_heal_data_root(app, &app_data), Ok(Some(_)));
    let physical = physical_storage_path(&app_data);
    let mode = storage_mode_for(&app_data);
    let storage_mode = mode.as_config_str().to_string();
    let authority_source = storage_mode.clone();
    let health = assess_physical_data_root_health(&physical);
    let custom_path = if normalize_path_for_compare(&app_data) != normalize_path_for_compare(&physical) {
        Some(physical.to_string_lossy().to_string())
    } else {
        None
    };
    let exports = physical.join(WORKSPACE_EXPORTS_DIR);
    let archives = physical.join(PROFILE_ARCHIVES_DIR);
    let vault = physical.join(VAULT_MEDIA_DIR);
    let can_import_from_default = custom_path.is_some()
        && !data_root_bind::is_redirect_at_anchor(&app_data)
        && read_pointer(&app_data).is_none()
        && destination_has_obscur_data(&app_data);

    if health.available {
        fs::create_dir_all(&exports).map_err(|e| e.to_string())?;
        fs::create_dir_all(&archives).map_err(|e| e.to_string())?;
        fs::create_dir_all(&vault).map_err(|e| e.to_string())?;
        let manifest = ObscurDataRootManifest {
            version: 1,
            updated_at_unix_ms: now_unix_ms(),
            user_data_path: physical.to_string_lossy().to_string(),
            exports_path: exports.to_string_lossy().to_string(),
            profile_archives_path: archives.to_string_lossy().to_string(),
            vault_media_path: vault.to_string_lossy().to_string(),
        };
        fs::write(
            physical.join(DATA_ROOT_MANIFEST_FILE),
            serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(ObscurDataRootConfig {
        version: 1,
        default_path,
        custom_path,
        effective_path: physical.to_string_lossy().to_string(),
        requires_restart,
        exports_path: exports.to_string_lossy().to_string(),
        profile_archives_path: archives.to_string_lossy().to_string(),
        vault_media_path: vault.to_string_lossy().to_string(),
        migration_source_path: migration.as_ref().map(|value| value.source_path.clone()),
        migration_destination_path: migration.as_ref().map(|value| value.destination_path.clone()),
        migration_copied_count: migration.as_ref().map(|value| value.copied_count),
        can_import_from_default,
        recoverable_custom_path,
        authority_source,
        pointer_healed,
        app_data_path: app_data.to_string_lossy().to_string(),
        storage_mode,
        physical_path_available: health.available,
        physical_path_issue: health.issue,
        physical_path_slow: health.slow,
        migration_skipped_count: migration.map(|value| value.skipped_count).filter(|count| *count > 0),
    })
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
        data_root.to_string_lossy().to_string(),
        exports.to_string_lossy().to_string(),
        archives.to_string_lossy().to_string(),
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
    let mut unique_roots: Vec<String> = Vec::new();
    for root in scan_roots {
        let trimmed = root.trim().to_string();
        if trimmed.is_empty() {
            continue;
        }
        if unique_roots.iter().any(|existing| existing == &trimmed) {
            continue;
        }
        unique_roots.push(trimmed);
    }
    Ok(SaveLibraryContext {
        data_root_path: data_root.to_string_lossy().to_string(),
        exports_folder_path: exports.to_string_lossy().to_string(),
        profile_archives_folder_path: archives.to_string_lossy().to_string(),
        scan_roots: unique_roots,
    })
}

pub fn read_data_root_config(app: &AppHandle) -> Result<ObscurDataRootConfig, String> {
    build_data_root_config(app, false, None)
}

fn normalize_path_for_compare(path: &Path) -> PathBuf {
    fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

fn paths_overlap(left: &Path, right: &Path) -> Result<bool, String> {
    let left = normalize_path_for_compare(left);
    let right = normalize_path_for_compare(right);
    Ok(left.starts_with(&right) || right.starts_with(&left))
}

fn destination_has_obscur_data(path: &Path) -> bool {
    if path.join("profiles_registry.json").is_file() {
        return true;
    }
    if path.join("obscur.sqlite3").is_file() {
        return true;
    }
    if path.join("obscur.sqlite3.obscur-enc").is_file() {
        return true;
    }
    let profiles_dir = path.join("profiles");
    if profiles_dir.is_dir() {
        if let Ok(mut entries) = fs::read_dir(&profiles_dir) {
            return entries.next().is_some();
        }
    }
    false
}

fn copy_dir_recursive(source: &Path, destination: &Path, copied: &mut u32) -> Result<(), String> {
    if !source.is_dir() {
        return Ok(());
    }
    fs::create_dir_all(destination).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(source).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        if source_path.is_dir() {
            copy_dir_recursive(&source_path, &destination_path, copied)?;
        } else {
            if let Some(parent) = destination_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::copy(&source_path, &destination_path).map_err(|e| e.to_string())?;
            *copied += 1;
        }
    }
    Ok(())
}

fn write_superseded_marker(source: &Path, destination: &Path) -> Result<(), String> {
    let marker = DataRootSupersededMarker {
        version: 1,
        superseded_by: destination.to_string_lossy().to_string(),
        migrated_at_unix_ms: now_unix_ms(),
    };
    fs::write(
        source.join(DATA_ROOT_SUPERSEDED_MARKER),
        serde_json::to_string_pretty(&marker).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}

fn remove_obscur_root_contents(root: &Path) -> Result<(), String> {
    if !root.is_dir() {
        return Ok(());
    }
    remove_sqlite_bundle(root)?;
    for file_name in MIGRATABLE_ROOT_FILES {
        let path = root.join(file_name);
        if path.is_file() {
            fs::remove_file(&path).map_err(|e| e.to_string())?;
        }
    }
    for dir_name in MIGRATABLE_ROOT_DIRS {
        let path = root.join(dir_name);
        if path.is_dir() {
            fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn ensure_migration_dirs(source: &Path, destination: &Path) -> Result<(), String> {
    if !source.is_dir() {
        return Ok(());
    }
    fs::create_dir_all(destination).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(source).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let source_path = entry.path();
        if source_path.is_dir() {
            ensure_migration_dirs(&source_path, &destination.join(entry.file_name()))?;
        }
    }
    Ok(())
}

fn collect_migration_dir_files(
    source: &Path,
    destination: &Path,
    files: &mut Vec<MigrationFilePlan>,
) {
    if !source.is_dir() {
        return;
    }
    for entry in fs::read_dir(source).into_iter().flatten().flatten() {
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        if source_path.is_dir() {
            collect_migration_dir_files(&source_path, &destination_path, files);
        } else if source_path.is_file() {
            files.push(MigrationFilePlan {
                source: source_path.clone(),
                destination: destination_path,
                bytes: file_byte_len(&source_path),
            });
        }
    }
}

fn collect_migration_files(source: &Path, destination: &Path) -> Vec<MigrationFilePlan> {
    let mut files = Vec::new();
    let source_db = source.join("obscur.sqlite3");
    let source_encrypted = source.join("obscur.sqlite3.obscur-enc");
    if source_db.is_file() || source_encrypted.is_file() {
        for file_name in SQLITE_BUNDLE_FILES {
            let source_path = source.join(file_name);
            if source_path.is_file() {
                files.push(MigrationFilePlan {
                    source: source_path.clone(),
                    destination: destination.join(file_name),
                    bytes: file_byte_len(&source_path),
                });
            }
        }
    }
    for file_name in MIGRATABLE_ROOT_FILES {
        let source_path = source.join(file_name);
        if source_path.is_file() {
            files.push(MigrationFilePlan {
                source: source_path.clone(),
                destination: destination.join(file_name),
                bytes: file_byte_len(&source_path),
            });
        }
    }
    for dir_name in MIGRATABLE_ROOT_DIRS {
        let source_path = source.join(dir_name);
        if source_path.is_dir() {
            collect_migration_dir_files(&source_path, &destination.join(dir_name), &mut files);
        }
    }
    files
}

pub fn migrate_data_root_contents(
    app: Option<&AppHandle>,
    source: &Path,
    destination: &Path,
    overwrite_destination: bool,
) -> Result<DataRootMigrationSummary, String> {
    if !source.is_dir() {
        return Err(format!(
            "Current data folder does not exist: {}",
            source.to_string_lossy()
        ));
    }
    if paths_overlap(source, destination)? {
        return Err("Source and destination paths overlap.".to_string());
    }
    preflight_data_root_migration(source, destination, overwrite_destination)?;
    if destination_has_obscur_data(destination) && overwrite_destination {
        remove_obscur_root_contents(destination)?;
    }

    let mut reporter = MigrationProgressReporter::new(app);
    reporter.set_phase("preparing");

    let files = collect_migration_files(source, destination);
    let items_total = files.len() as u32;
    let bytes_total: u64 = files.iter().map(|file| file.bytes).sum();
    reporter.set_totals(items_total, bytes_total);
    reporter.set_phase("copying");

    fs::create_dir_all(destination).map_err(|e| e.to_string())?;
    for dir_name in MIGRATABLE_ROOT_DIRS {
        let source_path = source.join(dir_name);
        if source_path.is_dir() {
            ensure_migration_dirs(&source_path, &destination.join(dir_name))?;
        }
    }

    if files.is_empty() {
        return Err(format!(
            "No Obscur data found to migrate at {}",
            source.to_string_lossy()
        ));
    }

    let mut copied_count = 0u32;
    let mut skipped_count = 0u32;
    for file in files {
        match copy_migration_file(&file.source, &file.destination)? {
            MigrationCopyOutcome::Copied => {
                copied_count += 1;
                reporter.file_copied(file.bytes, &file.destination);
            }
            MigrationCopyOutcome::SkippedCache => {
                skipped_count += 1;
            }
        }
    }

    reporter.set_phase("complete");

    if copied_count == 0 {
        return Err(format!(
            "No Obscur data found to migrate at {}",
            source.to_string_lossy()
        ));
    }

    let _ = write_superseded_marker(source, destination);

    Ok(DataRootMigrationSummary {
        source_path: source.to_string_lossy().to_string(),
        destination_path: destination.to_string_lossy().to_string(),
        copied_count,
        skipped_count,
    })
}

fn file_byte_len(path: &Path) -> u64 {
    fs::metadata(path).map(|meta| meta.len()).unwrap_or(0)
}

fn sqlite_bundle_byte_len(root: &Path) -> u64 {
    SQLITE_BUNDLE_FILES
        .iter()
        .map(|file_name| file_byte_len(&root.join(file_name)))
        .sum()
}

fn remove_sqlite_bundle(destination: &Path) -> Result<(), String> {
    for file_name in SQLITE_BUNDLE_FILES {
        let path = destination.join(file_name);
        if path.is_file() {
            fs::remove_file(&path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn copy_sqlite_bundle(source: &Path, destination: &Path, copied: &mut u32, replace_if_larger: bool) -> Result<(), String> {
    let source_db = source.join("obscur.sqlite3");
    let source_encrypted = source.join("obscur.sqlite3.obscur-enc");
    if !source_db.is_file() && !source_encrypted.is_file() {
        return Ok(());
    }

    let dest_db = destination.join("obscur.sqlite3");
    let dest_encrypted = destination.join("obscur.sqlite3.obscur-enc");
    let should_copy = if !dest_db.is_file() && !dest_encrypted.is_file() {
        true
    } else if replace_if_larger {
        sqlite_bundle_byte_len(source) > sqlite_bundle_byte_len(destination)
    } else {
        true
    };
    if !should_copy {
        return Ok(());
    }

    remove_sqlite_bundle(destination)?;
    fs::create_dir_all(destination).map_err(|e| e.to_string())?;
    for file_name in SQLITE_BUNDLE_FILES {
        let source_path = source.join(file_name);
        if source_path.is_file() {
            fs::copy(&source_path, destination.join(file_name)).map_err(|e| e.to_string())?;
            *copied += 1;
        }
    }
    Ok(())
}

fn should_copy_for_merge(source: &Path, destination: &Path) -> bool {
    if !destination.exists() {
        return true;
    }
    if !source.is_file() {
        return false;
    }
    file_byte_len(source) > file_byte_len(destination)
}

fn copy_file_for_merge(source: &Path, destination: &Path, copied: &mut u32) -> Result<(), String> {
    if !should_copy_for_merge(source, destination) {
        return Ok(());
    }
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::copy(source, destination).map_err(|e| e.to_string())?;
    *copied += 1;
    Ok(())
}

fn dir_tree_byte_len(path: &Path) -> u64 {
    if path.is_file() {
        return file_byte_len(path);
    }
    if !path.is_dir() {
        return 0;
    }
    let mut total = 0u64;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            total += dir_tree_byte_len(&entry.path());
        }
    }
    total
}

fn merge_profiles_dir(source: &Path, destination: &Path, copied: &mut u32) -> Result<(), String> {
    if !source.is_dir() {
        return Ok(());
    }
    fs::create_dir_all(destination).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(source).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let source_child = entry.path();
        let dest_child = destination.join(entry.file_name());
        if !source_child.is_dir() {
            copy_file_for_merge(&source_child, &dest_child, copied)?;
            continue;
        }
        let source_bytes = dir_tree_byte_len(&source_child);
        let dest_bytes = if dest_child.is_dir() {
            dir_tree_byte_len(&dest_child)
        } else {
            0
        };
        if dest_child.exists() && source_bytes > dest_bytes.saturating_add(1024) {
            if dest_child.is_dir() {
                fs::remove_dir_all(&dest_child).map_err(|e| e.to_string())?;
            } else {
                fs::remove_file(&dest_child).map_err(|e| e.to_string())?;
            }
            copy_dir_recursive(&source_child, &dest_child, copied)?;
        } else if !dest_child.exists() {
            copy_dir_recursive(&source_child, &dest_child, copied)?;
        } else if dest_child.is_dir() {
            merge_dir_recursive(&source_child, &dest_child, copied)?;
        }
    }
    Ok(())
}

fn merge_dir_recursive(source: &Path, destination: &Path, copied: &mut u32) -> Result<(), String> {
    if !source.is_dir() {
        return Ok(());
    }
    fs::create_dir_all(destination).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(source).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        if source_path.is_dir() {
            merge_dir_recursive(&source_path, &destination_path, copied)?;
        } else {
            copy_file_for_merge(&source_path, &destination_path, copied)?;
        }
    }
    Ok(())
}

pub fn merge_data_root_contents(source: &Path, destination: &Path) -> Result<DataRootMigrationSummary, String> {
    if !source.is_dir() {
        return Err(format!(
            "Import source folder does not exist: {}",
            source.to_string_lossy()
        ));
    }
    if paths_overlap(source, destination)? {
        return Err("Import source and destination paths overlap.".to_string());
    }
    validate_custom_root(destination)?;

    let mut copied_count = 0u32;
    copy_sqlite_bundle(source, destination, &mut copied_count, true)?;
    for file_name in MIGRATABLE_ROOT_FILES {
        let source_path = source.join(file_name);
        if source_path.is_file() {
            copy_file_for_merge(&source_path, &destination.join(file_name), &mut copied_count)?;
        }
    }
    for dir_name in MIGRATABLE_ROOT_DIRS {
        let source_path = source.join(dir_name);
        if source_path.is_dir() {
            if *dir_name == "profiles" {
                merge_profiles_dir(&source_path, &destination.join(dir_name), &mut copied_count)?;
            } else {
                merge_dir_recursive(&source_path, &destination.join(dir_name), &mut copied_count)?;
            }
        }
    }

    if copied_count == 0 {
        return Err(format!(
            "No missing or newer Obscur data found to import from {}",
            source.to_string_lossy()
        ));
    }

    Ok(DataRootMigrationSummary {
        source_path: source.to_string_lossy().to_string(),
        destination_path: destination.to_string_lossy().to_string(),
        copied_count,
        skipped_count: 0,
    })
}

pub fn import_data_root_from_default(app: &AppHandle) -> Result<ObscurDataRootConfig, String> {
    let app_data = default_app_data_dir(app)?;
    let physical = physical_storage_path(&app_data);
    if normalize_path_for_compare(&app_data) == normalize_path_for_compare(&physical) {
        return Err("Import is only available while using a custom data folder.".to_string());
    }
    if !destination_has_obscur_data(&app_data) {
        return Err(format!(
            "No Obscur data found at the default app-data folder ({})",
            app_data.to_string_lossy()
        ));
    }
    let migration = merge_data_root_contents(&app_data, &physical)?;
    build_data_root_config(app, true, Some(migration))
}

pub fn set_data_root_config(
    app: &AppHandle,
    custom_path: Option<String>,
    migrate_existing: bool,
    overwrite_destination: bool,
) -> Result<ObscurDataRootConfig, String> {
    let app_data = default_app_data_dir(app)?;

    match custom_path.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
        None => {
            let physical_before = physical_storage_path(&app_data);
            clear_data_root_bind(&app_data)?;
            write_pointer(&app_data, None)?;
            let migration = if migrate_existing
                && normalize_path_for_compare(&physical_before) != normalize_path_for_compare(&app_data)
                && !destination_has_obscur_data(&app_data)
                && destination_has_obscur_data(&physical_before)
            {
                Some(migrate_data_root_contents(Some(app), &physical_before, &app_data, false)?)
            } else {
                None
            };
            build_data_root_config(app, true, migration)
        }
        Some(path) => {
            let dest = PathBuf::from(path);
            validate_custom_root(&dest)?;
            let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
            clear_stale_anchor_bind(&app_data)?;
            let source_root = physical_storage_path(&app_data);
            let source_available = assess_physical_data_root_health(&source_root).available;
            let migration = if migrate_existing
                && source_available
                && normalize_path_for_compare(&source_root) != normalize_path_for_compare(&dest)
                && (!destination_has_obscur_data(&dest) || overwrite_destination)
            {
                Some(migrate_data_root_contents(
                    Some(app),
                    &source_root,
                    &dest,
                    overwrite_destination,
                )?)
            } else {
                if migrate_existing && !source_available {
                    eprintln!(
                        "[obscur] skipping data migration — source folder is unavailable at {}",
                        source_root.display()
                    );
                }
                None
            };
            let replace_anchor = migration.is_some()
                || !source_available
                || data_root_bind::is_redirect_at_anchor(&app_data);
            install_data_root_bind(&app_data, &dest, replace_anchor)?;
            build_data_root_config(app, true, migration)
        }
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn obscur_manifest_serializes_expected_subpaths() {
        let custom = std::env::temp_dir().join(format!(
            "obscur-manifest-test-{}",
            now_unix_ms()
        ));
        fs::create_dir_all(&custom).expect("create custom root");

        let exports = custom.join(WORKSPACE_EXPORTS_DIR);
        let archives = custom.join(PROFILE_ARCHIVES_DIR);
        let vault = custom.join(VAULT_MEDIA_DIR);
        fs::create_dir_all(&exports).expect("exports");
        fs::create_dir_all(&archives).expect("archives");
        fs::create_dir_all(&vault).expect("vault");

        let manifest = ObscurDataRootManifest {
            version: 1,
            updated_at_unix_ms: 1,
            user_data_path: custom.to_string_lossy().to_string(),
            exports_path: exports.to_string_lossy().to_string(),
            profile_archives_path: archives.to_string_lossy().to_string(),
            vault_media_path: vault.to_string_lossy().to_string(),
        };
        let manifest_path = custom.join(DATA_ROOT_MANIFEST_FILE);
        fs::write(
            &manifest_path,
            serde_json::to_string_pretty(&manifest).expect("serialize"),
        )
        .expect("write manifest");

        let raw = fs::read_to_string(manifest_path).expect("read manifest");
        let parsed: ObscurDataRootManifest = serde_json::from_str(&raw).expect("parse manifest");
        assert_eq!(parsed.version, 1);
        assert!(parsed.vault_media_path.ends_with(VAULT_MEDIA_DIR));
        assert!(parsed.exports_path.ends_with(WORKSPACE_EXPORTS_DIR));
        assert!(parsed.profile_archives_path.ends_with(PROFILE_ARCHIVES_DIR));

        let _ = fs::remove_dir_all(custom);
    }

    #[test]
    fn is_resolved_custom_data_root_accepts_manifest_only() {
        let stamp = now_unix_ms();
        let root = std::env::temp_dir().join(format!("obscur-resolved-{stamp}"));
        fs::create_dir_all(&root).expect("dir");
        fs::write(root.join(DATA_ROOT_MANIFEST_FILE), b"{}").expect("manifest");
        assert!(is_resolved_custom_data_root(&root));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn read_superseded_marker_returns_destination() {
        let stamp = now_unix_ms();
        let default_dir = std::env::temp_dir().join(format!("obscur-superseded-{stamp}"));
        fs::create_dir_all(&default_dir).expect("dir");
        let destination = std::env::temp_dir().join(format!("obscur-superseded-dst-{stamp}"));
        write_superseded_marker(&default_dir, &destination).expect("marker");
        assert_eq!(
            read_superseded_marker(&default_dir).as_deref(),
            Some(destination.to_string_lossy().as_ref())
        );
        let _ = fs::remove_dir_all(default_dir);
    }

    #[test]
    fn recovery_webview_root_is_sibling_of_anchor() {
        let anchor = std::path::PathBuf::from(r"C:\Users\test\AppData\Roaming\app.obscur.desktop");
        let recovery = recovery_webview_root(&anchor);
        assert_eq!(
            recovery,
            std::path::PathBuf::from(r"C:\Users\test\AppData\Roaming\obscur-offline-webview")
        );
    }

    #[test]
    fn assess_data_root_bind_health_mentions_redirect_target() {
        let stamp = now_unix_ms();
        let parent = std::env::temp_dir().join(format!("obscur-bind-health-{stamp}"));
        let anchor = parent.join("anchor");
        fs::create_dir_all(&parent).expect("parent");
        let missing_target = std::path::PathBuf::from(format!(r"Z:\obscur-missing-target-{stamp}"));
        #[cfg(windows)]
        {
            std::os::windows::fs::symlink_dir(&missing_target, &anchor).expect("junction");
        }
        #[cfg(not(windows))]
        {
            let target = parent.join("physical");
            fs::create_dir_all(&target).expect("target");
            std::os::unix::fs::symlink(&target, &anchor).expect("symlink");
            let _ = fs::remove_dir_all(&target);
        }
        let health = assess_data_root_bind_health(&anchor);
        assert!(!health.available);
        let issue = health.issue.expect("issue");
        assert!(issue.contains("bound via"));
        #[cfg(windows)]
        {
            assert!(issue.contains(&missing_target.to_string_lossy().to_string()));
        }
        let _ = fs::remove_dir_all(parent);
    }

    #[test]
    fn assess_physical_data_root_health_reports_missing_path() {
        let stamp = now_unix_ms();
        let missing = std::env::temp_dir().join(format!("obscur-missing-root-{stamp}"));
        let health = assess_physical_data_root_health(&missing);
        assert!(!health.available);
        assert!(!health.slow);
        assert!(health.issue.is_some());
    }

    #[test]
    fn is_migration_cache_path_detects_webview_dirs() {
        let path = std::path::PathBuf::from(r"K:\app.obscur.desktop\profiles\default\EBWebView\Default\GPUCache\data_0");
        assert!(is_migration_cache_path(&path));
        let sqlite = std::path::PathBuf::from(r"K:\app.obscur.desktop\obscur.sqlite3");
        assert!(!is_migration_cache_path(&sqlite));
    }

    #[test]
    fn map_data_root_io_error_describes_missing_path() {
        let error = std::io::Error::from_raw_os_error(3);
        let message = map_data_root_io_error(error);
        assert!(message.contains("OS error 3"));
        assert!(message.contains("local drive"));
    }

    #[test]
    fn map_data_root_io_error_describes_access_denied() {
        let error = std::io::Error::from_raw_os_error(5);
        let message = map_data_root_io_error(error);
        assert!(message.contains("Controlled folder access"));
    }

    #[test]
    fn assess_physical_data_root_health_accepts_writable_path() {
        let stamp = now_unix_ms();
        let root = std::env::temp_dir().join(format!("obscur-health-{stamp}"));
        fs::create_dir_all(&root).expect("dir");
        let health = assess_physical_data_root_health(&root);
        assert!(health.available, "{:?}", health.issue);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn migrate_data_root_copies_profiles_and_registry() {
        let stamp = now_unix_ms();
        let source = std::env::temp_dir().join(format!("obscur-migrate-src-{stamp}"));
        let destination = std::env::temp_dir().join(format!("obscur-migrate-dst-{stamp}"));
        fs::create_dir_all(source.join("profiles").join("default")).expect("profile dir");
        fs::write(source.join("profiles_registry.json"), br#"{"version":1,"profiles":[]}"#)
            .expect("registry");
        fs::write(source.join("obscur.sqlite3"), b"sqlite").expect("sqlite");

        let summary = migrate_data_root_contents(None, &source, &destination, false).expect("migrate");
        assert_eq!(summary.copied_count, 2);
        assert!(destination.join("profiles_registry.json").is_file());
        assert!(destination.join("profiles/default").is_dir());
        assert!(source.join(DATA_ROOT_SUPERSEDED_MARKER).is_file());

        let _ = fs::remove_dir_all(source);
        let _ = fs::remove_dir_all(destination);
    }

    #[test]
    fn migrate_data_root_rejects_nonempty_destination() {
        let stamp = now_unix_ms();
        let source = std::env::temp_dir().join(format!("obscur-migrate-src2-{stamp}"));
        let destination = std::env::temp_dir().join(format!("obscur-migrate-dst2-{stamp}"));
        fs::create_dir_all(&source).expect("source");
        fs::write(source.join("profiles_registry.json"), b"{}").expect("registry");
        fs::create_dir_all(&destination).expect("destination");
        fs::write(destination.join("profiles_registry.json"), b"{}").expect("dest registry");

        let error = migrate_data_root_contents(None, &source, &destination, false).expect_err("should fail");
        assert!(error.contains("already contains Obscur data"));

        let _ = fs::remove_dir_all(source);
        let _ = fs::remove_dir_all(destination);
    }

    #[cfg(unix)]
    #[test]
    fn reset_to_default_clears_symlink_before_migrate() {
        let stamp = now_unix_ms();
        let physical = std::env::temp_dir().join(format!("obscur-reset-phys-{stamp}"));
        let anchor = std::env::temp_dir().join(format!("obscur-reset-anchor-{stamp}"));
        fs::create_dir_all(physical.join("profiles").join("default")).expect("profile");
        fs::write(physical.join("profiles_registry.json"), br#"{"version":1,"profiles":[]}"#)
            .expect("registry");
        std::os::unix::fs::symlink(&physical, &anchor).expect("symlink");
        assert!(data_root_bind::is_redirect_at_anchor(&anchor));

        let physical_before = physical_path_from_test_anchor(&anchor);
        clear_data_root_bind(&anchor).expect("clear bind");
        write_pointer(&anchor, None).expect("clear pointer");
        assert!(!data_root_bind::is_redirect_at_anchor(&anchor));
        assert!(anchor.is_dir());
        assert!(!destination_has_obscur_data(&anchor));

        let summary =
            migrate_data_root_contents(None, &physical_before, &anchor, false).expect("migrate back to anchor");
        assert!(summary.copied_count >= 1);
        assert!(anchor.join("profiles_registry.json").is_file());

        let _ = fs::remove_dir_all(physical);
        let _ = fs::remove_dir_all(anchor);
    }

    fn physical_path_from_test_anchor(anchor: &Path) -> PathBuf {
        data_root_bind::physical_path_from_anchor(anchor, read_pointer(anchor).as_deref().map(Path::new))
    }

    #[test]
    fn migrate_data_root_overwrites_destination_when_requested() {
        let stamp = now_unix_ms();
        let source = std::env::temp_dir().join(format!("obscur-overwrite-src-{stamp}"));
        let destination = std::env::temp_dir().join(format!("obscur-overwrite-dst-{stamp}"));
        fs::create_dir_all(source.join("profiles").join("new-profile")).expect("source profile");
        fs::write(source.join("profiles_registry.json"), br#"{"version":1,"profiles":[{"id":"new"}]}"#)
            .expect("source registry");
        fs::create_dir_all(destination.join("profiles").join("old-profile")).expect("dest profile");
        fs::write(destination.join("profiles_registry.json"), br#"{"version":1,"profiles":[{"id":"old"}]}"#)
            .expect("dest registry");

        let summary =
            migrate_data_root_contents(None, &source, &destination, true).expect("overwrite migrate");
        assert!(summary.copied_count >= 1);
        assert!(destination.join("profiles/new-profile").is_dir());
        assert!(!destination.join("profiles/old-profile").exists());

        let _ = fs::remove_dir_all(source);
        let _ = fs::remove_dir_all(destination);
    }

    #[test]
    fn merge_data_root_copies_missing_profiles_and_larger_sqlite() {
        let stamp = now_unix_ms();
        let source = std::env::temp_dir().join(format!("obscur-merge-src-{stamp}"));
        let destination = std::env::temp_dir().join(format!("obscur-merge-dst-{stamp}"));
        fs::create_dir_all(source.join("profiles").join("legacy")).expect("legacy profile");
        fs::create_dir_all(destination.join("profiles").join("default")).expect("new profile");
        fs::write(source.join("profiles_registry.json"), br#"{"version":1,"profiles":[{"id":"legacy"}]}"#)
            .expect("source registry");
        fs::write(destination.join("profiles_registry.json"), br#"{"version":1,"profiles":[]}"#)
            .expect("dest registry");
        fs::write(source.join("obscur.sqlite3"), b"full-sqlite-database").expect("source sqlite");
        fs::write(destination.join("obscur.sqlite3"), b"new").expect("dest sqlite");

        let summary = merge_data_root_contents(&source, &destination).expect("merge");
        assert!(summary.copied_count >= 2);
        assert!(destination.join("profiles/legacy").is_dir());
        assert!(destination.join("obscur.sqlite3").metadata().expect("meta").len() > 3);

        let _ = fs::remove_dir_all(source);
        let _ = fs::remove_dir_all(destination);
    }
}
