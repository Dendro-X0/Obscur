//! R-RELAY-RUST-6b/6c — offline pack file export/import (sneakernet MVP).
//! @see specs/backend/r-relay-rust-6b-offline-export-import-design-2026-07.md
//! @see specs/backend/r-relay-rust-6c-offline-sneakernet-l3-design-2026-07.md

mod io;
mod pack;
mod persist;

pub use io::{read_pack_bytes, resolve_export_path, write_pack_bytes};
pub use pack::{
    decode_offline_pack, encode_offline_pack, verify_offline_pack_for_import,
    OfflineExportOutcome, OfflineImportOutcome, OfflinePackEnvelopeWireV1,
    OfflinePackRejectReason,
};
#[cfg(test)]
pub use pack::{audience_dm, OfflinePackAudience};
pub use persist::persist_imported_to_dm;
#[cfg(test)]
pub use persist::{offline_import_receipt_plaintext, OFFLINE_IMPORT_CONVERSATION_ID};

use pack::{evidence_record, now_unix_ms};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportOfflinePackPayload {
    pub envelopes: Vec<OfflinePackEnvelopeWireV1>,
    pub pack_key_hex: String,
    #[serde(default)]
    pub file_path: Option<String>,
    #[serde(default)]
    pub file_name: Option<String>,
    #[serde(default)]
    pub expires_at_unix_ms: Option<u64>,
    #[serde(default)]
    pub created_at_unix_ms: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportOfflinePackPayload {
    pub file_path: String,
    pub pack_key_hex: String,
    /// When true, persist import receipts into unlocked DbState (RUST-6c).
    #[serde(default)]
    pub persist_to_dm: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfflinePackEvidence {
    pub evidence_id: String,
    pub envelope_id: String,
    pub kind: String,
    pub at_unix_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failure_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub external_ref: Option<String>,
}

/// Export: encode pack + write file + `offline_export_ready` evidence.
pub fn export_offline_pack(
    profile_id: &str,
    payload: ExportOfflinePackPayload,
    resolve_path: impl FnOnce(&ExportOfflinePackPayload) -> Result<std::path::PathBuf, String>,
) -> OfflineExportOutcome {
    let at = now_unix_ms();
    let profile_id = profile_id.trim();
    if profile_id.is_empty() {
        return OfflineExportOutcome::rejected(
            OfflinePackRejectReason::ProfileScopeMismatch,
            Some("profile_id_required".into()),
            at,
        );
    }

    let path = match resolve_path(&payload) {
        Ok(p) => p,
        Err(e) => {
            return OfflineExportOutcome::rejected(
                OfflinePackRejectReason::IoError,
                Some(e),
                at,
            );
        }
    };

    let encoded = encode_offline_pack(
        profile_id,
        &payload.envelopes,
        &payload.pack_key_hex,
        payload.created_at_unix_ms,
        payload.expires_at_unix_ms,
    );
    let pack = match encoded {
        Ok(p) => p,
        Err((reason, detail)) => {
            return OfflineExportOutcome::rejected(reason, detail, at);
        }
    };

    let json = match serde_json::to_string_pretty(&pack) {
        Ok(s) => s,
        Err(e) => {
            return OfflineExportOutcome::rejected(
                OfflinePackRejectReason::IoError,
                Some(e.to_string()),
                at,
            );
        }
    };

    if let Err(e) = write_pack_bytes(&path, json.as_bytes()) {
        return OfflineExportOutcome::rejected(OfflinePackRejectReason::IoError, Some(e), at);
    }

    let path_str = path.to_string_lossy().to_string();
    let mut evidence = Vec::new();
    for env in &pack.envelopes {
        evidence.push(evidence_record(
            &format!("offline-export-{}-ready", env.envelope_id),
            &env.envelope_id,
            "offline_export_ready",
            at,
            None,
            None,
            Some(path_str.clone()),
        ));
    }
    if evidence.is_empty() {
        evidence.push(evidence_record(
            "offline-export-ready",
            "pack",
            "offline_export_ready",
            at,
            None,
            None,
            Some(path_str.clone()),
        ));
    }

    OfflineExportOutcome {
        ok: true,
        file_path: Some(path_str),
        evidence,
        reject_reason: None,
        detail: None,
    }
}

/// Import: read file + verify + `imported_offline` / `offline_pack_rejected` evidence.
pub fn import_offline_pack(
    profile_id: &str,
    payload: ImportOfflinePackPayload,
) -> OfflineImportOutcome {
    let at = now_unix_ms();
    let profile_id = profile_id.trim();
    if profile_id.is_empty() {
        return OfflineImportOutcome::rejected(
            OfflinePackRejectReason::ProfileScopeMismatch,
            Some("profile_id_required".into()),
            "pack",
            at,
        );
    }

    let bytes = match read_pack_bytes(payload.file_path.trim()) {
        Ok(b) => b,
        Err(e) => {
            return OfflineImportOutcome::rejected(
                OfflinePackRejectReason::IoError,
                Some(e),
                "pack",
                at,
            );
        }
    };

    let raw = match String::from_utf8(bytes) {
        Ok(s) => s,
        Err(_) => {
            return OfflineImportOutcome::rejected(
                OfflinePackRejectReason::JsonInvalid,
                Some("utf8_invalid".into()),
                "pack",
                at,
            );
        }
    };

    let value: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => {
            return OfflineImportOutcome::rejected(
                OfflinePackRejectReason::JsonInvalid,
                None,
                "pack",
                at,
            );
        }
    };

    let pack = match decode_offline_pack(&value) {
        Ok(p) => p,
        Err((reason, detail)) => {
            return OfflineImportOutcome::rejected(reason, detail, "pack", at);
        }
    };

    match verify_offline_pack_for_import(&pack, profile_id, &payload.pack_key_hex, Some(at)) {
        Ok(envelopes) => {
            let mut evidence = Vec::new();
            for env in &envelopes {
                evidence.push(evidence_record(
                    &format!("offline-import-{}", env.envelope_id),
                    &env.envelope_id,
                    "imported_offline",
                    at,
                    None,
                    None,
                    Some(payload.file_path.trim().to_string()),
                ));
            }
            OfflineImportOutcome {
                ok: true,
                envelopes,
                evidence,
                persisted_count: None,
                reject_reason: None,
                detail: None,
            }
        }
        Err((reason, detail)) => {
            let envelope_id = pack
                .envelopes
                .first()
                .map(|e| e.envelope_id.as_str())
                .unwrap_or("pack");
            OfflineImportOutcome::rejected(reason, detail, envelope_id, at)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mesh::offline::pack::{audience_dm, OfflinePackAudience};
    use std::path::PathBuf;

    fn sample_envelope(profile_id: &str) -> OfflinePackEnvelopeWireV1 {
        OfflinePackEnvelopeWireV1 {
            envelope_id: "env-offline-1".into(),
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
    fn export_import_round_trip_tempfile() {
        let dir = std::env::temp_dir().join(format!(
            "obscur-offline-6b-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).expect("temp dir");
        let path = dir.join("pack.obscur-offline-pack.json");

        let key_hex = "07".repeat(32);
        let export = export_offline_pack(
            "profile-a",
            ExportOfflinePackPayload {
                envelopes: vec![sample_envelope("profile-a")],
                pack_key_hex: key_hex.clone(),
                file_path: Some(path.to_string_lossy().to_string()),
                file_name: None,
                expires_at_unix_ms: Some(1_800_000_000_000),
                created_at_unix_ms: Some(1_700_000_000_000),
            },
            |p| {
                Ok(PathBuf::from(
                    p.file_path.as_ref().expect("path").as_str(),
                ))
            },
        );
        assert!(export.ok, "export failed: {:?}", export);
        assert!(export
            .evidence
            .iter()
            .any(|e| e.kind == "offline_export_ready"));

        let import = import_offline_pack(
            "profile-a",
            ImportOfflinePackPayload {
                file_path: path.to_string_lossy().to_string(),
                pack_key_hex: key_hex,
                persist_to_dm: false,
            },
        );
        assert!(import.ok, "import failed: {:?}", import);
        assert_eq!(import.envelopes.len(), 1);
        assert!(import
            .evidence
            .iter()
            .any(|e| e.kind == "imported_offline"));

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn import_rejects_wrong_profile() {
        let dir = std::env::temp_dir().join(format!(
            "obscur-offline-6b-wrong-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("pack.obscur-offline-pack.json");
        let key_hex = "07".repeat(32);

        let export = export_offline_pack(
            "profile-a",
            ExportOfflinePackPayload {
                envelopes: vec![sample_envelope("profile-a")],
                pack_key_hex: key_hex.clone(),
                file_path: Some(path.to_string_lossy().to_string()),
                file_name: None,
                expires_at_unix_ms: None,
                created_at_unix_ms: Some(1_700_000_000_000),
            },
            |p| Ok(PathBuf::from(p.file_path.as_ref().unwrap().as_str())),
        );
        assert!(export.ok);

        let import = import_offline_pack(
            "profile-b",
            ImportOfflinePackPayload {
                file_path: path.to_string_lossy().to_string(),
                pack_key_hex: key_hex,
                persist_to_dm: false,
            },
        );
        assert!(!import.ok);
        assert_eq!(
            import.reject_reason.as_deref(),
            Some("profile_scope_mismatch")
        );
        assert!(import
            .evidence
            .iter()
            .any(|e| e.kind == "offline_pack_rejected"));

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn pack_mac_matches_ts_golden_vector() {
        // Golden from Node createHmac / @obscur/conduit-mesh-contracts encodeOfflinePack
        // (profile-a, env-offline-1, key 32×0x07, created 1700000000000, expires 1800000000000).
        const GOLDEN_MAC: &str =
            "2728ce2f2712fc07781a53f49677bcc80c2a01eaf7567874ddf546b5a3b89998";
        let env = OfflinePackEnvelopeWireV1 {
            envelope_id: "env-offline-1".into(),
            correlation_id: None,
            profile_id: "profile-a".into(),
            message_scope: "dm".into(),
            audience: OfflinePackAudience::Dm {
                recipient_public_key_hex: "abc123".into(),
            },
            ciphertext_base64: "CQgHBg==".into(), // [9,8,7,6]
            evidence_class: "accepted_when_imported".into(),
            created_at_unix_ms: 1_700_000_000_000,
            ttl_ms: None,
            priority: None,
        };
        let pack = encode_offline_pack(
            "profile-a",
            &[env],
            &"07".repeat(32),
            Some(1_700_000_000_000),
            Some(1_800_000_000_000),
        )
        .expect("encode");
        assert_eq!(pack.pack_mac, GOLDEN_MAC);
    }
}
