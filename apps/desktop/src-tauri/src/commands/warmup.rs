use crate::commands::db::DbState;
use crate::warmup::{run_profile_warmup, warmup_static_shell_readahead, warmup_task_plan};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;
use tauri::{path::BaseDirectory, AppHandle, Emitter, Manager, State};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum WarmupPhase {
    #[allow(dead_code)]
    Idle,
    Running,
    Complete,
    Failed,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WarmupStatusSnapshot {
    pub profile_id: String,
    pub phase: WarmupPhase,
    pub completed_tasks: Vec<String>,
    pub current_task: Option<String>,
    pub completed_count: u32,
    pub total_tasks: u32,
    pub elapsed_ms: u64,
    pub conversation_count: Option<u32>,
    pub group_count: Option<u32>,
    pub tombstone_count: Option<u32>,
    pub relay_checkpoint_count: Option<u32>,
    pub dm_message_head_count: Option<u32>,
    pub group_message_head_count: Option<u32>,
    pub error: Option<String>,
}

struct ProfileWarmupEntry {
    snapshot: WarmupStatusSnapshot,
}

struct WarmupStore {
    entries: HashMap<String, ProfileWarmupEntry>,
    running: HashMap<String, bool>,
}

pub struct DesktopWarmupState {
    store: Mutex<WarmupStore>,
}

impl DesktopWarmupState {
    pub fn new() -> Self {
        Self {
            store: Mutex::new(WarmupStore {
                entries: HashMap::new(),
                running: HashMap::new(),
            }),
        }
    }

    fn with_store<T>(
        &self,
        mutate: impl FnOnce(&mut WarmupStore) -> Result<T, String>,
    ) -> Result<T, String> {
        let mut store = self.store.lock().map_err(|error| error.to_string())?;
        mutate(&mut store)
    }

    fn upsert_snapshot(&self, snapshot: WarmupStatusSnapshot) -> Result<(), String> {
        self.with_store(|store| {
            store.entries.insert(
                snapshot.profile_id.clone(),
                ProfileWarmupEntry {
                    snapshot: snapshot.clone(),
                },
            );
            Ok(())
        })
    }

    fn mark_running(&self, profile_id: &str, running: bool) -> Result<(), String> {
        self.with_store(|store| {
            store.running.insert(profile_id.to_string(), running);
            Ok(())
        })
    }

    fn is_running(&self, profile_id: &str) -> Result<bool, String> {
        self.with_store(|store| Ok(store.running.get(profile_id).copied().unwrap_or(false)))
    }

    fn get_snapshot(&self, profile_id: &str) -> Result<Option<WarmupStatusSnapshot>, String> {
        self.with_store(|store| {
            Ok(store
                .entries
                .get(profile_id)
                .map(|entry| entry.snapshot.clone()))
        })
    }
}

fn build_running_snapshot(profile_id: String, current_task: Option<String>) -> WarmupStatusSnapshot {
    WarmupStatusSnapshot {
        profile_id,
        phase: WarmupPhase::Running,
        completed_tasks: Vec::new(),
        current_task,
        completed_count: 0,
        total_tasks: warmup_task_plan().len() as u32,
        elapsed_ms: 0,
        conversation_count: None,
        group_count: None,
        tombstone_count: None,
        relay_checkpoint_count: None,
        dm_message_head_count: None,
        group_message_head_count: None,
        error: None,
    }
}

fn emit_warmup_progress(app: &AppHandle, snapshot: &WarmupStatusSnapshot) {
    let _ = app.emit("desktop-warmup-progress", snapshot);
}

fn resolve_static_shell_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    let use_packaged_shell = if cfg!(debug_assertions) {
        std::env::var("OBSCUR_DESKTOP_STATIC_DEV")
            .ok()
            .filter(|value| value == "1")
            .is_some()
    } else {
        true
    };
    if !use_packaged_shell {
        return None;
    }
    app.path()
        .resolve("index.html", BaseDirectory::Resource)
        .ok()
}

