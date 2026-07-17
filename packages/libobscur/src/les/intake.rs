use std::fs;
use std::path::{Path, PathBuf};

use crate::storage_at_rest::write_encrypted_file;

use super::catalog::{delete_object_row, insert_object, now_unix_ms, open_catalog};
use super::paths::{ensure_les_tree, les_blob_relative_path, sanitize_profile_id};
use super::types::{LesCommitReceipt, LesKind, LesObjectMeta, LesSource};

#[derive(Debug)]
pub enum LesCommitError {
    Message(String),
}

impl std::fmt::Display for LesCommitError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Message(msg) => write!(f, "{msg}"),
        }
    }
}

impl From<String> for LesCommitError {
    fn from(value: String) -> Self {
        Self::Message(value)
    }
}

pub struct CommitInput<'a> {
    pub profile_id: &'a str,
    pub bytes: &'a [u8],
    pub kind: LesKind,
    pub display_name: &'a str,
    pub content_type: &'a str,
    pub source: LesSource,
    pub source_attachment_url: Option<&'a str>,
    /// When set, commit aborts if this differs from `profile_id` (mid-flight switch).
    pub active_profile_id: Option<&'a str>,
}

fn new_les_object_id() -> Result<String, LesCommitError> {
    let mut bytes = [0u8; 16];
    getrandom::getrandom(&mut bytes).map_err(|e| LesCommitError::Message(e.to_string()))?;
    Ok(hex::encode(bytes))
}

pub fn commit_object(
    data_root: &Path,
    pdk: &[u8; 32],
    input: CommitInput<'_>,
) -> Result<LesCommitReceipt, LesCommitError> {
    let profile_id = sanitize_profile_id(input.profile_id);
    if let Some(active) = input.active_profile_id {
        let active_sanitized = sanitize_profile_id(active);
        if active_sanitized != profile_id {
            return Err(LesCommitError::Message(
                "LES commit refused: profile changed mid-flight".to_string(),
            ));
        }
    }
    if input.bytes.is_empty() {
        return Err(LesCommitError::Message("Cannot commit empty LES object".to_string()));
    }

    ensure_les_tree(data_root, &profile_id)?;
    let les_object_id = new_les_object_id()?;
    let relative_path = les_blob_relative_path(&profile_id, input.kind, &les_object_id);
    let absolute_path: PathBuf = data_root.join(&relative_path);
    if let Some(parent) = absolute_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    write_encrypted_file(&absolute_path, pdk, input.bytes).map_err(LesCommitError::from)?;
    if !absolute_path.is_file() {
        return Err(LesCommitError::Message(
            "LES commit failed: ciphertext missing after write".to_string(),
        ));
    }

    let meta = LesObjectMeta {
        les_object_id: les_object_id.clone(),
        profile_id: profile_id.clone(),
        kind: input.kind,
        display_name: input.display_name.trim().to_string(),
        content_type: input.content_type.trim().to_string(),
        byte_length: input.bytes.len() as u64,
        created_at_unix_ms: now_unix_ms(),
        source: input.source,
        source_attachment_url: input
            .source_attachment_url
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty()),
        relative_path: relative_path.clone(),
    };

    let conn = open_catalog(data_root, &profile_id)?;
    let revision = insert_object(&conn, &meta)?;

    // Proof gate: catalog must read back the same id.
    drop(conn);
    let proved = super::catalog::get_object(data_root, &profile_id, &les_object_id)?
        .ok_or_else(|| LesCommitError::Message("LES commit failed: catalog row missing".to_string()))?;
    if proved.relative_path != relative_path {
        let _ = fs::remove_file(&absolute_path);
        return Err(LesCommitError::Message(
            "LES commit failed: catalog path mismatch".to_string(),
        ));
    }

    Ok(LesCommitReceipt {
        les_object_id,
        profile_id,
        relative_path,
        catalog_revision: revision,
    })
}

