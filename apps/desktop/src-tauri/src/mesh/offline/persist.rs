//! Persist imported offline envelopes into dm-engine (RUST-6c).
//! Receipt plaintext only — ciphertext remains in the pack / envelope wire.

use super::pack::OfflinePackEnvelopeWireV1;
use libobscur::db::repositories::{ConversationRecord, MessageRecord};
use libobscur::db::Database;

pub const OFFLINE_IMPORT_CONVERSATION_ID: &str = "dm:offline-import";

/// Lab / product receipt visible in `dm.getThread` after sneakernet import.
pub fn offline_import_receipt_plaintext(envelope_id: &str) -> String {
    format!("[imported_offline] envelope={envelope_id}")
}

pub fn persist_imported_to_dm(
    db: &Database,
    profile_id: &str,
    envelopes: &[OfflinePackEnvelopeWireV1],
) -> Result<usize, String> {
    let profile_id = profile_id.trim();
    if profile_id.is_empty() {
        return Err("profile_id_required".into());
    }
    if envelopes.is_empty() {
        return Err("pack_empty".into());
    }

    let mut inserted = 0usize;
    let mut last_event_id = String::new();
    let mut last_at: i64 = 0;
    let mut last_preview = String::new();

    for env in envelopes {
        if env.profile_id.trim() != profile_id {
            return Err("envelope_profile_mismatch".into());
        }
        let plaintext = offline_import_receipt_plaintext(&env.envelope_id);
        let created_at = (env.created_at_unix_ms / 1000) as i64;
        let received_at = env.created_at_unix_ms as i64;
        let peer = match &env.audience {
            super::pack::OfflinePackAudience::Dm {
                recipient_public_key_hex,
            } => recipient_public_key_hex.clone(),
            _ => "offline-import".into(),
        };
        // Pad/truncate to 64 hex for ensure_profile / peer conventions when short lab keys.
        let peer_pubkey = normalize_pubkey_hex(&peer);
        let sender_pubkey = normalize_pubkey_hex("offline-sender");

        let msg = MessageRecord {
            event_id: format!("offline:{}", env.envelope_id),
            profile_id: profile_id.to_string(),
            conversation_id: OFFLINE_IMPORT_CONVERSATION_ID.to_string(),
            sender_pubkey,
            recipient_pubkey: peer_pubkey,
            plaintext: plaintext.clone(),
            kind: 4,
            created_at,
            received_at,
            is_outgoing: false,
            reply_to_event_id: None,
            has_attachment: false,
        };
        db.insert_message(&msg).map_err(|e| e.to_string())?;
        inserted += 1;
        last_event_id = msg.event_id.clone();
        last_at = received_at;
        last_preview = plaintext;
    }

    let conversation = ConversationRecord {
        id: OFFLINE_IMPORT_CONVERSATION_ID.to_string(),
        profile_id: profile_id.to_string(),
        peer_pubkey: normalize_pubkey_hex("offline-import"),
        last_event_id: Some(last_event_id),
        last_message_at: Some(last_at),
        last_plaintext_preview: Some(last_preview),
        unread_count: inserted as u32,
    };
    db.upsert_conversation(&conversation)
        .map_err(|e| e.to_string())?;

    Ok(inserted)
}

fn normalize_pubkey_hex(raw: &str) -> String {
    let trimmed = raw.trim().to_lowercase();
    let mut hex: String = trimmed.chars().filter(|c| c.is_ascii_hexdigit()).collect();
    if hex.len() >= 64 {
        return hex.chars().take(64).collect();
    }
    while hex.len() < 64 {
        hex.push('0');
    }
    hex
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mesh::offline::pack::audience_dm;

    #[test]
    fn persist_round_trips_via_get_thread() {
        let db = Database::new(None).unwrap();
        let profile = "bob";
        db.ensure_profile_slot(
            profile,
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        )
        .unwrap();
        let env = OfflinePackEnvelopeWireV1 {
            envelope_id: "env-l3-1".into(),
            correlation_id: None,
            profile_id: profile.into(),
            message_scope: "dm".into(),
            audience: audience_dm("abc123"),
            ciphertext_base64: "CQgHBg==".into(),
            evidence_class: "accepted_when_imported".into(),
            created_at_unix_ms: 1_700_000_000_000,
            ttl_ms: None,
            priority: None,
        };
        let n = persist_imported_to_dm(&db, profile, &[env]).unwrap();
        assert_eq!(n, 1);
        let rows = db
            .get_messages_by_conversation(profile, OFFLINE_IMPORT_CONVERSATION_ID, 10, None)
            .unwrap();
        assert_eq!(rows.len(), 1);
        assert!(rows[0].plaintext.contains("imported_offline"));
        assert!(rows[0].plaintext.contains("env-l3-1"));
    }
}
