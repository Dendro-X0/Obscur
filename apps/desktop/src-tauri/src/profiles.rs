use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tokio::sync::Mutex;
use std::fs;

#[cfg(not(target_os = "android"))]
use crate::native_keychain;
use crate::session::SessionState;
use crate::data_root::{default_app_data_dir, resolve_effective_data_root};

const REGISTRY_FILE: &str = "profiles_registry.json";
const DEFAULT_PROFILE_ID: &str = "default";
const DEFAULT_PROFILE_LABEL: &str = "Default";

/// Clear the profile data directory containing WebView storage (IndexedDB, localStorage, etc.)
/// This is best-effort and logs warnings on failure.
pub fn clear_profile_webview_data_directory(app: &AppHandle, profile_id: &str) {
    let app_dir = match resolve_effective_data_root(app) {
        Ok(dir) => dir,
        Err(e) => {
            eprintln!("[PROFILES] Warning: Failed to get app data dir: {}", e);
            return;
        }
    };
    let profile_data_dir = app_dir.join("profiles").join(profile_id);
    if profile_data_dir.exists() {
        match std::fs::remove_dir_all(&profile_data_dir) {
            Ok(_) => eprintln!("[PROFILES] Cleared data directory for profile {}", profile_id),
            Err(e) => eprintln!("[PROFILES] Warning: Failed to clear data directory for profile {}: {}", profile_id, e),
        }
    }
}

/// Clear all shared WebView storage directories to ensure complete profile isolation.
/// This includes IndexedDB, Service Worker, Cache, etc. that may persist across profiles.
/// This is best-effort and logs warnings on failure.
fn clear_shared_webview_storage(app: &AppHandle) {
    let app_dir = match default_app_data_dir(app) {
        Ok(dir) => dir,
        Err(e) => {
            eprintln!("[PROFILES] Warning: Failed to get app data dir for shared storage cleanup: {}", e);
            return;
        }
    };

    // These directories contain shared WebView data that persists across profile windows
    // Clearing them ensures a "fresh device" experience when creating a new profile
    let shared_dirs_to_clear = [
        "IndexedDB",
        "Service Worker",
        "Cache",
        "Code Cache",
        "GPUCache",
        "EBWebView",
        "WebView2",
        "webview",
    ];

    for dir_name in &shared_dirs_to_clear {
        let path = app_dir.join(dir_name);
        if path.exists() {
            match std::fs::remove_dir_all(&path) {
                Ok(_) => eprintln!("[PROFILES] Cleared shared WebView storage: {}", dir_name),
                Err(e) => eprintln!("[PROFILES] Warning: Failed to clear shared WebView storage {}: {}", dir_name, e),
            }
        }
    }
}

