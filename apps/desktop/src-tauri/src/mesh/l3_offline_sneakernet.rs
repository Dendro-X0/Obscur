//! R-RELAY-RUST-6c L3 — two data roots sneakernet: export → copy → import → dm visible.
//! @see specs/backend/r-relay-rust-6c-offline-sneakernet-l3-design-2026-07.md

use crate::mesh::offline::{
    audience_dm, export_offline_pack, import_offline_pack, persist_imported_to_dm,
    ExportOfflinePackPayload, ImportOfflinePackPayload, OfflinePackEnvelopeWireV1,
    OFFLINE_IMPORT_CONVERSATION_ID,
};
use libobscur::db::Database;
use std::fs;
use std::path::PathBuf;

fn sample_envelope(profile_id: &str, envelope_id: &str) -> OfflinePackEnvelopeWireV1 {
    OfflinePackEnvelopeWireV1 {
        envelope_id: envelope_id.into(),
        correlation_id: None,
        profile_id: profile_id.into(),
        message_scope: "dm".into(),
        audience: audience_dm("abc123"),
        ciphertext_base64: base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            [9u8, 8, 7, 6],
        ),
        evidence_class: "accepted_when_imported".into(),
        created_at_unix_ms: 1_700_000_000_000,
        ttl_ms: None,
        priority: None,
    }
}

#[test]
fn l3_offline_sneakernet_two_data_roots() {
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let base = std::env::temp_dir().join(format!("obscur-l3-offline-{stamp}"));
    let root_a = base.join("data-root-a"); // sender machine
    let root_b = base.join("data-root-b"); // receiver machine
    let courier = base.join("courier");
    let outbox = root_a.join("outbox");
    let inbox = root_b.join("inbox");
    fs::create_dir_all(&outbox).unwrap();
    fs::create_dir_all(&inbox).unwrap();
    fs::create_dir_all(&courier).unwrap();

    let bob = "bob";
    let alice = "alice";
    let pack_key = "07".repeat(32);
    let pack_name = "sneakernet.obscur-offline-pack.json";
    let export_path = outbox.join(pack_name);

    // 1) Export on root A — pack addressed to destination profile `bob`.
    let export = export_offline_pack(
        bob,
        ExportOfflinePackPayload {
            envelopes: vec![sample_envelope(bob, "env-sneakernet-1")],
            pack_key_hex: pack_key.clone(),
            file_path: Some(export_path.to_string_lossy().to_string()),
            file_name: None,
            expires_at_unix_ms: Some(1_800_000_000_000),
            created_at_unix_ms: Some(1_700_000_000_000),
        },
        |p| Ok(PathBuf::from(p.file_path.as_ref().unwrap().as_str())),
    );
    assert!(export.ok, "export failed: {:?}", export);
    assert!(
        export
            .evidence
            .iter()
            .any(|e| e.kind == "offline_export_ready"),
        "missing offline_export_ready"
    );
    assert!(export_path.is_file(), "export file missing");

    // 2) Courier copy A → courier → B (no network).
    let courier_path = courier.join(pack_name);
    fs::copy(&export_path, &courier_path).expect("copy to courier");
    let import_path = inbox.join(pack_name);
    fs::copy(&courier_path, &import_path).expect("copy to receiver inbox");

    // 3) Wrong profile on root B must fail closed.
    let wrong = import_offline_pack(
        alice,
        ImportOfflinePackPayload {
            file_path: import_path.to_string_lossy().to_string(),
            pack_key_hex: pack_key.clone(),
            persist_to_dm: false,
        },
    );
    assert!(!wrong.ok, "alice must not import bob pack");
    assert_eq!(
        wrong.reject_reason.as_deref(),
        Some("profile_scope_mismatch")
    );

    // 4) Bob imports on root B + persist into bob sqlite under root B.
    let bob_db_path = root_b.join("obscur.sqlite3");
    let bob_db = Database::new(Some(bob_db_path.to_str().unwrap())).unwrap();
    bob_db
        .ensure_profile_slot(
            bob,
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        )
        .unwrap();

    let import = import_offline_pack(
        bob,
        ImportOfflinePackPayload {
            file_path: import_path.to_string_lossy().to_string(),
            pack_key_hex: pack_key.clone(),
            persist_to_dm: false,
        },
    );
    assert!(import.ok, "bob import failed: {:?}", import);
    assert!(
        import
            .evidence
            .iter()
            .any(|e| e.kind == "imported_offline"),
        "missing imported_offline"
    );
    assert_eq!(import.envelopes.len(), 1);

    let persisted = persist_imported_to_dm(&bob_db, bob, &import.envelopes).unwrap();
    assert_eq!(persisted, 1);

    let thread = bob_db
        .get_messages_by_conversation(bob, OFFLINE_IMPORT_CONVERSATION_ID, 10, None)
        .unwrap();
    assert_eq!(thread.len(), 1, "message not visible on bob thread");
    assert!(
        thread[0].plaintext.contains("imported_offline"),
        "receipt missing: {}",
        thread[0].plaintext
    );
    assert!(thread[0].plaintext.contains("env-sneakernet-1"));

    // 5) Alice data root must not see bob's message.
    let alice_db_path = root_a.join("obscur.sqlite3");
    let alice_db = Database::new(Some(alice_db_path.to_str().unwrap())).unwrap();
    alice_db
        .ensure_profile_slot(
            alice,
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        )
        .unwrap();
    let alice_thread = alice_db
        .get_messages_by_conversation(alice, OFFLINE_IMPORT_CONVERSATION_ID, 10, None)
        .unwrap();
    assert!(
        alice_thread.is_empty(),
        "alice vault must stay empty after bob sneakernet"
    );

    let _ = fs::remove_dir_all(&base);
}
