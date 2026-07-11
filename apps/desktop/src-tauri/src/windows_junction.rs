//! NTFS directory junction helpers (Deco-style AppData redirect).
//! Apps keep using the original AppData path; bytes live on another drive.

use std::path::{Path, PathBuf};
use std::process::Command;

pub fn junction_target(link_path: &Path) -> Option<PathBuf> {
    #[cfg(windows)]
    {
        fs_read_link(link_path).ok()
    }
    #[cfg(not(windows))]
    {
        let _ = link_path;
        None
    }
}

pub fn is_reparse_point(path: &Path) -> bool {
    junction_target(path).is_some()
}

/// Create `mklink /J link target`. Requires the link path to not exist.
pub fn mklink_junction(link_path: &Path, target: &Path) -> Result<(), String> {
    #[cfg(windows)]
    {
        if link_path.exists() {
            return Err(format!(
                "Cannot create junction — path already exists: {}",
                link_path.display()
            ));
        }
        if !target.is_dir() {
            return Err(format!(
                "Junction target is not a directory: {}",
                target.display()
            ));
        }
        let link = link_path.to_string_lossy().to_string();
        let tgt = target.to_string_lossy().to_string();
        let output = Command::new("cmd")
            .args(["/C", "mklink", "/J", &link, &tgt])
            .output()
            .map_err(|e| format!("failed to start mklink: {e}"))?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            return Err(format!("mklink /J failed: {stderr}{stdout}"));
        }
        verify_junction_target(link_path, target)
    }
    #[cfg(not(windows))]
    {
        let _ = (link_path, target);
        Err("Directory junctions are only supported on Windows.".to_string())
    }
}

/// Verify junction without `canonicalize` on the link (cross-volume error 448).
pub fn verify_junction_target(link_path: &Path, dest: &Path) -> Result<(), String> {
    #[cfg(windows)]
    {
        let expected = fs_canonicalize(dest).map_err(|e| format!("failed canonicalize dest: {e}"))?;
        let link_target = fs_read_link(link_path)
            .map_err(|e| format!("failed reading junction target: {e}"))?;
        let resolved = fs_canonicalize(&link_target).unwrap_or(link_target);
        if resolved.to_string_lossy().eq_ignore_ascii_case(&expected.to_string_lossy()) {
            return Ok(());
        }
        Err(format!(
            "junction verification failed: {} -> {} (expected {})",
            link_path.display(),
            resolved.display(),
            expected.display()
        ))
    }
    #[cfg(not(windows))]
    {
        let _ = (link_path, dest);
        Ok(())
    }
}

/// Remove a junction or symlink at `link_path` without deleting the target directory.
pub fn remove_junction_link(link_path: &Path) -> Result<(), String> {
    if !link_path.exists() {
        return Ok(());
    }
    if is_reparse_point(link_path) {
        std::fs::remove_dir(link_path).map_err(|e| e.to_string())
    } else {
        Err(format!(
            "Refusing to remove a real directory at junction path: {}",
            link_path.display()
        ))
    }
}

fn fs_read_link(path: &Path) -> Result<PathBuf, std::io::Error> {
    std::fs::read_link(path)
}

fn fs_canonicalize(path: &Path) -> Result<PathBuf, std::io::Error> {
    std::fs::canonicalize(path)
}

#[cfg(test)]
mod tests {
    #[test]
    fn junction_module_compiles_on_all_targets() {
        assert!(true);
    }
}
