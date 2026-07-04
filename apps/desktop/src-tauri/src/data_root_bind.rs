//! Cross-platform bind from Tauri install-scoped anchor → user physical data root.
//! Windows: directory junction. Unix: directory symlink. Fallback: pointer file in anchor.

use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StorageBindMode {
    AppData,
    Redirect,
    Pointer,
}

impl StorageBindMode {
    pub fn as_config_str(self) -> &'static str {
        match self {
            Self::AppData => "appdata",
            Self::Redirect => {
                #[cfg(windows)]
                {
                    "junction"
                }
                #[cfg(not(windows))]
                {
                    "symlink"
                }
            }
            Self::Pointer => "pointer",
        }
    }
}

pub fn redirect_target(anchor: &Path) -> Option<PathBuf> {
    std::fs::read_link(anchor).ok()
}

pub fn redirect_points_to(anchor: &Path, physical: &Path) -> bool {
    let Some(link_target) = redirect_target(anchor) else {
        return false;
    };
    let Ok(expected) = std::fs::canonicalize(physical) else {
        return false;
    };
    let resolved = std::fs::canonicalize(&link_target).unwrap_or(link_target);
    resolved
        .to_string_lossy()
        .eq_ignore_ascii_case(&expected.to_string_lossy())
}

pub fn is_redirect_at_anchor(anchor: &Path) -> bool {
    redirect_target(anchor).is_some()
}

pub fn storage_bind_mode_at(anchor: &Path, has_pointer: bool) -> StorageBindMode {
    if is_redirect_at_anchor(anchor) {
        StorageBindMode::Redirect
    } else if has_pointer {
        StorageBindMode::Pointer
    } else {
        StorageBindMode::AppData
    }
}

pub fn physical_path_from_anchor(anchor: &Path, pointer_target: Option<&Path>) -> PathBuf {
    if let Some(target) = redirect_target(anchor) {
        return std::fs::canonicalize(&target).unwrap_or(target);
    }
    if let Some(path) = pointer_target {
        return path.to_path_buf();
    }
    anchor.to_path_buf()
}

fn paths_overlap_for_bind(left: &Path, right: &Path) -> bool {
    let left = fs::canonicalize(left).unwrap_or_else(|_| left.to_path_buf());
    let right = fs::canonicalize(right).unwrap_or_else(|_| right.to_path_buf());
    left.starts_with(&right) || right.starts_with(&left)
}

/// Remove redirect at anchor without deleting the physical target.
pub fn remove_redirect_at_anchor(anchor: &Path) -> Result<(), String> {
    #[cfg(windows)]
    {
        if crate::windows_junction::is_reparse_point(anchor) {
            return crate::windows_junction::remove_junction_link(anchor);
        }
    }
    if is_redirect_at_anchor(anchor) {
        #[cfg(unix)]
        {
            return std::fs::remove_file(anchor).map_err(|e| e.to_string());
        }
        #[cfg(windows)]
        {
            return std::fs::remove_dir(anchor).map_err(|e| e.to_string());
        }
    }
    if anchor.exists() {
        return Err(format!(
            "Refusing to remove a real directory at anchor path: {}",
            anchor.display()
        ));
    }
    Ok(())
}

const ANCHOR_BIND_METADATA_FILES: &[&str] = &[
    "obscur_data_root.json",
    ".obscur-data-root-superseded.json",
];

fn anchor_entry_is_bind_metadata(name: &str) -> bool {
    ANCHOR_BIND_METADATA_FILES.contains(&name)
}

fn directory_is_empty(path: &Path) -> bool {
    fs::read_dir(path)
        .map(|mut entries| entries.next().is_none())
        .unwrap_or(true)
}

/// Anchor may hold only pointer/superseded files while bytes live on the physical root.
pub fn anchor_only_has_bind_metadata(anchor: &Path) -> bool {
    if !anchor.is_dir() {
        return false;
    }
    let entries = match fs::read_dir(anchor) {
        Ok(entries) => entries,
        Err(_) => return false,
    };
    for entry in entries.flatten() {
        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(_) => return false,
        };
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if file_type.is_dir() {
            if !directory_is_empty(&entry.path()) {
                return false;
            }
            continue;
        }
        if file_type.is_file() && anchor_entry_is_bind_metadata(&name_str) {
            continue;
        }
        return false;
    }
    true
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AnchorPrepareMode {
    /// Anchor must be empty, redirect-only, or bind-metadata-only.
    Strict,
    /// Physical root is authoritative — remove stale anchor bytes before redirect (reconnect/heal/migrate bind).
    ReplaceForPhysicalRoot,
}

