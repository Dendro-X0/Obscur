//! Offline pack schema — Rust mirror of `@obscur/conduit-mesh-contracts` offline-pack (RUST-6a).

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub const OBSCUR_OFFLINE_PACK_V1: &str = "obscur-offline-pack/v1";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum OfflinePackAudience {
    #[serde(rename = "dm")]
    Dm {
        #[serde(rename = "recipientPublicKeyHex")]
        recipient_public_key_hex: String,
    },
    #[serde(rename = "workspace")]
    Workspace {
        #[serde(rename = "communityId")]
        community_id: String,
    },
    #[serde(rename = "control")]
    Control {
        #[serde(rename = "coordinationTopic")]
        coordination_topic: String,
    },
}

#[allow(dead_code)] // pack helper; used by offline tests / sneakernet L3
pub fn audience_dm(recipient_public_key_hex: &str) -> OfflinePackAudience {
    OfflinePackAudience::Dm {
        recipient_public_key_hex: recipient_public_key_hex.to_string(),
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OfflinePackEnvelopeWireV1 {
    pub envelope_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub correlation_id: Option<String>,
    pub profile_id: String,
    pub message_scope: String,
    pub audience: OfflinePackAudience,
    pub ciphertext_base64: String,
    pub evidence_class: String,
    pub created_at_unix_ms: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ttl_ms: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OfflinePackWireV1 {
    pub schema: String,
    pub profile_id_hint: String,
    pub created_at_unix_ms: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at_unix_ms: Option<u64>,
    pub envelopes: Vec<OfflinePackEnvelopeWireV1>,
    pub pack_mac: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OfflinePackRejectReason {
    SchemaInvalid,
    PackEmpty,
    EnvelopeInvalid,
    CiphertextEmpty,
    PackMacInvalid,
    PackExpired,
    ProfileScopeMismatch,
    CreatedAtInvalid,
    PackKeyRequired,
    JsonInvalid,
    IoError,
}

impl OfflinePackRejectReason {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::SchemaInvalid => "schema_invalid",
            Self::PackEmpty => "pack_empty",
            Self::EnvelopeInvalid => "envelope_invalid",
            Self::CiphertextEmpty => "ciphertext_empty",
            Self::PackMacInvalid => "pack_mac_invalid",
            Self::PackExpired => "pack_expired",
            Self::ProfileScopeMismatch => "profile_scope_mismatch",
            Self::CreatedAtInvalid => "created_at_invalid",
            Self::PackKeyRequired => "pack_key_required",
            Self::JsonInvalid => "json_invalid",
            Self::IoError => "io_error",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfflineExportOutcome {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    pub evidence: Vec<super::OfflinePackEvidence>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reject_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

impl OfflineExportOutcome {
    pub fn rejected(
        reason: OfflinePackRejectReason,
        detail: Option<String>,
        at: u64,
    ) -> Self {
        Self {
            ok: false,
            file_path: None,
            evidence: vec![evidence_record(
                "offline-export-rejected",
                "pack",
                "offline_pack_rejected",
                at,
                Some(reason.as_str().into()),
                detail.clone(),
                None,
            )],
            reject_reason: Some(reason.as_str().into()),
            detail,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfflineImportOutcome {
    pub ok: bool,
    pub envelopes: Vec<OfflinePackEnvelopeWireV1>,
    pub evidence: Vec<super::OfflinePackEvidence>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub persisted_count: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reject_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

impl OfflineImportOutcome {
    pub fn rejected(
        reason: OfflinePackRejectReason,
        detail: Option<String>,
        envelope_id: &str,
        at: u64,
    ) -> Self {
        Self {
            ok: false,
            envelopes: vec![],
            evidence: vec![evidence_record(
                &format!("offline-import-rejected-{envelope_id}"),
                envelope_id,
                "offline_pack_rejected",
                at,
                Some(reason.as_str().into()),
                detail.clone(),
                None,
            )],
            persisted_count: None,
            reject_reason: Some(reason.as_str().into()),
            detail,
        }
    }
}

pub fn evidence_record(
    evidence_id: &str,
    envelope_id: &str,
    kind: &str,
    at_unix_ms: u64,
    failure_reason: Option<String>,
    detail: Option<String>,
    external_ref: Option<String>,
) -> super::OfflinePackEvidence {
    super::OfflinePackEvidence {
        evidence_id: evidence_id.to_string(),
        envelope_id: envelope_id.to_string(),
        kind: kind.to_string(),
        at_unix_ms,
        failure_reason,
        detail,
        external_ref,
    }
}

pub fn now_unix_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn bytes_to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn hex_to_bytes(hex: &str) -> Option<Vec<u8>> {
    let trimmed = hex.trim().to_lowercase();
    if trimmed.is_empty() || trimmed.len() % 2 != 0 || !trimmed.chars().all(|c| c.is_ascii_hexdigit())
    {
        return None;
    }
    let mut out = Vec::with_capacity(trimmed.len() / 2);
    for i in (0..trimmed.len()).step_by(2) {
        out.push(u8::from_str_radix(&trimmed[i..i + 2], 16).ok()?);
    }
    Some(out)
}

/// HMAC-SHA256 (no extra crate — matches Node createHmac / Web Crypto).
fn hmac_sha256(key: &[u8], message: &[u8]) -> [u8; 32] {
    const BLOCK: usize = 64;
    let mut key_block = [0u8; BLOCK];
    if key.len() > BLOCK {
        let hashed = Sha256::digest(key);
        key_block[..hashed.len()].copy_from_slice(&hashed);
    } else {
        key_block[..key.len()].copy_from_slice(key);
    }
    let mut ipad = [0x36u8; BLOCK];
    let mut opad = [0x5cu8; BLOCK];
    for i in 0..BLOCK {
        ipad[i] ^= key_block[i];
        opad[i] ^= key_block[i];
    }
    let mut inner = Sha256::new();
    inner.update(ipad);
    inner.update(message);
    let inner_hash = inner.finalize();
    let mut outer = Sha256::new();
    outer.update(opad);
    outer.update(inner_hash);
    let result = outer.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&result);
    out
}

/// Stable JSON for MAC — key order fixed; nulls for optional absences (matches TS).
pub fn canonical_offline_pack_payload(
    schema: &str,
    profile_id_hint: &str,
    created_at_unix_ms: u64,
    expires_at_unix_ms: Option<u64>,
    envelopes: &[OfflinePackEnvelopeWireV1],
) -> Result<String, String> {
    let mut env_arr = Vec::with_capacity(envelopes.len());
    for env in envelopes {
        let audience = serde_json::to_value(&env.audience).map_err(|e| e.to_string())?;
        env_arr.push(serde_json::json!({
            "envelopeId": env.envelope_id,
            "correlationId": env.correlation_id,
            "profileId": env.profile_id,
            "messageScope": env.message_scope,
            "audience": audience,
            "ciphertextBase64": env.ciphertext_base64,
            "evidenceClass": env.evidence_class,
            "createdAtUnixMs": env.created_at_unix_ms,
            "ttlMs": env.ttl_ms,
            "priority": env.priority,
        }));
    }
    let payload = serde_json::json!({
        "schema": schema,
        "profileIdHint": profile_id_hint,
        "createdAtUnixMs": created_at_unix_ms,
        "expiresAtUnixMs": expires_at_unix_ms,
        "envelopes": env_arr,
    });
    // serde_json::json! / Map preserve insertion order; to_string matches JSON.stringify spacing.
    serde_json::to_string(&payload).map_err(|e| e.to_string())
}

pub fn encode_offline_pack(
    profile_id_hint: &str,
    envelopes: &[OfflinePackEnvelopeWireV1],
    pack_key_hex: &str,
    created_at_unix_ms: Option<u64>,
    expires_at_unix_ms: Option<u64>,
) -> Result<OfflinePackWireV1, (OfflinePackRejectReason, Option<String>)> {
    let key = hex_to_bytes(pack_key_hex).filter(|k| !k.is_empty()).ok_or((
        OfflinePackRejectReason::PackKeyRequired,
        None,
    ))?;
    if envelopes.is_empty() {
        return Err((OfflinePackRejectReason::PackEmpty, None));
    }
    let hint = profile_id_hint.trim();
    if hint.is_empty() {
        return Err((
            OfflinePackRejectReason::ProfileScopeMismatch,
            Some("profile_id_hint_required".into()),
        ));
    }
    let created = created_at_unix_ms.unwrap_or_else(now_unix_ms);
    if created == 0 {
        return Err((OfflinePackRejectReason::CreatedAtInvalid, None));
    }

    for env in envelopes {
        if env.envelope_id.trim().is_empty() || env.profile_id.trim().is_empty() {
            return Err((OfflinePackRejectReason::EnvelopeInvalid, None));
        }
        if env.ciphertext_base64.trim().is_empty() {
            return Err((OfflinePackRejectReason::CiphertextEmpty, None));
        }
        if env.created_at_unix_ms == 0 {
            return Err((OfflinePackRejectReason::CreatedAtInvalid, None));
        }
    }

    let canonical = canonical_offline_pack_payload(
        OBSCUR_OFFLINE_PACK_V1,
        hint,
        created,
        expires_at_unix_ms,
        envelopes,
    )
    .map_err(|e| (OfflinePackRejectReason::SchemaInvalid, Some(e)))?;

    let mac = bytes_to_hex(&hmac_sha256(&key, canonical.as_bytes()));
    Ok(OfflinePackWireV1 {
        schema: OBSCUR_OFFLINE_PACK_V1.into(),
        profile_id_hint: hint.to_string(),
        created_at_unix_ms: created,
        expires_at_unix_ms,
        envelopes: envelopes.to_vec(),
        pack_mac: mac,
    })
}

pub fn decode_offline_pack(
    value: &serde_json::Value,
) -> Result<OfflinePackWireV1, (OfflinePackRejectReason, Option<String>)> {
    let obj = value
        .as_object()
        .ok_or((OfflinePackRejectReason::SchemaInvalid, None))?;
    let schema = obj
        .get("schema")
        .and_then(|v| v.as_str())
        .ok_or((OfflinePackRejectReason::SchemaInvalid, None))?;
    if schema != OBSCUR_OFFLINE_PACK_V1 {
        return Err((OfflinePackRejectReason::SchemaInvalid, None));
    }
    let hint = obj
        .get("profileIdHint")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or((
            OfflinePackRejectReason::ProfileScopeMismatch,
            Some("profile_id_hint_required".into()),
        ))?;
    let created = obj
        .get("createdAtUnixMs")
        .and_then(|v| v.as_u64())
        .filter(|n| *n > 0)
        .ok_or((OfflinePackRejectReason::CreatedAtInvalid, None))?;
    let expires = match obj.get("expiresAtUnixMs") {
        None | Some(serde_json::Value::Null) => None,
        Some(v) => Some(
            v.as_u64()
                .ok_or((OfflinePackRejectReason::SchemaInvalid, Some("expires_at_invalid".into())))?,
        ),
    };
    let envelopes_val = obj
        .get("envelopes")
        .and_then(|v| v.as_array())
        .ok_or((OfflinePackRejectReason::PackEmpty, None))?;
    if envelopes_val.is_empty() {
        return Err((OfflinePackRejectReason::PackEmpty, None));
    }
    let pack_mac = obj
        .get("packMac")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_lowercase())
        .filter(|s| hex_to_bytes(s).is_some())
        .ok_or((OfflinePackRejectReason::PackMacInvalid, None))?;

    let mut envelopes = Vec::with_capacity(envelopes_val.len());
    for item in envelopes_val {
        let env: OfflinePackEnvelopeWireV1 = serde_json::from_value(item.clone()).map_err(|_| {
            (OfflinePackRejectReason::EnvelopeInvalid, None)
        })?;
        if env.envelope_id.trim().is_empty() || env.profile_id.trim().is_empty() {
            return Err((OfflinePackRejectReason::EnvelopeInvalid, None));
        }
        if env.ciphertext_base64.trim().is_empty() {
            return Err((OfflinePackRejectReason::CiphertextEmpty, None));
        }
        if env.created_at_unix_ms == 0 {
            return Err((OfflinePackRejectReason::CreatedAtInvalid, None));
        }
        envelopes.push(env);
    }

    Ok(OfflinePackWireV1 {
        schema: OBSCUR_OFFLINE_PACK_V1.into(),
        profile_id_hint: hint.to_string(),
        created_at_unix_ms: created,
        expires_at_unix_ms: expires,
        envelopes,
        pack_mac,
    })
}

pub fn verify_offline_pack_for_import(
    pack: &OfflinePackWireV1,
    profile_id: &str,
    pack_key_hex: &str,
    now_unix_ms: Option<u64>,
) -> Result<Vec<OfflinePackEnvelopeWireV1>, (OfflinePackRejectReason, Option<String>)> {
    let key = hex_to_bytes(pack_key_hex).filter(|k| !k.is_empty()).ok_or((
        OfflinePackRejectReason::PackKeyRequired,
        None,
    ))?;
    let profile_id = profile_id.trim();
    if profile_id.is_empty() {
        return Err((
            OfflinePackRejectReason::ProfileScopeMismatch,
            Some("profile_id_required".into()),
        ));
    }
    if pack.profile_id_hint.trim() != profile_id {
        return Err((
            OfflinePackRejectReason::ProfileScopeMismatch,
            Some("hint_mismatch".into()),
        ));
    }
    let now = now_unix_ms.unwrap_or_else(self::now_unix_ms);
    if let Some(exp) = pack.expires_at_unix_ms {
        if exp > 0 && now > exp {
            return Err((OfflinePackRejectReason::PackExpired, None));
        }
    }

    let canonical = canonical_offline_pack_payload(
        &pack.schema,
        &pack.profile_id_hint,
        pack.created_at_unix_ms,
        pack.expires_at_unix_ms,
        &pack.envelopes,
    )
    .map_err(|e| (OfflinePackRejectReason::SchemaInvalid, Some(e)))?;
    let expected = bytes_to_hex(&hmac_sha256(&key, canonical.as_bytes()));
    if expected != pack.pack_mac.trim().to_lowercase() {
        return Err((OfflinePackRejectReason::PackMacInvalid, None));
    }

    let mut out = Vec::with_capacity(pack.envelopes.len());
    for env in &pack.envelopes {
        if env.profile_id.trim() != profile_id {
            return Err((
                OfflinePackRejectReason::ProfileScopeMismatch,
                Some("envelope_profile_mismatch".into()),
            ));
        }
        out.push(env.clone());
    }
    if out.is_empty() {
        return Err((OfflinePackRejectReason::PackEmpty, None));
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonical_payload_shape_includes_nulls() {
        let env = OfflinePackEnvelopeWireV1 {
            envelope_id: "env-offline-1".into(),
            correlation_id: None,
            profile_id: "profile-a".into(),
            message_scope: "dm".into(),
            audience: audience_dm("abc123"),
            ciphertext_base64: "CQgHBg==".into(),
            evidence_class: "accepted_when_imported".into(),
            created_at_unix_ms: 1_700_000_000_000,
            ttl_ms: None,
            priority: None,
        };
        let canonical = canonical_offline_pack_payload(
            OBSCUR_OFFLINE_PACK_V1,
            "profile-a",
            1_700_000_000_000,
            Some(1_800_000_000_000),
            &[env],
        )
        .unwrap();
        assert!(canonical.contains("\"correlationId\":null"));
        assert!(canonical.contains("\"ttlMs\":null"));
        assert!(canonical.contains("\"priority\":null"));
        assert!(canonical.contains("\"kind\":\"dm\""));
        assert!(canonical.contains("\"recipientPublicKeyHex\":\"abc123\""));
    }

    #[test]
    fn reject_tampered_mac() {
        let env = OfflinePackEnvelopeWireV1 {
            envelope_id: "env-offline-1".into(),
            correlation_id: None,
            profile_id: "profile-a".into(),
            message_scope: "dm".into(),
            audience: audience_dm("abc123"),
            ciphertext_base64: "CQgHBg==".into(),
            evidence_class: "accepted_when_imported".into(),
            created_at_unix_ms: 1_700_000_000_000,
            ttl_ms: None,
            priority: None,
        };
        let mut pack = encode_offline_pack(
            "profile-a",
            &[env],
            &"07".repeat(32),
            Some(1_700_000_000_000),
            None,
        )
        .unwrap();
        pack.pack_mac = "aa".repeat(32);
        let err = verify_offline_pack_for_import(
            &pack,
            "profile-a",
            &"07".repeat(32),
            Some(1_700_000_100_000),
        )
        .unwrap_err();
        assert_eq!(err.0, OfflinePackRejectReason::PackMacInvalid);
    }
}
