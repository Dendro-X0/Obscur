// Profile management commands for multi-profile support

use tauri::{AppHandle, WebviewWindow};
use crate::profiles::{DesktopProfileState, ProfileIsolationSnapshot, ProfileSummary};
use crate::session::SessionState;

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
