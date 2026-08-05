//! Offline pack filesystem helpers — RUST-6b.

use std::fs;
use std::path::{Path, PathBuf};

const PACK_SUFFIX: &str = ".obscur-offline-pack.json";

pub fn is_allowed_pack_path(path: &Path) -> bool {
    path.file_name()
        .and_then(|n| n.to_str())
        .map(|name| {
            let lower = name.to_lowercase();
            lower.ends_with(PACK_SUFFIX) || lower.ends_with(".json")
        })
        .unwrap_or(false)
}

/// Resolve export destination: absolute `filePath` or `fileName` under `exports_dir`.
pub fn resolve_export_path(
    file_path: Option<&str>,
    file_name: Option<&str>,
    exports_dir: Option<&Path>,
) -> Result<PathBuf, String> {
    if let Some(raw) = file_path.map(str::trim).filter(|s| !s.is_empty()) {
        let path = PathBuf::from(raw);
        if !is_allowed_pack_path(&path) {
            return Err(
                "Offline pack path must end with .obscur-offline-pack.json or .json".into(),
            );
        }
        if let Some(parent) = path.parent() {
            if !parent.as_os_str().is_empty() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
        }
        return Ok(path);
    }

    let name = file_name
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("offline-pack.obscur-offline-pack.json");
    let sanitized = name.replace(['\\', '/', ':', '*', '?', '"', '<', '>', '|'], "-");
    if sanitized.is_empty() || !is_allowed_pack_path(Path::new(&sanitized)) {
        return Err(
            "Offline pack file name must end with .obscur-offline-pack.json or .json".into(),
        );
    }
    let dir = exports_dir.ok_or_else(|| {
        "filePath or workspace exports directory required for offline pack export".to_string()
    })?;
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    Ok(dir.join(sanitized))
}

pub fn write_pack_bytes(path: &Path, contents: &[u8]) -> Result<(), String> {
    if !is_allowed_pack_path(path) {
        return Err("refusing to write non-pack path".into());
    }
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    fs::write(path, contents).map_err(|e| e.to_string())
}

pub fn read_pack_bytes(path: &str) -> Result<Vec<u8>, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("filePath is required".into());
    }
    let path = PathBuf::from(trimmed);
    if !is_allowed_pack_path(&path) {
        return Err(
            "Offline pack path must end with .obscur-offline-pack.json or .json".into(),
        );
    }
    if !path.is_file() {
        return Err(format!("pack file not found: {trimmed}"));
    }
    fs::read(&path).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_disallowed_extension() {
        assert!(resolve_export_path(
            Some("/tmp/secret.exe"),
            None,
            None
        )
        .is_err());
    }

    #[test]
    fn accepts_obscur_offline_suffix() {
        let dir = std::env::temp_dir().join("obscur-offline-io-test");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let path = resolve_export_path(
            None,
            Some("demo.obscur-offline-pack.json"),
            Some(&dir),
        )
        .unwrap();
        assert!(path.ends_with("demo.obscur-offline-pack.json"));
        let _ = fs::remove_dir_all(&dir);
    }
}
