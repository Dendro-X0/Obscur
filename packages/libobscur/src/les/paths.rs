use std::fs;
use std::path::{Path, PathBuf};

use super::types::LesKind;

pub fn sanitize_profile_id(profile_id: &str) -> String {
    let trimmed = profile_id.trim();
    if trimmed.is_empty() {
        return "default".to_string();
    }
    let cleaned: String = trimmed
        .chars()
        .map(|ch| match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();
    if cleaned.is_empty() {
        "default".to_string()
    } else {
        cleaned
    }
}

pub fn les_root(data_root: &Path, profile_id: &str) -> PathBuf {
    data_root
        .join("profiles")
        .join(sanitize_profile_id(profile_id))
        .join("les")
}

pub fn les_catalog_path(data_root: &Path, profile_id: &str) -> PathBuf {
    les_root(data_root, profile_id).join("catalog.sqlite")
}

pub fn les_blob_relative_path(profile_id: &str, kind: LesKind, les_object_id: &str) -> String {
    format!(
        "profiles/{}/les/{}/{}.obscurvault",
        sanitize_profile_id(profile_id),
        kind.dir_name(),
        les_object_id.trim()
    )
}

pub fn ensure_les_tree(data_root: &Path, profile_id: &str) -> Result<PathBuf, String> {
    let root = les_root(data_root, profile_id);
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    for kind in [LesKind::Image, LesKind::Video, LesKind::Audio, LesKind::File] {
        fs::create_dir_all(root.join(kind.dir_name())).map_err(|e| e.to_string())?;
    }
    Ok(root)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_relative_blob_paths() {
        let path = les_blob_relative_path("Alice", LesKind::Image, "abc123");
        assert_eq!(path, "profiles/Alice/les/images/abc123.obscurvault");
    }

    #[test]
    fn sanitizes_empty_profile() {
        assert_eq!(sanitize_profile_id("  "), "default");
    }
}
