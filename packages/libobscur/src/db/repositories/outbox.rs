//! Cut 0.7 — durable outbox + honest home-ACK status machine.
//!
//! Home ACK → `accepted` only. Never map home OK → `delivered`.
//!
//! @see specs/backend/cut0-account-spine-design-2026-11-09.md §6 / slice 0.7
//! @see docs/exploration/feasibility/24-messaging-plane-skim.md

use crate::db::Database;
use rusqlite::{params, OptionalExtension, Result};
use serde::{Deserialize, Serialize};

/// Canonical delivery statuses (Cut 0 freeze).
pub mod message_status {
    pub const SENDING: &str = "sending";
    pub const QUEUED: &str = "queued";
    pub const ACCEPTED: &str = "accepted";
    pub const REJECTED: &str = "rejected";
    pub const DELIVERED: &str = "delivered";
    pub const FAILED: &str = "failed";

    pub const ALL: &[&str] = &[SENDING, QUEUED, ACCEPTED, REJECTED, DELIVERED, FAILED];

    pub fn is_valid(status: &str) -> bool {
        ALL.contains(&status)
    }
}

/// Pure transition table (local / peer confirms). Home ACK uses [`transition_on_home_ack`].
pub fn is_valid_status_transition(from: &str, to: &str) -> bool {
    match (from, to) {
        (message_status::SENDING, message_status::ACCEPTED)
        | (message_status::SENDING, message_status::REJECTED)
        | (message_status::SENDING, message_status::QUEUED)
        | (message_status::SENDING, message_status::FAILED)
        | (message_status::QUEUED, message_status::SENDING)
        | (message_status::QUEUED, message_status::FAILED)
        | (message_status::REJECTED, message_status::QUEUED)
        | (message_status::REJECTED, message_status::FAILED)
        | (message_status::ACCEPTED, message_status::DELIVERED)
        | (message_status::FAILED, message_status::QUEUED)
        | (message_status::FAILED, message_status::SENDING) => true,
        _ => false,
    }
}

