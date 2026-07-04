use tauri::{AppHandle, Manager};
use crate::commands::db::{quiesce_sqlite_for_data_root_change, DbState};
use crate::data_root::{
    build_save_library_context,
    import_data_root_from_default,
    plan_data_root_change,
    preflight_data_root_migration,
    probe_obscur_data_root,
    read_data_root_config,
    reconnect_data_root,
    reveal_path_in_file_manager,
    set_data_root_config,
    workspace_exports_dir,
    write_export_file,
    ObscurDataRootConfig,
    ObscurDataRootChangePlan,
    SaveLibraryContext,
};

fn prepare_data_root_file_operations(app: &AppHandle) -> Result<(), String> {
    if let Some(db_state) = app.try_state::<DbState>() {
        quiesce_sqlite_for_data_root_change(&db_state)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn desktop_prepare_data_root_change(app: AppHandle) -> Result<(), String> {
    prepare_data_root_file_operations(&app)
}

#[tauri::command]
pub async fn desktop_get_obscur_data_root_config(app: AppHandle) -> Result<ObscurDataRootConfig, String> {
    read_data_root_config(&app)
}

#[tauri::command]
pub async fn desktop_set_obscur_data_root(
    app: AppHandle,
    custom_path: Option<String>,
    migrate_existing: Option<bool>,
    overwrite_destination: Option<bool>,
) -> Result<ObscurDataRootConfig, String> {
    prepare_data_root_file_operations(&app)?;
    set_data_root_config(
        &app,
        custom_path,
        migrate_existing.unwrap_or(false),
        overwrite_destination.unwrap_or(false),
    )
}

#[tauri::command]
pub async fn desktop_plan_obscur_data_root_change(
    app: AppHandle,
    target_path: String,
) -> Result<ObscurDataRootChangePlan, String> {
    plan_data_root_change(&app, &target_path)
}

#[tauri::command]
pub async fn desktop_preflight_obscur_data_root_migration(
    app: AppHandle,
    target_path: String,
    overwrite_destination: Option<bool>,
) -> Result<(), String> {
    let source = crate::data_root::resolve_effective_data_root(&app)?;
    let destination = std::path::PathBuf::from(target_path.trim());
    preflight_data_root_migration(
        &source,
        &destination,
        overwrite_destination.unwrap_or(false),
    )
}

#[tauri::command]
pub async fn desktop_import_obscur_data_from_default(app: AppHandle) -> Result<ObscurDataRootConfig, String> {
    prepare_data_root_file_operations(&app)?;
    import_data_root_from_default(&app)
}

#[tauri::command]
pub async fn desktop_probe_obscur_data_root(path: String) -> Result<bool, String> {
    probe_obscur_data_root(&path)
}

#[tauri::command]
pub async fn desktop_reconnect_obscur_data_root(
    app: AppHandle,
    custom_path: String,
) -> Result<ObscurDataRootConfig, String> {
    prepare_data_root_file_operations(&app)?;
    reconnect_data_root(&app, custom_path)
}

#[tauri::command]
pub async fn desktop_write_workspace_bundle(
    app: AppHandle,
    file_name: String,
    contents_base64: String,
) -> Result<String, String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(contents_base64.trim())
        .map_err(|e| format!("Invalid bundle payload encoding: {e}"))?;
    write_export_file(&app, &file_name, &bytes)
}

#[tauri::command]
pub async fn desktop_write_data_root_export(
    app: AppHandle,
    file_name: String,
    contents_base64: String,
) -> Result<String, String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(contents_base64.trim())
        .map_err(|e| format!("Invalid export payload encoding: {e}"))?;
    write_export_file(&app, &file_name, &bytes)
}

#[tauri::command]
pub async fn desktop_reveal_path_in_file_manager(path: String) -> Result<(), String> {
    reveal_path_in_file_manager(&path)
}

#[tauri::command]
pub async fn desktop_get_exports_folder_path(app: AppHandle) -> Result<String, String> {
    Ok(workspace_exports_dir(&app)?.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn desktop_open_exports_folder(app: AppHandle) -> Result<String, String> {
    let dir = workspace_exports_dir(&app)?;
    let path = dir.to_string_lossy().to_string();
    reveal_path_in_file_manager(&path)?;
    Ok(path)
}

#[tauri::command]
pub async fn desktop_get_save_library_context(app: AppHandle) -> Result<SaveLibraryContext, String> {
    build_save_library_context(&app)
}