/// Hard-remove a LES object for `profile_id`: catalog row then ciphertext file.
/// Returns `true` when a catalog row was removed. Missing ciphertext is not an error.
pub fn delete_object(
    data_root: &Path,
    profile_id: &str,
    les_object_id: &str,
) -> Result<bool, LesCommitError> {
    let profile_id = sanitize_profile_id(profile_id);
    let les_object_id = les_object_id.trim();
    if les_object_id.is_empty() {
        return Err(LesCommitError::Message(
            "LES delete refused: empty object id".to_string(),
        ));
    }

    let meta = super::catalog::get_object(data_root, &profile_id, les_object_id)?
        .ok_or_else(|| {
            LesCommitError::Message("LES object not found for active profile".to_string())
        })?;
    if meta.profile_id != profile_id {
        return Err(LesCommitError::Message(
            "LES delete refused: object belongs to another profile".to_string(),
        ));
    }

    let deleted = delete_object_row(data_root, &profile_id, les_object_id)?;
    if !deleted {
        return Ok(false);
    }

    let absolute = data_root.join(&meta.relative_path);
    match fs::remove_file(&absolute) {
        Ok(()) => {}
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {}
        Err(err) => {
            return Err(LesCommitError::Message(format!(
                "LES catalog row removed but ciphertext delete failed: {err}"
            )));
        }
    }

    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::les::{LesKind, LesSource};
    use crate::storage_at_rest::read_encrypted_file;
    use tempfile::tempdir;

    #[test]
    fn commit_list_get_roundtrip() {
        let dir = tempdir().expect("tempdir");
        let data_root = dir.path();
        let pdk = [7u8; 32];
        let plaintext = b"hello-les-image";
        let receipt = commit_object(
            data_root,
            &pdk,
            CommitInput {
                profile_id: "alice",
                bytes: plaintext,
                kind: LesKind::Image,
                display_name: "shot.png",
                content_type: "image/png",
                source: LesSource::SecureUpload,
                source_attachment_url: None,
                active_profile_id: Some("alice"),
            },
        )
        .expect("commit");

        assert!(receipt.relative_path.contains("profiles/alice/les/images/"));
        let listed = super::super::catalog::list_objects(data_root, "alice").expect("list");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].les_object_id, receipt.les_object_id);

        let abs = data_root.join(&receipt.relative_path);
        let decrypted = read_encrypted_file(&abs, &pdk).expect("decrypt");
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn refuses_mid_flight_profile_switch() {
        let dir = tempdir().expect("tempdir");
        let err = commit_object(
            dir.path(),
            &[1u8; 32],
            CommitInput {
                profile_id: "alice",
                bytes: b"x",
                kind: LesKind::File,
                display_name: "a.bin",
                content_type: "application/octet-stream",
                source: LesSource::ChatSave,
                source_attachment_url: None,
                active_profile_id: Some("bob"),
            },
        )
        .expect_err("must refuse");
        assert!(err.to_string().contains("mid-flight"));
    }

    #[test]
    fn profiles_are_isolated() {
        let dir = tempdir().expect("tempdir");
        let data_root = dir.path();
        let pdk = [9u8; 32];
        commit_object(
            data_root,
            &pdk,
            CommitInput {
                profile_id: "alice",
                bytes: b"a-bytes",
                kind: LesKind::Video,
                display_name: "a.mp4",
                content_type: "video/mp4",
                source: LesSource::SecureUpload,
                source_attachment_url: None,
                active_profile_id: None,
            },
        )
        .expect("alice");
        let bob_list = super::super::catalog::list_objects(data_root, "bob").expect("bob list");
        assert!(bob_list.is_empty());
    }

    #[test]
    fn delete_removes_catalog_row_and_ciphertext() {
        let dir = tempdir().expect("tempdir");
        let data_root = dir.path();
        let pdk = [3u8; 32];
        let receipt = commit_object(
            data_root,
            &pdk,
            CommitInput {
                profile_id: "alice",
                bytes: b"delete-me",
                kind: LesKind::Image,
                display_name: "gone.png",
                content_type: "image/png",
                source: LesSource::SecureUpload,
                source_attachment_url: None,
                active_profile_id: Some("alice"),
            },
        )
        .expect("commit");

        let abs = data_root.join(&receipt.relative_path);
        assert!(abs.is_file());

        let deleted = delete_object(data_root, "alice", &receipt.les_object_id).expect("delete");
        assert!(deleted);
        assert!(super::super::catalog::list_objects(data_root, "alice")
            .expect("list")
            .is_empty());
        assert!(!abs.is_file());
    }

    #[test]
    fn delete_does_not_remove_other_profile_object() {
        let dir = tempdir().expect("tempdir");
        let data_root = dir.path();
        let pdk = [4u8; 32];
        let receipt = commit_object(
            data_root,
            &pdk,
            CommitInput {
                profile_id: "alice",
                bytes: b"alice-bytes",
                kind: LesKind::File,
                display_name: "a.bin",
                content_type: "application/octet-stream",
                source: LesSource::ChatSave,
                source_attachment_url: None,
                active_profile_id: None,
            },
        )
        .expect("commit");

        let err = delete_object(data_root, "bob", &receipt.les_object_id).expect_err("cross-profile");
        assert!(err.to_string().contains("not found") || err.to_string().contains("another profile"));

        let listed = super::super::catalog::list_objects(data_root, "alice").expect("list");
        assert_eq!(listed.len(), 1);
        assert!(data_root.join(&receipt.relative_path).is_file());
    }
}
