//! Automated L3 — cold hydrate for Local Encrypted Store.
//!
//! Proves catalog + ciphertext survive without any in-process cache:
//! commit → drop Connections → fresh `open_catalog` / `list_objects` / decrypt.
//! No desktop unlock loop; no WebView dogfood.

use std::fs;
use std::path::Path;

use tempfile::tempdir;

use libobscur::les::{
    commit_object, get_object, list_objects, CommitInput, LesKind, LesSource,
};
use libobscur::storage_at_rest::read_encrypted_file;

fn cold_list(data_root: &Path, profile_id: &str) -> Vec<libobscur::les::LesObjectMeta> {
    // Fresh SQLite connection every call — no retained catalog handle.
    list_objects(data_root, profile_id).expect("cold list")
}

#[test]
fn l3_cold_hydrate_after_commit_keeps_catalog_and_ciphertext() {
    let dir = tempdir().expect("tempdir");
    let data_root = dir.path();
    let pdk = [42u8; 32];
    let plaintext = b"les-l3-cold-hydrate-bytes";

    let receipt = commit_object(
        data_root,
        &pdk,
        CommitInput {
            profile_id: "tester2",
            bytes: plaintext,
            kind: LesKind::Image,
            display_name: "cold.png",
            content_type: "image/png",
            source: LesSource::SecureUpload,
            source_attachment_url: None,
            active_profile_id: Some("tester2"),
        },
    )
    .expect("commit");

    // Simulate process boundary: only the on-disk tree remains.
    assert!(data_root.join(&receipt.relative_path).is_file());
    assert!(data_root
        .join("profiles/tester2/les/catalog.sqlite")
        .is_file());

    let listed = cold_list(data_root, "tester2");
    assert_eq!(listed.len(), 1, "cold list must see committed row");
    assert_eq!(listed[0].les_object_id, receipt.les_object_id);
    assert_eq!(listed[0].relative_path, receipt.relative_path);
    assert_eq!(listed[0].display_name, "cold.png");

    let got = get_object(data_root, "tester2", &receipt.les_object_id)
        .expect("get")
        .expect("row present after cold get");
    assert_eq!(got.les_object_id, receipt.les_object_id);

    let decrypted = read_encrypted_file(&data_root.join(&receipt.relative_path), &pdk)
        .expect("decrypt after cold reopen");
    assert_eq!(decrypted, plaintext);
}

#[test]
fn l3_cold_hydrate_multiple_objects_survive_reopen() {
    let dir = tempdir().expect("tempdir");
    let data_root = dir.path();
    let pdk = [11u8; 32];

    let first = commit_object(
        data_root,
        &pdk,
        CommitInput {
            profile_id: "alice",
            bytes: b"one",
            kind: LesKind::File,
            display_name: "one.bin",
            content_type: "application/octet-stream",
            source: LesSource::SecureUpload,
            source_attachment_url: None,
            active_profile_id: None,
        },
    )
    .expect("first");

    let second = commit_object(
        data_root,
        &pdk,
        CommitInput {
            profile_id: "alice",
            bytes: b"two-video",
            kind: LesKind::Video,
            display_name: "two.mp4",
            content_type: "video/mp4",
            source: LesSource::ChatSave,
            source_attachment_url: Some("https://cdn.example/x"),
            active_profile_id: None,
        },
    )
    .expect("second");

    // Force filesystem flush visibility before cold opens.
    let _ = fs::metadata(data_root.join("profiles/alice/les/catalog.sqlite"));

    let listed = cold_list(data_root, "alice");
    assert_eq!(listed.len(), 2);
    let ids: Vec<_> = listed.iter().map(|row| row.les_object_id.as_str()).collect();
    assert!(ids.contains(&first.les_object_id.as_str()));
    assert!(ids.contains(&second.les_object_id.as_str()));

    let foreign = cold_list(data_root, "bob");
    assert!(foreign.is_empty(), "cold hydrate must stay profile-scoped");
}