fn prepare_anchor_for_redirect(
    anchor: &Path,
    physical: &Path,
    mode: AnchorPrepareMode,
) -> Result<(), String> {
    #[cfg(windows)]
    {
        if crate::windows_junction::is_reparse_point(anchor) {
            if redirect_points_to(anchor, physical) {
                return Ok(());
            }
            crate::windows_junction::remove_junction_link(anchor)?;
            return Ok(());
        }
    }
    if !anchor.exists() {
        return Ok(());
    }
    if is_redirect_at_anchor(anchor) {
        if redirect_points_to(anchor, physical) {
            return Ok(());
        }
        remove_redirect_at_anchor(anchor)?;
        return Ok(());
    }
    match mode {
        AnchorPrepareMode::ReplaceForPhysicalRoot => {
            if paths_overlap_for_bind(anchor, physical) {
                return Err(format!(
                    "Anchor {} overlaps physical root {} — cannot install redirect.",
                    anchor.display(),
                    physical.display()
                ));
            }
            fs::remove_dir_all(anchor).map_err(|e| {
                format!(
                    "Unable to clear anchor {} before redirect (close Obscur and retry): {e}",
                    anchor.display()
                )
            })?;
            Ok(())
        }
        AnchorPrepareMode::Strict => {
            if anchor_only_has_bind_metadata(anchor) {
                fs::remove_dir_all(anchor).map_err(|e| e.to_string())?;
                return Ok(());
            }
            let empty = fs::read_dir(anchor)
                .map_err(|e| e.to_string())?
                .next()
                .is_none();
            if !empty {
                return Err(format!(
                    "Anchor path {} is not empty. Export or merge data before binding to a new location.",
                    anchor.display()
                ));
            }
            fs::remove_dir(anchor).map_err(|e| e.to_string())
        }
    }
}

#[cfg(windows)]
fn install_redirect_impl(anchor: &Path, physical: &Path) -> Result<(), String> {
    crate::windows_junction::mklink_junction(anchor, physical)
}

#[cfg(unix)]
fn install_redirect_impl(anchor: &Path, physical: &Path) -> Result<(), String> {
    if anchor.exists() {
        return Err(format!(
            "Cannot create symlink — anchor already exists: {}",
            anchor.display()
        ));
    }
    if !physical.is_dir() {
        return Err(format!(
            "Symlink target is not a directory: {}",
            physical.display()
        ));
    }
    std::os::unix::fs::symlink(physical, anchor).map_err(|e| {
        format!(
            "symlink {} -> {} failed: {e}",
            anchor.display(),
            physical.display()
        )
    })
}

#[cfg(not(any(windows, unix)))]
fn install_redirect_impl(_anchor: &Path, _physical: &Path) -> Result<(), String> {
    Err("Directory redirect is not supported on this platform.".to_string())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InstallBindOutcome {
    RedirectInstalled,
    AlreadyBound,
}

/// Install redirect at anchor → physical. Caller clears pointer + writes backups after success.
pub fn install_data_root_redirect(
    anchor: &Path,
    physical: &Path,
    prepare_mode: AnchorPrepareMode,
) -> Result<InstallBindOutcome, String> {
    if redirect_points_to(anchor, physical) {
        return Ok(InstallBindOutcome::AlreadyBound);
    }
    prepare_anchor_for_redirect(anchor, physical, prepare_mode)?;
    install_redirect_impl(anchor, physical)?;
    if !redirect_points_to(anchor, physical) {
        return Err(format!(
            "Redirect verification failed: {} -> {}",
            anchor.display(),
            physical.display()
        ));
    }
    Ok(InstallBindOutcome::RedirectInstalled)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn stamp() -> u128 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    }

    #[test]
    fn anchor_only_has_bind_metadata_allows_pointer_only_anchor() {
        let base = std::env::temp_dir().join(format!("obscur-bind-meta-{}", stamp()));
        let anchor = base.join("anchor");
        fs::create_dir_all(&anchor).expect("anchor");
        fs::write(
            anchor.join("obscur_data_root.json"),
            br#"{"version":1,"customPath":"E:\\data","updatedAtUnixMs":0}"#,
        )
        .expect("pointer");
        assert!(anchor_only_has_bind_metadata(&anchor));
        let _ = fs::remove_dir_all(base);
    }

    #[test]
    fn physical_path_prefers_redirect_over_pointer() {
        let base = std::env::temp_dir().join(format!("obscur-bind-test-{}", stamp()));
        let anchor = base.join("anchor");
        let physical = base.join("physical");
        let _ = std::fs::create_dir_all(&physical);
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(&physical, &anchor).expect("symlink");
            let resolved = physical_path_from_anchor(&anchor, Some(Path::new("/ignored")));
            assert!(redirect_points_to(&anchor, &physical));
            let _ = std::fs::remove_dir(anchor);
        }
        let _ = std::fs::remove_dir_all(base);
    }

    #[cfg(unix)]
    #[test]
    fn replace_mode_installs_redirect_over_stale_anchor() {
        let base = std::env::temp_dir().join(format!("obscur-bind-replace-{}", stamp()));
        let anchor = base.join("anchor");
        let physical = base.join("physical");
        fs::create_dir_all(physical.join("profiles").join("default")).expect("physical profile");
        fs::write(physical.join("profiles_registry.json"), br#"{"version":1}"#).expect("registry");
        fs::create_dir_all(anchor.join("profiles")).expect("stale anchor");
        fs::write(anchor.join("profiles_registry.json"), br#"{"version":1}"#).expect("stale registry");

        install_data_root_redirect(&anchor, &physical, AnchorPrepareMode::ReplaceForPhysicalRoot)
            .expect("replace bind");
        assert!(redirect_points_to(&anchor, &physical));
        assert!(anchor.join("profiles/default").is_dir());

        let _ = fs::remove_dir(anchor);
        let _ = fs::remove_dir_all(physical);
    }

    #[test]
    fn storage_bind_mode_detects_pointer() {
        let anchor = Path::new("/tmp/obscur-anchor-test");
        assert_eq!(
            storage_bind_mode_at(anchor, true),
            StorageBindMode::Pointer
        );
        assert_eq!(
            storage_bind_mode_at(anchor, false),
            StorageBindMode::AppData
        );
    }
}