fn run_warmup_blocking(app: &AppHandle, profile_id: &str) -> WarmupStatusSnapshot {
    let started = Instant::now();
    let total_tasks = warmup_task_plan().len() as u32;
    let mut completed_tasks = Vec::new();
    let db_state = app.state::<DbState>();
    let db = match db_state.db.lock() {
        Ok(db) => db,
        Err(error) => {
            return WarmupStatusSnapshot {
                profile_id: profile_id.to_string(),
                phase: WarmupPhase::Failed,
                completed_tasks,
                current_task: None,
                completed_count: 0,
                total_tasks,
                elapsed_ms: started.elapsed().as_millis() as u64,
                conversation_count: None,
                group_count: None,
                tombstone_count: None,
                relay_checkpoint_count: None,
                dm_message_head_count: None,
                group_message_head_count: None,
                error: Some(format!("database lock failed: {error}")),
            };
        }
    };

    let warmup_result = run_profile_warmup(&db, profile_id, |task_id, completed_count, _| {
        completed_tasks.push(task_id.to_string());
        let snapshot = WarmupStatusSnapshot {
            profile_id: profile_id.to_string(),
            phase: WarmupPhase::Running,
            completed_tasks: completed_tasks.clone(),
            current_task: Some(task_id.to_string()),
            completed_count,
            total_tasks,
            elapsed_ms: started.elapsed().as_millis() as u64,
            conversation_count: None,
            group_count: None,
            tombstone_count: None,
            relay_checkpoint_count: None,
            dm_message_head_count: None,
            group_message_head_count: None,
            error: None,
        };
        if let Some(warmup_state) = app.try_state::<DesktopWarmupState>() {
            let _ = warmup_state.upsert_snapshot(snapshot.clone());
        }
        emit_warmup_progress(app, &snapshot);
    });

    drop(db);

    if let Some(shell_path) = resolve_static_shell_path(app) {
        let _ = warmup_static_shell_readahead(&shell_path);
    }

    let completed_count = completed_tasks.len() as u32;
    match warmup_result {
        Ok(metrics) => WarmupStatusSnapshot {
            profile_id: profile_id.to_string(),
            phase: WarmupPhase::Complete,
            completed_tasks,
            current_task: None,
            completed_count: total_tasks,
            total_tasks,
            elapsed_ms: metrics.elapsed_ms,
            conversation_count: Some(metrics.conversation_count),
            group_count: Some(metrics.group_count),
            tombstone_count: Some(metrics.tombstone_count),
            relay_checkpoint_count: Some(metrics.relay_checkpoint_count),
            dm_message_head_count: Some(metrics.dm_message_head_count),
            group_message_head_count: Some(metrics.group_message_head_count),
            error: None,
        },
        Err(error) => WarmupStatusSnapshot {
            profile_id: profile_id.to_string(),
            phase: WarmupPhase::Failed,
            completed_tasks,
            current_task: None,
            completed_count,
            total_tasks,
            elapsed_ms: started.elapsed().as_millis() as u64,
            conversation_count: None,
            group_count: None,
            tombstone_count: None,
            relay_checkpoint_count: None,
            dm_message_head_count: None,
            group_message_head_count: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
pub async fn desktop_start_warmup(
    app: AppHandle,
    profile_id: String,
    warmup_state: State<'_, DesktopWarmupState>,
) -> Result<WarmupStatusSnapshot, String> {
    let trimmed = profile_id.trim();
    if trimmed.is_empty() {
        return Err("profile_id is required".to_string());
    }
    let profile_id = trimmed.to_string();

    if warmup_state.is_running(&profile_id)? {
        if let Some(snapshot) = warmup_state.get_snapshot(&profile_id)? {
            return Ok(snapshot);
        }
    }

    if let Some(snapshot) = warmup_state.get_snapshot(&profile_id)? {
        if snapshot.phase == WarmupPhase::Complete {
            return Ok(snapshot);
        }
    }

    warmup_state.mark_running(&profile_id, true)?;
    let initial = build_running_snapshot(profile_id.clone(), Some("starting".to_string()));
    warmup_state.upsert_snapshot(initial.clone())?;
    emit_warmup_progress(&app, &initial);

    let app_for_task = app.clone();
    let profile_id_for_task = profile_id.clone();
    let profile_id_for_failure = profile_id_for_task.clone();
    tauri::async_runtime::spawn(async move {
        let app_for_blocking = app_for_task.clone();
        let profile_id_for_blocking = profile_id_for_task.clone();
        let final_snapshot = tauri::async_runtime::spawn_blocking(move || {
            run_warmup_blocking(&app_for_blocking, &profile_id_for_blocking)
        })
        .await
        .map_err(|error| format!("warmup task join failed: {error}"))
        .unwrap_or_else(|error| WarmupStatusSnapshot {
            profile_id: profile_id_for_failure.clone(),
            phase: WarmupPhase::Failed,
            completed_tasks: Vec::new(),
            current_task: None,
            completed_count: 0,
            total_tasks: warmup_task_plan().len() as u32,
            elapsed_ms: 0,
            conversation_count: None,
            group_count: None,
            tombstone_count: None,
            relay_checkpoint_count: None,
            dm_message_head_count: None,
            group_message_head_count: None,
            error: Some(error),
        });

        let warmup_state = app_for_task.state::<DesktopWarmupState>();
        let _ = warmup_state.upsert_snapshot(final_snapshot.clone());
        let _ = warmup_state.mark_running(&profile_id_for_task, false);
        emit_warmup_progress(&app_for_task, &final_snapshot);
    });

    Ok(initial)
}

#[tauri::command]
pub fn desktop_get_warmup_status(
    profile_id: String,
    warmup_state: State<'_, DesktopWarmupState>,
) -> Result<WarmupStatusSnapshot, String> {
    let trimmed = profile_id.trim();
    if trimmed.is_empty() {
        return Err("profile_id is required".to_string());
    }
    warmup_state
        .get_snapshot(trimmed)?
        .ok_or_else(|| "warmup status unavailable".to_string())
}
