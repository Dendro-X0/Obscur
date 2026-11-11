//! Cut 0 glue — seal T3 payload, enqueue outbox, complete home ACK.
//! Transport POST stays in the H-dc client (TS); this module owns local durability.
//!
//! @see specs/backend/cut0-private-trust-glue-design-2026-11-09.md

use crate::db::repositories::{
    message_status, DrSessionRecord, MessageRecord, OutboxRecord,
};
use crate::db::Database;
use crate::protocol::e2ee::t3_hdc::{
    decode_ratchet_blob, encode_ratchet_blob, seal_t3_hdc_envelope,
};
use crate::protocol::types::RatchetChainState;
use rand::RngCore;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct T3OutboundPrepared {
    pub client_message_id: String,
    pub conversation_id: String,
    pub envelope: String,
    pub status: String,
}

fn now_unix_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn random_hex_32() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    hex::encode(bytes)
}

fn fresh_local_ratchet() -> RatchetChainState {
    RatchetChainState {
        root_key_hex: random_hex_32(),
        sending_chain_key_hex: random_hex_32(),
        receiving_chain_key_hex: random_hex_32(),
        send_counter: 0,
        recv_counter: 0,
        previous_message_counter: None,
    }
}

fn load_or_init_dr(
    db: &Database,
    profile_id: &str,
    conversation_id: &str,
    peer_pubkey: &str,
) -> Result<RatchetChainState, String> {
    if let Some(row) = db
        .get_dr_session(profile_id, conversation_id)
        .map_err(|e| e.to_string())?
    {
        return decode_ratchet_blob(&row.session_blob);
    }
    let state = fresh_local_ratchet();
    db.upsert_dr_session(&DrSessionRecord {
        conversation_id: conversation_id.to_string(),
        profile_id: profile_id.to_string(),
        peer_pubkey: peer_pubkey.to_string(),
        session_blob: encode_ratchet_blob(&state)?,
        updated_at: now_unix_ms(),
    })
    .map_err(|e| e.to_string())?;
    Ok(state)
}

/// Seal plaintext, persist advanced DR blob, insert local message (sending), enqueue outbox.
pub fn prepare_t3_outbound(
    db: &Database,
    profile_id: &str,
    conversation_id: &str,
    peer_pubkey: &str,
    plaintext: &[u8],
) -> Result<T3OutboundPrepared, String> {
    if conversation_id.trim().is_empty() {
        return Err("conversation_id empty".to_string());
    }
    if peer_pubkey.trim().is_empty() {
        return Err("peer_pubkey empty".to_string());
    }
    if plaintext.is_empty() {
        return Err("plaintext empty".to_string());
    }

    let mut state = load_or_init_dr(db, profile_id, conversation_id, peer_pubkey)?;
    let envelope = seal_t3_hdc_envelope(&mut state, plaintext)?;
    db.upsert_dr_session(&DrSessionRecord {
        conversation_id: conversation_id.to_string(),
        profile_id: profile_id.to_string(),
        peer_pubkey: peer_pubkey.to_string(),
        session_blob: encode_ratchet_blob(&state)?,
        updated_at: now_unix_ms(),
    })
    .map_err(|e| e.to_string())?;

    let client_message_id = format!("t3-{}", random_hex_32());
    let ts = now_unix_ms();
    db.insert_message(&MessageRecord {
        event_id: client_message_id.clone(),
        profile_id: profile_id.to_string(),
        conversation_id: conversation_id.to_string(),
        sender_pubkey: profile_id.to_string(),
        recipient_pubkey: peer_pubkey.to_string(),
        plaintext: String::from_utf8_lossy(plaintext).into_owned(),
        kind: 14,
        created_at: ts,
        received_at: ts,
        is_outgoing: true,
        reply_to_event_id: None,
        has_attachment: false,
    })
    .map_err(|e| e.to_string())?;
    db.conn
        .execute(
            "UPDATE messages SET status = ?1 WHERE event_id = ?2 AND profile_id = ?3",
            rusqlite::params![message_status::SENDING, client_message_id, profile_id],
        )
        .map_err(|e| e.to_string())?;

    db.enqueue_outbox(&OutboxRecord {
        message_event_id: client_message_id.clone(),
        profile_id: profile_id.to_string(),
        conversation_id: conversation_id.to_string(),
        next_attempt_at: ts,
        attempt_count: 0,
        last_error: None,
    })
    .map_err(|e| e.to_string())?;

    Ok(T3OutboundPrepared {
        client_message_id,
        conversation_id: conversation_id.to_string(),
        envelope,
        status: message_status::SENDING.to_string(),
    })
}

pub fn complete_t3_home_ack(
    db: &Database,
    profile_id: &str,
    client_message_id: &str,
    home_message_id: &str,
) -> Result<(), String> {
    db.apply_home_ack(profile_id, client_message_id, home_message_id)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::repositories::message_status;

    #[test]
    fn prepare_then_home_ack_clears_outbox() {
        let db = Database::new(None).unwrap();
        let prepared = prepare_t3_outbound(
            &db,
            "pa",
            "c1",
            "peer",
            b"hello-private-trust",
        )
        .unwrap();
        assert_eq!(prepared.status, message_status::SENDING);
        assert!(!prepared.envelope.is_empty());
        assert!(db
            .get_outbox("pa", &prepared.client_message_id)
            .unwrap()
            .is_some());

        complete_t3_home_ack(&db, "pa", &prepared.client_message_id, "home-1").unwrap();
        assert!(db
            .get_outbox("pa", &prepared.client_message_id)
            .unwrap()
            .is_none());
        let status: String = db
            .conn
            .query_row(
                "SELECT status FROM messages WHERE event_id = ?1 AND profile_id = 'pa'",
                rusqlite::params![prepared.client_message_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(status, message_status::ACCEPTED);
        assert_ne!(status, message_status::DELIVERED);
    }
}
