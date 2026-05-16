//! Application-wide data models

/// Report structure for reset_app_storage command
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct ResetAppStorageReport {
    pub js_storage_cleared: bool,
    pub indexed_db_cleared: bool,
    pub app_data_dir: Option<String>,
    pub removed_paths: Vec<String>,
    pub failed_paths: Vec<String>,
}
