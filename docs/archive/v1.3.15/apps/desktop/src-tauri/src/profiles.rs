use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tokio::sync::Mutex;
use std::fs;

const REGISTRY_FILE: &str = "profiles_registry.json";
const DEFAULT_PROFILE_ID: &str = "default";
const DEFAULT_PROFILE_LABEL: &str = "Default";

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
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
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

fn ensure_window_binding(state: &mut PersistedProfileRegistry, window_label: &str) -> ProfileWindowBinding {
    if let Some(existing) = state.window_bindings.iter().find(|binding| binding.window_label == window_label) {
        return existing.clone();
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
    binding
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

    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let profile_data_dir = app_dir.join("profiles").join(&binding.profile_id);
    std::fs::create_dir_all(&profile_data_dir).map_err(|e| e.to_string())?;

    let builder = WebviewWindowBuilder::new(
        app,
        binding.window_label.clone(),
        WebviewUrl::App("index.html".into()),
    );

    #[cfg(desktop)]
    {
        return builder
            .title(format!("Obscur - {}", binding.profile_label))
            .inner_size(1200.0, 800.0)
            .min_inner_size(800.0, 600.0)
            .resizable(true)
            .decorations(false)
            .shadow(true)
            .data_directory(profile_data_dir)
            .build()
            .map_err(|e| e.to_string());
    }

    #[cfg(mobile)]
    {
        let _ = profile_data_dir;
        builder.build().map_err(|e: tauri::Error| e.to_string())
    }
}

impl DesktopProfileState {
    pub fn new(app: &AppHandle) -> Self {
        // Run migration before loading registry if needed
        let _ = migrate_legacy_webview_data(app);

        Self {
            inner: Arc::new(Mutex::new(load_registry(app))),
        }
    }

    pub async fn snapshot_for_window(&self, app: &AppHandle, window_label: &str) -> Result<ProfileIsolationSnapshot, String> {
        let mut state = self.inner.lock().await;
        let binding = ensure_window_binding(&mut state, window_label);
        persist_registry(app, &state)?;
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
        let binding = ensure_window_binding(&mut state, window_label);
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
        let binding = ensure_window_binding(&mut state, window_label);
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
            current_window: ensure_window_binding(&mut state, window_label),
            profiles: state.profiles.clone(),
            window_bindings: state.window_bindings.clone(),
        })
    }

    pub async fn remove_profile(&self, app: &AppHandle, current_window_label: &str, profile_id: &str) -> Result<ProfileIsolationSnapshot, String> {
        if profile_id == DEFAULT_PROFILE_ID {
            return Err("Default profile cannot be removed.".to_string());
        }
        let mut state = self.inner.lock().await;
        state.profiles.retain(|profile| profile.profile_id != profile_id);
        state.window_bindings.iter_mut().for_each(|binding| {
            if binding.profile_id == profile_id {
                binding.profile_id = DEFAULT_PROFILE_ID.to_string();
                binding.profile_label = DEFAULT_PROFILE_LABEL.to_string();
                binding.launch_mode = ProfileLaunchMode::Existing;
            }
        });
        persist_registry(app, &state)?;
        Ok(ProfileIsolationSnapshot {
            current_window: ensure_window_binding(&mut state, current_window_label),
            profiles: state.profiles.clone(),
            window_bindings: state.window_bindings.clone(),
        })
    }

    pub async fn resolve_window_profile(&self, app: &AppHandle, window_label: &str) -> Result<String, String> {
        let mut state = self.inner.lock().await;
        let binding = ensure_window_binding(&mut state, window_label);
        persist_registry(app, &state)?;
        Ok(binding.profile_id)
    }

    pub async fn reset_startup_window_bindings(&self, app: &AppHandle) -> Result<(), String> {
        let mut state = self.inner.lock().await;
        state.window_bindings.retain(|binding| binding.window_label == "main");
        let main_binding = ensure_window_binding(&mut state, "main");
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

    let copy_dir_recursive = |source: &std::path::Path, destination: &std::path::Path| -> Result<(), String> {
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
    };

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
