use tauri::AppHandle;
use crate::data_root::{
    build_save_library_context,
    read_data_root_config,
    reveal_path_in_file_manager,
    set_data_root_config,
    workspace_exports_dir,
    write_export_file,
    ObscurDataRootConfig,
    SaveLibraryContext,
};

#[tauri::command]
pub async fn desktop_get_obscur_data_root_config(app: AppHandle) -> Result<ObscurDataRootConfig, String> {
    read_data_root_config(&app)
}

#[tauri::command]
pub async fn desktop_set_obscur_data_root(
    app: AppHandle,
    custom_path: Option<String>,
) -> Result<ObscurDataRootConfig, String> {
    set_data_root_config(&app, custom_path)
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
