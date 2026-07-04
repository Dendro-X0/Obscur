use tauri::AppHandle;
use std::path::PathBuf;

use crate::data_root::{default_app_data_dir, resolve_effective_data_root};
use crate::profile_web_storage_harvest::{
    harvest_profile_web_storage_from_roots, ProfileWebStorageHarvestResult,
};

fn collect_harvest_roots(app: &AppHandle, include_default_app_data: bool) -> Result<Vec<PathBuf>, String> {
    let effective_root = resolve_effective_data_root(app)?;
    let mut roots = vec![effective_root.clone()];
    if include_default_app_data {
        let default_root = default_app_data_dir(app)?;
        if default_root != effective_root {
            roots.push(default_root);
        }
    }
    Ok(roots)
}

#[tauri::command]
pub async fn desktop_harvest_profile_web_storage(
    app: AppHandle,
    include_default_app_data: Option<bool>,
) -> Result<ProfileWebStorageHarvestResult, String> {
    let roots = collect_harvest_roots(&app, include_default_app_data.unwrap_or(true))?;
    harvest_profile_web_storage_from_roots(&roots)
}
