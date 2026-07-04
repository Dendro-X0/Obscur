// Profile management commands for multi-profile support

use std::fs;
use tauri::{AppHandle, WebviewWindow};
use crate::active_session_leases::{ActiveSessionLeaseRecord, ActiveSessionLeaseState};
use crate::profiles::{clear_profile_webview_data_directory, DesktopProfileState, ProfileIsolationSnapshot, ProfileSummary};
use crate::session::SessionState;

use crate::data_root::profile_archives_dir;

#[tauri::command]
pub async fn desktop_get_profile_isolation_snapshot(
    app: AppHandle,
    window: WebviewWindow,
    profiles: tauri::State<'_, DesktopProfileState>,
) -> Result<ProfileIsolationSnapshot, String> {
    profiles.snapshot_for_window(&app, window.label()).await
}

#[tauri::command]
pub async fn desktop_list_profiles(
    profiles: tauri::State<'_, DesktopProfileState>,
) -> Result<Vec<ProfileSummary>, String> {
    Ok(profiles.list_profiles().await)
}

#[tauri::command]
pub async fn desktop_create_profile(
    app: AppHandle,
    window: WebviewWindow,
    profiles: tauri::State<'_, DesktopProfileState>,
    label: String,
) -> Result<ProfileIsolationSnapshot, String> {
    profiles.create_profile(&app, &label, window.label()).await
}

#[tauri::command]
pub async fn desktop_rename_profile(
    app: AppHandle,
    window: WebviewWindow,
    profiles: tauri::State<'_, DesktopProfileState>,
    profile_id: String,
    label: String,
) -> Result<ProfileIsolationSnapshot, String> {
    profiles.rename_profile(&app, &profile_id, &label, window.label()).await
}

#[tauri::command]
pub async fn desktop_open_profile_window(
    app: AppHandle,
    profiles: tauri::State<'_, DesktopProfileState>,
    profile_id: String,
) -> Result<(), String> {
    profiles.open_profile_window(&app, &profile_id).await
}

#[tauri::command]
pub async fn desktop_bind_window_profile(
    app: AppHandle,
    window: WebviewWindow,
    profiles: tauri::State<'_, DesktopProfileState>,
    profile_id: String,
) -> Result<ProfileIsolationSnapshot, String> {
    profiles.bind_window_profile(&app, window.label(), &profile_id).await
}

#[tauri::command]
pub async fn desktop_remove_profile(
    app: AppHandle,
    window: WebviewWindow,
    profiles: tauri::State<'_, DesktopProfileState>,
    session: tauri::State<'_, SessionState>,
    profile_id: String,
) -> Result<ProfileIsolationSnapshot, String> {
    profiles.remove_profile(&app, &session, window.label(), &profile_id).await
}

/// Best-effort removal of on-disk WebView storage for a profile slot (settings local reset).
#[tauri::command]
pub async fn desktop_clear_profile_webview_data(
    app: AppHandle,
    profile_id: String,
) -> Result<(), String> {
    let trimmed = profile_id.trim();
    if trimmed.is_empty() {
        return Err("Profile id is required.".to_string());
    }
    clear_profile_webview_data_directory(&app, trimmed);
    Ok(())
}

#[tauri::command]
pub async fn desktop_write_profile_workspace_archive(
    app: AppHandle,
    file_name: String,
    contents: String,
) -> Result<String, String> {
    let sanitized = file_name
        .trim()
        .replace(['\\', '/', ':', '*', '?', '"', '<', '>', '|'], "-");
    if sanitized.is_empty()
        || (!sanitized.ends_with(".obscur-profile.json") && !sanitized.ends_with(".obscur-profile.enc.json"))
    {
        return Err(
            "Profile archive file name must end with .obscur-profile.json or .obscur-profile.enc.json"
                .to_string(),
        );
    }
    let path = profile_archives_dir(&app)?.join(sanitized);
    fs::write(&path, contents).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn desktop_list_profile_workspace_archives(
    app: AppHandle,
) -> Result<Vec<String>, String> {
    let dir = profile_archives_dir(&app)?;
    let mut files: Vec<String> = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file()
            && path
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext.eq_ignore_ascii_case("json"))
                .unwrap_or(false)
        {
            files.push(path.to_string_lossy().to_string());
        }
    }
    files.sort();
    Ok(files)
}

#[tauri::command]
pub async fn desktop_get_profile_archives_folder_path(app: AppHandle) -> Result<String, String> {
    Ok(profile_archives_dir(&app)?.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn desktop_open_profile_archives_folder(app: AppHandle) -> Result<String, String> {
    let dir = profile_archives_dir(&app)?;
    let path = dir.to_string_lossy().to_string();
    crate::data_root::reveal_path_in_file_manager(&path)?;
    Ok(path)
}

#[tauri::command]
pub async fn desktop_list_active_session_leases(
    app: AppHandle,
    leases: tauri::State<'_, ActiveSessionLeaseState>,
) -> Result<Vec<ActiveSessionLeaseRecord>, String> {
    leases.list_active_session_leases(&app)
}

#[tauri::command]
pub async fn desktop_find_active_session_lease(
    app: AppHandle,
    leases: tauri::State<'_, ActiveSessionLeaseState>,
    public_key_hex: String,
    exclude_profile_id: Option<String>,
    exclude_window_label: Option<String>,
) -> Result<Option<ActiveSessionLeaseRecord>, String> {
    leases.find_active_session_lease(
        &app,
        &public_key_hex,
        exclude_profile_id.as_deref(),
        exclude_window_label.as_deref(),
    )
}

#[tauri::command]
pub async fn desktop_claim_active_session_lease(
    app: AppHandle,
    leases: tauri::State<'_, ActiveSessionLeaseState>,
    record: ActiveSessionLeaseRecord,
) -> Result<(), String> {
    leases.claim_active_session_lease(&app, record)
}

#[tauri::command]
pub async fn desktop_touch_active_session_lease(
    app: AppHandle,
    leases: tauri::State<'_, ActiveSessionLeaseState>,
    public_key_hex: String,
    profile_id: String,
) -> Result<(), String> {
    leases.touch_active_session_lease(&app, &public_key_hex, &profile_id)
}

#[tauri::command]
pub async fn desktop_release_active_session_lease(
    app: AppHandle,
    leases: tauri::State<'_, ActiveSessionLeaseState>,
    public_key_hex: String,
    profile_id: String,
) -> Result<(), String> {
    leases.release_active_session_lease(&app, &public_key_hex, &profile_id)
}