/// Home / H-dc ACK honesty: always `accepted`. Rejects `delivered` from this path.
pub fn transition_on_home_ack(current: &str) -> Result<&'static str, String> {
    match current {
        message_status::SENDING
        | message_status::QUEUED
        | message_status::REJECTED
        | message_status::FAILED
        | message_status::ACCEPTED => Ok(message_status::ACCEPTED),
        message_status::DELIVERED => Ok(message_status::DELIVERED), // already peer-confirmed; leave
        other => Err(format!("cannot apply home ACK from status {other}")),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OutboxRecord {
    pub message_event_id: String,
    pub profile_id: String,
    pub conversation_id: String,
    pub next_attempt_at: i64,
    pub attempt_count: i64,
    pub last_error: Option<String>,
}

fn now_unix_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

impl Database {
    pub fn enqueue_outbox(&self, row: &OutboxRecord) -> Result<()> {
        self.ensure_profile_slot(&row.profile_id, &row.profile_id)?;
        let next = if row.next_attempt_at > 0 {
            row.next_attempt_at
        } else {
            now_unix_ms()
        };
        self.conn.execute(
            "INSERT INTO outbox (message_event_id, profile_id, conversation_id, next_attempt_at, attempt_count, last_error)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(message_event_id, profile_id) DO UPDATE SET
               conversation_id = excluded.conversation_id,
               next_attempt_at = excluded.next_attempt_at,
               attempt_count = excluded.attempt_count,
               last_error = excluded.last_error",
            params![
                row.message_event_id,
                row.profile_id,
                row.conversation_id,
                next,
                row.attempt_count,
                row.last_error
            ],
        )?;
        Ok(())
    }

    pub fn get_outbox(
        &self,
        profile_id: &str,
        message_event_id: &str,
    ) -> Result<Option<OutboxRecord>> {
        self.conn
            .query_row(
                "SELECT message_event_id, profile_id, conversation_id, next_attempt_at, attempt_count, last_error
                 FROM outbox
                 WHERE profile_id = ?1 AND message_event_id = ?2",
                params![profile_id, message_event_id],
                |row| {
                    Ok(OutboxRecord {
                        message_event_id: row.get(0)?,
                        profile_id: row.get(1)?,
                        conversation_id: row.get(2)?,
                        next_attempt_at: row.get(3)?,
                        attempt_count: row.get(4)?,
                        last_error: row.get(5)?,
                    })
                },
            )
            .optional()
    }

    pub fn list_outbox_due(
        &self,
        profile_id: &str,
        now_ms: i64,
        limit: i64,
    ) -> Result<Vec<OutboxRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT message_event_id, profile_id, conversation_id, next_attempt_at, attempt_count, last_error
             FROM outbox
             WHERE profile_id = ?1 AND next_attempt_at <= ?2
             ORDER BY next_attempt_at ASC
             LIMIT ?3",
        )?;
        let rows = stmt.query_map(params![profile_id, now_ms, limit], |row| {
            Ok(OutboxRecord {
                message_event_id: row.get(0)?,
                profile_id: row.get(1)?,
                conversation_id: row.get(2)?,
                next_attempt_at: row.get(3)?,
                attempt_count: row.get(4)?,
                last_error: row.get(5)?,
            })
        })?;
        rows.collect()
    }

    pub fn bump_outbox_attempt(
        &self,
        profile_id: &str,
        message_event_id: &str,
        next_attempt_at: i64,
        last_error: Option<&str>,
    ) -> Result<()> {
        self.conn.execute(
            "UPDATE outbox
             SET attempt_count = attempt_count + 1,
                 next_attempt_at = ?1,
                 last_error = ?2
             WHERE profile_id = ?3 AND message_event_id = ?4",
            params![next_attempt_at, last_error, profile_id, message_event_id],
        )?;
        Ok(())
    }

    pub fn remove_outbox(&self, profile_id: &str, message_event_id: &str) -> Result<()> {
        self.conn.execute(
            "DELETE FROM outbox WHERE profile_id = ?1 AND message_event_id = ?2",
            params![profile_id, message_event_id],
        )?;
        Ok(())
    }

    /// Set message delivery status with transition check.
    pub fn set_message_status(
        &self,
        profile_id: &str,
        message_event_id: &str,
        to_status: &str,
    ) -> Result<()> {
        if !message_status::is_valid(to_status) {
            return Err(rusqlite::Error::InvalidParameterName(format!(
                "invalid message status: {to_status}"
            )));
        }
        let current: String = self
            .conn
            .query_row(
                "SELECT status FROM messages WHERE event_id = ?1 AND profile_id = ?2",
                params![message_event_id, profile_id],
                |row| row.get(0),
            )
            .unwrap_or_else(|_| message_status::SENDING.to_string());
        if current != to_status && !is_valid_status_transition(&current, to_status) {
            return Err(rusqlite::Error::InvalidParameterName(format!(
                "invalid status transition {current} → {to_status}"
            )));
        }
        self.conn.execute(
            "UPDATE messages SET status = ?1 WHERE event_id = ?2 AND profile_id = ?3",
            params![to_status, message_event_id, profile_id],
        )?;
        Ok(())
    }

    /// Apply thin H-dc home ACK: status → accepted, record home id, drop outbox row.
    /// Refuses to mark `delivered` from this path.
    pub fn apply_home_ack(
        &self,
        profile_id: &str,
        message_event_id: &str,
        home_message_id: &str,
    ) -> Result<()> {
        if home_message_id.trim().is_empty() {
            return Err(rusqlite::Error::InvalidParameterName(
                "home_message_id empty".to_string(),
            ));
        }
        let current: String = self
            .conn
            .query_row(
                "SELECT status FROM messages WHERE event_id = ?1 AND profile_id = ?2",
                params![message_event_id, profile_id],
                |row| row.get(0),
            )
            .unwrap_or_else(|_| message_status::SENDING.to_string());
        let next = transition_on_home_ack(&current).map_err(|e| {
            rusqlite::Error::InvalidParameterName(e)
        })?;
        // Explicit honesty guard — never write delivered from home ACK.
        if next == message_status::DELIVERED && current != message_status::DELIVERED {
            return Err(rusqlite::Error::InvalidParameterName(
                "home ACK must not set delivered".to_string(),
            ));
        }
        self.conn.execute(
            "UPDATE messages
             SET status = ?1, home_message_id = ?2
             WHERE event_id = ?3 AND profile_id = ?4",
            params![next, home_message_id, message_event_id, profile_id],
        )?;
        self.remove_outbox(profile_id, message_event_id)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::repositories::MessageRecord;
    use crate::db::Database;

    fn seed_sending(db: &Database, event_id: &str) {
        db.ensure_profile_slot("pa", "pa").unwrap();
        db.insert_message(&MessageRecord {
            event_id: event_id.into(),
            profile_id: "pa".into(),
            conversation_id: "c1".into(),
            sender_pubkey: "pa".into(),
            recipient_pubkey: "pb".into(),
            plaintext: "hi".into(),
            kind: 14,
            created_at: 1,
            received_at: 1,
            is_outgoing: true,
            reply_to_event_id: None,
            has_attachment: false,
        })
        .unwrap();
        // Default schema status is 'accepted' — force sending for outbox path.
        db.conn
            .execute(
                "UPDATE messages SET status = 'sending' WHERE event_id = ?1 AND profile_id = 'pa'",
                params![event_id],
            )
            .unwrap();
    }

    #[test]
    fn home_ack_transition_never_delivered() {
        assert_eq!(
            transition_on_home_ack(message_status::SENDING).unwrap(),
            message_status::ACCEPTED
        );
        assert_eq!(
            transition_on_home_ack(message_status::QUEUED).unwrap(),
            message_status::ACCEPTED
        );
        assert!(!is_valid_status_transition(
            message_status::SENDING,
            message_status::DELIVERED
        ));
    }

    #[test]
    fn enqueue_list_due_bump() {
        let db = Database::new(None).unwrap();
        db.ensure_profile_slot("pa", "pa").unwrap();
        db.enqueue_outbox(&OutboxRecord {
            message_event_id: "e1".into(),
            profile_id: "pa".into(),
            conversation_id: "c1".into(),
            next_attempt_at: 10,
            attempt_count: 0,
            last_error: None,
        })
        .unwrap();
        assert_eq!(db.list_outbox_due("pa", 5, 10).unwrap().len(), 0);
        assert_eq!(db.list_outbox_due("pa", 10, 10).unwrap().len(), 1);
        db.bump_outbox_attempt("pa", "e1", 50, Some("timeout"))
            .unwrap();
        let row = db.get_outbox("pa", "e1").unwrap().unwrap();
        assert_eq!(row.attempt_count, 1);
        assert_eq!(row.next_attempt_at, 50);
        assert_eq!(row.last_error.as_deref(), Some("timeout"));
    }

    #[test]
    fn apply_home_ack_sets_accepted_and_clears_outbox() {
        let db = Database::new(None).unwrap();
        seed_sending(&db, "e1");
        db.enqueue_outbox(&OutboxRecord {
            message_event_id: "e1".into(),
            profile_id: "pa".into(),
            conversation_id: "c1".into(),
            next_attempt_at: 1,
            attempt_count: 0,
            last_error: None,
        })
        .unwrap();
        db.apply_home_ack("pa", "e1", "home-99").unwrap();
        assert!(db.get_outbox("pa", "e1").unwrap().is_none());
        let status: String = db
            .conn
            .query_row(
                "SELECT status FROM messages WHERE event_id = 'e1' AND profile_id = 'pa'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let home: String = db
            .conn
            .query_row(
                "SELECT home_message_id FROM messages WHERE event_id = 'e1' AND profile_id = 'pa'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(status, message_status::ACCEPTED);
        assert_eq!(home, "home-99");
        assert_ne!(status, message_status::DELIVERED);
    }

    #[test]
    fn set_message_status_rejects_sending_to_delivered() {
        let db = Database::new(None).unwrap();
        seed_sending(&db, "e2");
        let err = db
            .set_message_status("pa", "e2", message_status::DELIVERED)
            .unwrap_err();
        assert!(err.to_string().contains("invalid status transition"));
    }
}
