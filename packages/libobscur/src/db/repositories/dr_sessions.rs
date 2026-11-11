//! Cut 0.8 — opaque T3 Double Ratchet session blobs (`dr_session`).
//!
//! @see specs/backend/cut0-account-spine-design-2026-11-09.md §8

use crate::db::Database;
use rusqlite::{params, OptionalExtension, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DrSessionRecord {
    pub conversation_id: String,
    pub profile_id: String,
    pub peer_pubkey: String,
    pub session_blob: Vec<u8>,
    pub updated_at: i64,
}

fn now_unix_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn normalize_peer(peer_pubkey: &str) -> String {
    peer_pubkey.trim().to_lowercase()
}

impl Database {
    pub fn upsert_dr_session(&self, row: &DrSessionRecord) -> Result<()> {
        if row.session_blob.is_empty() {
            return Err(rusqlite::Error::InvalidParameterName(
                "dr_session.session_blob empty".to_string(),
            ));
        }
        self.ensure_profile_slot(&row.profile_id, &row.profile_id)?;
        let updated_at = if row.updated_at > 0 {
            row.updated_at
        } else {
            now_unix_ms()
        };
        self.conn.execute(
            "INSERT INTO dr_session (conversation_id, profile_id, peer_pubkey, session_blob, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(conversation_id, profile_id) DO UPDATE SET
               peer_pubkey = excluded.peer_pubkey,
               session_blob = excluded.session_blob,
               updated_at = excluded.updated_at",
            params![
                row.conversation_id,
                row.profile_id,
                normalize_peer(&row.peer_pubkey),
                row.session_blob,
                updated_at
            ],
        )?;
        Ok(())
    }

    pub fn get_dr_session(
        &self,
        profile_id: &str,
        conversation_id: &str,
    ) -> Result<Option<DrSessionRecord>> {
        self.conn
            .query_row(
                "SELECT conversation_id, profile_id, peer_pubkey, session_blob, updated_at
                 FROM dr_session
                 WHERE profile_id = ?1 AND conversation_id = ?2",
                params![profile_id, conversation_id],
                |row| {
                    Ok(DrSessionRecord {
                        conversation_id: row.get(0)?,
                        profile_id: row.get(1)?,
                        peer_pubkey: row.get(2)?,
                        session_blob: row.get(3)?,
                        updated_at: row.get(4)?,
                    })
                },
            )
            .optional()
    }

    pub fn delete_dr_session(&self, profile_id: &str, conversation_id: &str) -> Result<()> {
        self.conn.execute(
            "DELETE FROM dr_session WHERE profile_id = ?1 AND conversation_id = ?2",
            params![profile_id, conversation_id],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use crate::protocol::e2ee::t3_hdc::{
        decode_ratchet_blob, encode_ratchet_blob, open_t3_hdc_envelope, seal_t3_hdc_envelope,
    };
    use crate::protocol::types::RatchetChainState;

    fn mirrored_pair() -> (RatchetChainState, RatchetChainState) {
        let send = "11".repeat(32);
        let recv = "22".repeat(32);
        let root = "33".repeat(32);
        (
            RatchetChainState {
                root_key_hex: root.clone(),
                sending_chain_key_hex: send.clone(),
                receiving_chain_key_hex: recv.clone(),
                send_counter: 0,
                recv_counter: 0,
                previous_message_counter: None,
            },
            RatchetChainState {
                root_key_hex: root,
                sending_chain_key_hex: recv,
                receiving_chain_key_hex: send,
                send_counter: 0,
                recv_counter: 0,
                previous_message_counter: None,
            },
        )
    }

    #[test]
    fn persist_seal_reload_open() {
        let db = Database::new(None).unwrap();
        let (alice, mut bob) = mirrored_pair();
        db.upsert_dr_session(&DrSessionRecord {
            conversation_id: "c1".into(),
            profile_id: "pa".into(),
            peer_pubkey: "PB".into(),
            session_blob: encode_ratchet_blob(&alice).unwrap(),
            updated_at: 0,
        })
        .unwrap();

        let stored = db.get_dr_session("pa", "c1").unwrap().unwrap();
        assert_eq!(stored.peer_pubkey, "pb");
        let mut alice2 = decode_ratchet_blob(&stored.session_blob).unwrap();
        let envelope = seal_t3_hdc_envelope(&mut alice2, b"hdc-t3").unwrap();
        db.upsert_dr_session(&DrSessionRecord {
            conversation_id: "c1".into(),
            profile_id: "pa".into(),
            peer_pubkey: "pb".into(),
            session_blob: encode_ratchet_blob(&alice2).unwrap(),
            updated_at: 0,
        })
        .unwrap();

        let plain = open_t3_hdc_envelope(&mut bob, &envelope).unwrap();
        assert_eq!(plain, b"hdc-t3");
    }
}