/// Clear the native keychain and in-memory session for a specific profile.
/// This is best-effort and does not fail if the keychain entry doesn't exist.
async fn clear_native_credentials_for_profile(app: &AppHandle, profile_id: &str, session: &SessionState) {
    // Clear profile data directory first (contains WebView IndexedDB, localStorage, etc.)
    clear_profile_webview_data_directory(app, profile_id);

    // Clear in-memory session
    session.clear(Some(profile_id)).await;
    eprintln!("[PROFILES] Cleared session for profile {}", profile_id);

    #[cfg(not(target_os = "android"))]
    match native_keychain::delete_nsec_for_profile(profile_id) {
        Ok(()) => eprintln!("[PROFILES] Cleared keychain for profile {}", profile_id),
        Err(e) => eprintln!("[PROFILES] Warning: Failed to clear keychain for profile {}: {}", profile_id, e),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProfileLaunchMode {
    Existing,
    NewWindow,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileSummary {
    pub profile_id: String,
    pub label: String,
    pub created_at_unix_ms: u64,
    pub last_used_at_unix_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileWindowBinding {
    pub window_label: String,
    pub profile_id: String,
    pub profile_label: String,
    pub launch_mode: ProfileLaunchMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileIsolationSnapshot {
    pub current_window: ProfileWindowBinding,
    pub profiles: Vec<ProfileSummary>,
    pub window_bindings: Vec<ProfileWindowBinding>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PersistedProfileRegistry {
    version: u8,
    profiles: Vec<ProfileSummary>,
    window_bindings: Vec<ProfileWindowBinding>,
}

pub struct DesktopProfileState {
    inner: Arc<Mutex<PersistedProfileRegistry>>,
}

fn now_unix_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn default_registry() -> PersistedProfileRegistry {
    let now = now_unix_ms();
    PersistedProfileRegistry {
        version: 1,
        profiles: vec![ProfileSummary {
            profile_id: DEFAULT_PROFILE_ID.to_string(),
            label: DEFAULT_PROFILE_LABEL.to_string(),
            created_at_unix_ms: now,
            last_used_at_unix_ms: now,
        }],
        window_bindings: vec![ProfileWindowBinding {
            window_label: "main".to_string(),
            profile_id: DEFAULT_PROFILE_ID.to_string(),
            profile_label: DEFAULT_PROFILE_LABEL.to_string(),
            launch_mode: ProfileLaunchMode::Existing,
        }],
    }
}

fn registry_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let app_dir = resolve_effective_data_root(app)?;
    std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    Ok(app_dir.join(REGISTRY_FILE))
}

fn load_registry(app: &AppHandle) -> PersistedProfileRegistry {
    let path = match registry_path(app) {
        Ok(path) => path,
        Err(_) => return default_registry(),
    };
    let raw = match std::fs::read_to_string(path) {
        Ok(raw) => raw,
        Err(_) => return default_registry(),
    };
    serde_json::from_str::<PersistedProfileRegistry>(&raw).unwrap_or_else(|_| default_registry())
}

fn persist_registry(app: &AppHandle, state: &PersistedProfileRegistry) -> Result<(), String> {
    let path = registry_path(app)?;
    let payload = serde_json::to_string(state).map_err(|e| e.to_string())?;
    std::fs::write(path, payload).map_err(|e| e.to_string())
}

fn sanitize_profile_id(input: &str) -> String {
    let normalized = input
        .trim()
        .to_lowercase()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' { ch } else { '-' })
        .collect::<String>();
    if normalized.trim_matches('-').is_empty() {
        format!("profile-{}", now_unix_ms())
    } else {
        normalized.trim_matches('-').to_string()
    }
}

fn ensure_window_binding(state: &mut PersistedProfileRegistry, window_label: &str) -> (ProfileWindowBinding, bool) {
    if let Some(existing) = state.window_bindings.iter().find(|binding| binding.window_label == window_label) {
        return (existing.clone(), false);
    }

    let default_profile = state
        .profiles
        .iter()
        .find(|profile| profile.profile_id == DEFAULT_PROFILE_ID)
        .cloned()
        .unwrap_or_else(|| ProfileSummary {
            profile_id: DEFAULT_PROFILE_ID.to_string(),
            label: DEFAULT_PROFILE_LABEL.to_string(),
            created_at_unix_ms: now_unix_ms(),
            last_used_at_unix_ms: now_unix_ms(),
        });
    if !state.profiles.iter().any(|profile| profile.profile_id == default_profile.profile_id) {
        state.profiles.push(default_profile.clone());
    }

    let binding = ProfileWindowBinding {
        window_label: window_label.to_string(),
        profile_id: default_profile.profile_id,
        profile_label: default_profile.label,
        launch_mode: ProfileLaunchMode::Existing,
    };
    state.window_bindings.push(binding.clone());
    (binding, true)
}

fn copy_dir_recursive(source: &std::path::Path, destination: &std::path::Path) -> Result<(), String> {
    fn copy_recursive_inner(source: &std::path::Path, destination: &std::path::Path) -> Result<(), String> {
        fs::create_dir_all(destination).map_err(|e| e.to_string())?;
        for entry in fs::read_dir(source).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let source_path = entry.path();
            let destination_path = destination.join(entry.file_name());
            if source_path.is_dir() {
                copy_recursive_inner(&source_path, &destination_path)?;
            } else {
                fs::copy(&source_path, &destination_path).map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    }

    copy_recursive_inner(source, destination)
}

fn dir_has_webview_storage(path: &std::path::Path) -> bool {
    [
        "EBWebView",
        "Local Storage",
        "IndexedDB",
        "Session Storage",
        "WebStorage",
    ]
    .iter()
    .any(|name| path.join(name).exists())
}

/// All windows for a profile must share one WebView data directory so localStorage,
/// IndexedDB, and theme prefs survive "Open in New Window".
fn shared_profile_data_dir(app: &AppHandle, profile_id: &str) -> Result<std::path::PathBuf, String> {
    let app_dir = resolve_effective_data_root(app)?;
    let profile_dir = app_dir.join("profiles").join(profile_id);
    fs::create_dir_all(&profile_dir).map_err(|e| e.to_string())?;
    migrate_legacy_per_window_webview_data(&profile_dir)?;
    Ok(profile_dir)
}

fn migrate_legacy_per_window_webview_data(profile_dir: &std::path::Path) -> Result<(), String> {
    if dir_has_webview_storage(profile_dir) {
        return Ok(());
    }

    let windows_dir = profile_dir.join("windows");
    if !windows_dir.exists() {
        return Ok(());
    }

    let mut candidates: Vec<(std::path::PathBuf, u64)> = Vec::new();
    for entry in fs::read_dir(&windows_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_dir() || !dir_has_webview_storage(&path) {
            continue;
        }
        let modified_ms = entry
            .metadata()
            .ok()
            .and_then(|metadata| metadata.modified().ok())
            .and_then(|modified| modified.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis() as u64)
            .unwrap_or(0);
        candidates.push((path, modified_ms));
    }

    if candidates.is_empty() {
        return Ok(());
    }

    candidates.sort_by_key(|(_, modified_ms)| *modified_ms);
    let (source, _) = candidates
        .last()
        .expect("non-empty candidates checked above");
    eprintln!(
        "[PROFILES] Migrating legacy per-window WebView data from {:?} into shared profile dir {:?}",
        source, profile_dir
    );
    copy_dir_recursive(source, profile_dir)
}

fn escape_js_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn experiment_online_enabled_from_env() -> bool {
    std::env::var("NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE")
        .ok()
        .filter(|value| value == "1")
        .is_some()
        || std::env::var("OBSCUR_EXPERIMENT_ONLINE")
            .ok()
            .filter(|value| value == "1")
            .is_some()
}

pub(crate) fn experiment_shell_boot_prefix() -> &'static str {
    if experiment_online_enabled_from_env() {
        "window.__OBSCUR_EXPERIMENT_SHELL=true;window.__OBSCUR_EXPERIMENT_ONLINE=true;"
    } else {
        ""
    }
}

fn window_boot_init_script(window_label: &str, profile_id: &str) -> String {
    format!(
        r#"{}{}"#,
        experiment_shell_boot_prefix(),
        format!(
            r#"window.__OBSCUR_WINDOW_BOOT__={{windowLabel:"{}",profileId:"{}"}};"#,
            escape_js_string(window_label),
            escape_js_string(profile_id),
        ),
    )
}

#[cfg_attr(not(debug_assertions), allow(unused_variables))]
pub(crate) fn resolve_profile_window_url(app: &AppHandle) -> WebviewUrl {
    #[cfg(debug_assertions)]
    {
        // v2 slim default dev: static out/ (prod-like). Live Next dev: pnpm dev:desktop:live
        if std::env::var("OBSCUR_DESKTOP_STATIC_DEV")
            .ok()
            .filter(|value| value == "1")
            .is_some()
        {
            return WebviewUrl::App("index.html".into());
        }
        if let Some(dev_url) = app.config().build.dev_url.clone() {
            return WebviewUrl::External(dev_url);
        }
    }
    WebviewUrl::App("index.html".into())
}

fn build_profile_window(app: &AppHandle, binding: &ProfileWindowBinding) -> Result<WebviewWindow, String> {
    if let Some(existing) = app.get_webview_window(&binding.window_label) {
        #[cfg(desktop)]
        {
            let _ = existing.unminimize();
            let _ = existing.show();
            let _ = existing.set_focus();
        }
        return Ok(existing);
    }

    let window_data_dir = shared_profile_data_dir(app, &binding.profile_id)?;

    let builder = WebviewWindowBuilder::new(
        app,
        binding.window_label.clone(),
        resolve_profile_window_url(app),
    )
    .initialization_script(window_boot_init_script(
        &binding.window_label,
        &binding.profile_id,
    ));

    #[cfg(desktop)]
    {
        let window = builder
            .title(format!("Obscur - {}", binding.profile_label))
            .inner_size(1200.0, 800.0)
            .min_inner_size(800.0, 600.0)
            .resizable(true)
            .decorations(false)
            .shadow(true)
            .visible(false)
            .data_directory(window_data_dir)
            .build()
            .map_err(|e| e.to_string())?;

        let reveal_window = window.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs(45)).await;
            if reveal_window.is_visible().unwrap_or(true) {
                return;
            }
            let _ = reveal_window.unminimize();
            let _ = reveal_window.show();
            let _ = reveal_window.set_focus();
            eprintln!(
                "[PROFILES] Failsafe reveal for window '{}' after frontend did not call window_reveal_current",
                reveal_window.label()
            );
        });

        return Ok(window);
    }

    #[cfg(mobile)]
    {
        let _ = window_data_dir;
        builder.build().map_err(|e: tauri::Error| e.to_string())
    }
}

impl DesktopProfileState {
    pub fn new(app: &AppHandle) -> Self {
        let state = Self {
            inner: Arc::new(Mutex::new(load_registry(app))),
        };

        // Legacy WebView migration can copy large directories — never block window creation.
        let migration_app = app.clone();
        tauri::async_runtime::spawn(async move {
            let migration_result = tauri::async_runtime::spawn_blocking(move || {
                migrate_legacy_webview_data(&migration_app)
            })
            .await;
            if let Err(error) = migration_result {
                eprintln!("[PROFILES] Legacy WebView migration task failed: {error}");
            }
        });

        state
    }

    pub async fn snapshot_for_window(&self, app: &AppHandle, window_label: &str) -> Result<ProfileIsolationSnapshot, String> {
        let mut state = self.inner.lock().await;
        let (binding, registry_changed) = ensure_window_binding(&mut state, window_label);
        if registry_changed {
            persist_registry(app, &state)?;
        }
        Ok(ProfileIsolationSnapshot {
            current_window: binding,
            profiles: state.profiles.clone(),
            window_bindings: state.window_bindings.clone(),
        })
    }

    pub async fn list_profiles(&self) -> Vec<ProfileSummary> {
        self.inner.lock().await.profiles.clone()
    }

    pub async fn create_profile(&self, app: &AppHandle, label: &str, window_label: &str) -> Result<ProfileIsolationSnapshot, String> {
        let trimmed = label.trim();
        if trimmed.is_empty() {
            return Err("Profile label is required.".to_string());
        }
        let mut state = self.inner.lock().await;
        let base = sanitize_profile_id(trimmed);
        let mut profile_id = base.clone();
        let mut suffix = 1;
        while state.profiles.iter().any(|profile| profile.profile_id == profile_id) {
            profile_id = format!("{base}-{suffix}");
            suffix += 1;
        }
        let now = now_unix_ms();
        state.profiles.push(ProfileSummary {
            profile_id,
            label: trimmed.to_string(),
            created_at_unix_ms: now,
            last_used_at_unix_ms: now,
        });
        let (binding, _) = ensure_window_binding(&mut state, window_label);
        persist_registry(app, &state)?;
        Ok(ProfileIsolationSnapshot {
            current_window: binding,
            profiles: state.profiles.clone(),
            window_bindings: state.window_bindings.clone(),
        })
    }

    pub async fn rename_profile(&self, app: &AppHandle, profile_id: &str, label: &str, window_label: &str) -> Result<ProfileIsolationSnapshot, String> {
        let trimmed = label.trim();
        if trimmed.is_empty() {
            return Err("Profile label is required.".to_string());
        }
        let mut state = self.inner.lock().await;
        let profile = state
            .profiles
            .iter_mut()
            .find(|profile| profile.profile_id == profile_id)
            .ok_or_else(|| "Profile not found.".to_string())?;
        profile.label = trimmed.to_string();
        state.window_bindings.iter_mut().for_each(|binding| {
            if binding.profile_id == profile_id {
                binding.profile_label = trimmed.to_string();
            }
        });
        let (binding, _) = ensure_window_binding(&mut state, window_label);
        persist_registry(app, &state)?;
        Ok(ProfileIsolationSnapshot {
            current_window: binding,
            profiles: state.profiles.clone(),
            window_bindings: state.window_bindings.clone(),
        })
    }

    pub async fn bind_window_profile(&self, app: &AppHandle, window_label: &str, profile_id: &str) -> Result<ProfileIsolationSnapshot, String> {
        let mut state = self.inner.lock().await;
        let profile = state
            .profiles
            .iter_mut()
            .find(|profile| profile.profile_id == profile_id)
            .ok_or_else(|| "Profile not found.".to_string())?;
        profile.last_used_at_unix_ms = now_unix_ms();
        let bound_profile_id = profile.profile_id.clone();
        let bound_profile_label = profile.label.clone();
        if let Some(binding) = state.window_bindings.iter_mut().find(|binding| binding.window_label == window_label) {
            binding.profile_id = bound_profile_id.clone();
            binding.profile_label = bound_profile_label.clone();
            binding.launch_mode = ProfileLaunchMode::Existing;
        } else {
            state.window_bindings.push(ProfileWindowBinding {
                window_label: window_label.to_string(),
                profile_id: bound_profile_id,
                profile_label: bound_profile_label,
                launch_mode: ProfileLaunchMode::Existing,
            });
        }
        persist_registry(app, &state)?;
        Ok(ProfileIsolationSnapshot {
            current_window: {
                let (binding, _) = ensure_window_binding(&mut state, window_label);
                binding
            },
            profiles: state.profiles.clone(),
            window_bindings: state.window_bindings.clone(),
        })
    }

    pub async fn remove_profile(&self, app: &AppHandle, session: &SessionState, current_window_label: &str, profile_id: &str) -> Result<ProfileIsolationSnapshot, String> {
        if profile_id == DEFAULT_PROFILE_ID {
            return Err("Default profile cannot be removed.".to_string());
        }
        
        // Close all windows associated with the profile being removed to release file locks
        // This must happen BEFORE clearing data directories
        let windows_to_close: Vec<String> = {
            let state = self.inner.lock().await;
            state.window_bindings
                .iter()
                .filter(|binding| binding.profile_id == profile_id)
                .map(|binding| binding.window_label.clone())
                .collect()
        };
        
        // Window closing is only needed on desktop platforms to release file locks
        #[cfg(desktop)]
        {
            for window_label in &windows_to_close {
                if let Some(window) = app.get_webview_window(window_label) {
                    eprintln!("[PROFILES] Closing window {} for deleted profile {}", window_label, profile_id);
                    let _ = window.close();
                }
            }
            
            // Give windows a moment to close and release file locks
            if !windows_to_close.is_empty() {
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            }
        }
        
        let mut state = self.inner.lock().await;
        
        // Remove the profile from the registry
        let removed_profile = state.profiles.iter().find(|p| p.profile_id == profile_id).cloned();
        state.profiles.retain(|profile| profile.profile_id != profile_id);
        
        // COMPLETELY REMOVE window bindings for the deleted profile rather than rebinding them
        // This ensures no stale bindings remain that could cause confusion
        let removed_bindings: Vec<ProfileWindowBinding> = state.window_bindings
            .iter()
            .filter(|binding| binding.profile_id == profile_id)
            .cloned()
            .collect();
        state.window_bindings.retain(|binding| binding.profile_id != profile_id);
        
        eprintln!("[PROFILES] Removed {} window bindings for deleted profile {}", removed_bindings.len(), profile_id);
        
        persist_registry(app, &state)?;
        
        // Log removed profile details for diagnostics
        if let Some(profile) = removed_profile {
            eprintln!("[PROFILES] Removed profile '{}' (ID: {}) from registry", profile.label, profile_id);
        }
        
        // Clear in-memory session, native keychain, profile data directory, AND shared WebView storage
        // for the removed profile to prevent auto-login and ensure complete isolation
        // Drop the lock before async cleanup
        drop(state);
        
        // Clear credentials and data
        clear_native_credentials_for_profile(app, profile_id, session).await;
        
        // Clear shared WebView storage (IndexedDB, Service Worker, etc.) to ensure
        // a "fresh device" experience when creating a new profile window
        clear_shared_webview_storage(app);
        
        eprintln!("[PROFILES] Profile {} removal complete. Windows closed: {}", profile_id, windows_to_close.len());
        
        // Re-acquire lock to return updated snapshot
        let mut state = self.inner.lock().await;
        let (current_window, _) = ensure_window_binding(&mut state, current_window_label);
        Ok(ProfileIsolationSnapshot {
            current_window,
            profiles: state.profiles.clone(),
            window_bindings: state.window_bindings.clone(),
        })
    }

    pub async fn resolve_window_profile(&self, app: &AppHandle, window_label: &str) -> Result<String, String> {
        let mut state = self.inner.lock().await;
        let (binding, registry_changed) = ensure_window_binding(&mut state, window_label);
        if registry_changed {
            persist_registry(app, &state)?;
        }
        Ok(binding.profile_id)
    }

    pub async fn reset_startup_window_bindings(&self, app: &AppHandle) -> Result<(), String> {
        let mut state = self.inner.lock().await;
        state.window_bindings.retain(|binding| binding.window_label == "main");
        let (main_binding, _) = ensure_window_binding(&mut state, "main");
        state.window_bindings.retain(|binding| binding.window_label == "main");
        if let Some(existing) = state
            .window_bindings
            .iter_mut()
            .find(|binding| binding.window_label == "main")
        {
            existing.profile_id = main_binding.profile_id;
            existing.profile_label = main_binding.profile_label;
            existing.launch_mode = ProfileLaunchMode::Existing;
        }
        persist_registry(app, &state)?;
        Ok(())
    }

    pub async fn open_profile_window(&self, app: &AppHandle, profile_id: &str) -> Result<(), String> {
        let mut state = self.inner.lock().await;
        let profile = state
            .profiles
            .iter()
            .find(|profile| profile.profile_id == profile_id)
            .cloned()
            .ok_or_else(|| "Profile not found.".to_string())?;
        let binding = ProfileWindowBinding {
            window_label: format!("profile-{}-{}", profile.profile_id, now_unix_ms()),
            profile_id: profile.profile_id,
            profile_label: profile.label,
            launch_mode: ProfileLaunchMode::NewWindow,
        };
        state.window_bindings.push(binding.clone());
        persist_registry(app, &state)?;
        drop(state);
        build_profile_window(app, &binding).map(|_| ())
    }
}

pub async fn resolve_profile_for_window(
    app: &AppHandle,
    profiles: &tauri::State<'_, DesktopProfileState>,
    window: &WebviewWindow,
) -> Result<String, String> {
    profiles.resolve_window_profile(app, window.label()).await
}

fn migrate_legacy_webview_data(app: &AppHandle) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let local_dir = app.path().local_data_dir().map_err(|e| e.to_string())?;
    let default_profile_dir = app_data_dir.join("profiles").join(DEFAULT_PROFILE_ID);
    let target_eb_webview = default_profile_dir.join("EBWebView");

    if target_eb_webview.exists() && fs::read_dir(&target_eb_webview).map(|mut entries| entries.next().is_some()).unwrap_or(false) {
        return Ok(());
    }

    let candidate_sources = [
        local_dir.join("app.obscur.desktop").join("EBWebView"),
        local_dir.join("app.obscur.desktop").join("WebView2"),
        local_dir.join("app.obscur.desktop").join("webview"),
        app_data_dir.join("EBWebView"),
        app_data_dir.join("WebView2"),
        app_data_dir.join("webview"),
    ];

    let _ = fs::create_dir_all(&default_profile_dir);

    for source_dir in candidate_sources {
        if !source_dir.exists() {
            continue;
        }

        println!(
            "[ProfileIsolation] Attempting legacy WebView migration from {:?} to {:?}",
            source_dir, target_eb_webview
        );

        if fs::rename(&source_dir, &target_eb_webview).is_ok() {
            println!("[ProfileIsolation] Migration completed successfully via move.");
            return Ok(());
        }

        if target_eb_webview.exists() {
            let _ = fs::remove_dir_all(&target_eb_webview);
        }

        if copy_dir_recursive(&source_dir, &target_eb_webview).is_ok() {
            let _ = fs::remove_dir_all(&source_dir);
            println!("[ProfileIsolation] Migration completed successfully via copy fallback.");
            return Ok(());
        }

        eprintln!(
            "[ProfileIsolation] Migration attempt failed for source {:?}; trying next candidate.",
            source_dir
        );
    }

    Ok(())
}
