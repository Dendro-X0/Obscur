use crate::local_save_scan::{scan_local_saves, LocalSaveScanRequest, LocalSaveScanResult};

#[tauri::command]
pub async fn desktop_scan_local_saves(
    roots: Vec<String>,
    max_depth: Option<u32>,
    max_results: Option<u32>,
) -> Result<LocalSaveScanResult, String> {
    let request = LocalSaveScanRequest {
        roots,
        max_depth,
        max_results,
    };
    tauri::async_runtime::spawn_blocking(move || scan_local_saves(request))
        .await
        .map_err(|error| format!("Local save scan task failed: {error}"))?
}
