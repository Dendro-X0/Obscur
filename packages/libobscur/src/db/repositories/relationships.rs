//! Cut 0.5 — sticky CRM `relationship_edge` ports (F1).
//!
//! Edges are authored only via explicit upsert/remove — **never** invented from
//! message lookback / relay history (Soft L3 remains paused / unclaimed).
//!
//! @see specs/backend/cut0-account-spine-design-2026-11-09.md §6 / slice 0.5
//! @see docs/exploration/feasibility/01-relationship-authority.md

use crate::db::Database;
use rusqlite::{params, OptionalExtension, Result};
use serde::{Deserialize, Serialize};

/// Canonical relationship states for Cut 0 CRM.
pub mod relationship_state {
    pub const NONE: &str = "none";
    pub const PENDING: &str = "pending";
    pub const TRUSTED: &str = "trusted";
    pub const BLOCKED: &str = "blocked";
    pub const MUTED: &str = "muted";
    pub const REMOVED: &str = "removed";

    pub const ALL: &[&str] = &[NONE, PENDING, TRUSTED, BLOCKED, MUTED, REMOVED];

    pub fn is_valid(state: &str) -> bool {
        ALL.contains(&state)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RelationshipEdgeRecord {
    pub profile_id: String,
    pub peer_pubkey: String,
    pub state: String,
    pub trust_tier: Option<String>,
    pub updated_at: i64,
}

fn now_unix_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn normalize_peer_pubkey(peer_pubkey: &str) -> String {
    peer_pubkey.trim().to_lowercase()
}

impl Database {
    /// Upsert a sticky CRM edge. Rejects unknown states. Does not scan messages.
    pub fn upsert_relationship_edge(&self, edge: &RelationshipEdgeRecord) -> Result<()> {
        if !relationship_state::is_valid(&edge.state) {
            return Err(rusqlite::Error::InvalidParameterName(format!(
                "invalid relationship_edge.state: {}",
                edge.state
            )));
        }
        let peer = normalize_peer_pubkey(&edge.peer_pubkey);
        if peer.is_empty() {
            return Err(rusqlite::Error::InvalidParameterName(
                "relationship_edge.peer_pubkey empty".to_string(),
            ));
        }
        self.ensure_profile_slot(&edge.profile_id, &edge.profile_id)?;
        let updated_at = if edge.updated_at > 0 {
            edge.updated_at
        } else {
            now_unix_ms()
        };
        self.conn.execute(
            "INSERT INTO relationship_edge (profile_id, peer_pubkey, state, trust_tier, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(profile_id, peer_pubkey) DO UPDATE SET
               state = excluded.state,
               trust_tier = excluded.trust_tier,
               updated_at = excluded.updated_at",
            params![
                edge.profile_id,
                peer,
                edge.state,
                edge.trust_tier,
                updated_at
            ],
        )?;
        Ok(())
    }

    pub fn get_relationship_edge(
        &self,
        profile_id: &str,
        peer_pubkey: &str,
    ) -> Result<Option<RelationshipEdgeRecord>> {
        let peer = normalize_peer_pubkey(peer_pubkey);
        self.conn
            .query_row(
                "SELECT profile_id, peer_pubkey, state, trust_tier, updated_at
                 FROM relationship_edge
                 WHERE profile_id = ?1 AND peer_pubkey = ?2",
                params![profile_id, peer],
                |row| {
                    Ok(RelationshipEdgeRecord {
                        profile_id: row.get(0)?,
                        peer_pubkey: row.get(1)?,
                        state: row.get(2)?,
                        trust_tier: row.get(3)?,
                        updated_at: row.get(4)?,
                    })
                },
            )
            .optional()
    }

    pub fn list_relationship_edges(
        &self,
        profile_id: &str,
    ) -> Result<Vec<RelationshipEdgeRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT profile_id, peer_pubkey, state, trust_tier, updated_at
             FROM relationship_edge
             WHERE profile_id = ?1
             ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            Ok(RelationshipEdgeRecord {
                profile_id: row.get(0)?,
                peer_pubkey: row.get(1)?,
                state: row.get(2)?,
                trust_tier: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })?;
        rows.collect()
    }

    pub fn list_relationship_edges_by_state(
        &self,
        profile_id: &str,
        state: &str,
    ) -> Result<Vec<RelationshipEdgeRecord>> {
        if !relationship_state::is_valid(state) {
            return Err(rusqlite::Error::InvalidParameterName(format!(
                "invalid relationship_edge.state: {state}"
            )));
        }
        let mut stmt = self.conn.prepare(
            "SELECT profile_id, peer_pubkey, state, trust_tier, updated_at
             FROM relationship_edge
             WHERE profile_id = ?1 AND state = ?2
             ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map(params![profile_id, state], |row| {
            Ok(RelationshipEdgeRecord {
                profile_id: row.get(0)?,
                peer_pubkey: row.get(1)?,
                state: row.get(2)?,
                trust_tier: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })?;
        rows.collect()
    }

    /// Mark edge removed (sticky tombstone). Prefer over hard delete for auditability.
    pub fn mark_relationship_edge_removed(
        &self,
        profile_id: &str,
        peer_pubkey: &str,
    ) -> Result<()> {
        self.upsert_relationship_edge(&RelationshipEdgeRecord {
            profile_id: profile_id.to_string(),
            peer_pubkey: peer_pubkey.to_string(),
            state: relationship_state::REMOVED.to_string(),
            trust_tier: None,
            updated_at: now_unix_ms(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;

    fn seed_profile(db: &Database, profile_id: &str) {
        db.ensure_profile_slot(profile_id, profile_id).unwrap();
    }

    #[test]
    fn upsert_get_list_trusted_edge() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "pa");
        db.upsert_relationship_edge(&RelationshipEdgeRecord {
            profile_id: "pa".into(),
            peer_pubkey: "AABB".into(),
            state: relationship_state::TRUSTED.into(),
            trust_tier: Some("manual".into()),
            updated_at: 0,
        })
        .unwrap();

        let edge = db.get_relationship_edge("pa", "aabb").unwrap().expect("edge");
        assert_eq!(edge.peer_pubkey, "aabb");
        assert_eq!(edge.state, relationship_state::TRUSTED);

        let trusted = db
            .list_relationship_edges_by_state("pa", relationship_state::TRUSTED)
            .unwrap();
        assert_eq!(trusted.len(), 1);
    }

    #[test]
    fn upsert_rejects_unknown_state() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "pa");
        let err = db
            .upsert_relationship_edge(&RelationshipEdgeRecord {
                profile_id: "pa".into(),
                peer_pubkey: "peer1".into(),
                state: "from_history".into(),
                trust_tier: None,
                updated_at: 1,
            })
            .unwrap_err();
        assert!(err.to_string().contains("invalid relationship_edge.state"));
    }

    #[test]
    fn mark_removed_updates_state() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "pa");
        db.upsert_relationship_edge(&RelationshipEdgeRecord {
            profile_id: "pa".into(),
            peer_pubkey: "peer1".into(),
            state: relationship_state::TRUSTED.into(),
            trust_tier: None,
            updated_at: 1,
        })
        .unwrap();
        db.mark_relationship_edge_removed("pa", "peer1").unwrap();
        let edge = db.get_relationship_edge("pa", "peer1").unwrap().unwrap();
        assert_eq!(edge.state, relationship_state::REMOVED);
    }

    #[test]
    fn profile_isolation() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "pa");
        seed_profile(&db, "pb");
        db.upsert_relationship_edge(&RelationshipEdgeRecord {
            profile_id: "pa".into(),
            peer_pubkey: "peer1".into(),
            state: relationship_state::TRUSTED.into(),
            trust_tier: None,
            updated_at: 1,
        })
        .unwrap();
        assert!(db.list_relationship_edges("pb").unwrap().is_empty());
        assert_eq!(db.list_relationship_edges("pa").unwrap().len(), 1);
    }

    /// Cut 0.5 invariant: no helper invents TRUSTED from messages table.
    #[test]
    fn messages_do_not_create_relationship_edges() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "pa");
        db.insert_message(&crate::db::repositories::MessageRecord {
            event_id: "e1".into(),
            profile_id: "pa".into(),
            conversation_id: "conv".into(),
            sender_pubkey: "peer1".into(),
            recipient_pubkey: "pa".into(),
            plaintext: "hi".into(),
            kind: 14,
            created_at: 1,
            received_at: 1,
            is_outgoing: false,
            reply_to_event_id: None,
            has_attachment: false,
        })
        .unwrap();
        assert!(
            db.list_relationship_edges("pa").unwrap().is_empty(),
            "message insert must not invent CRM edges"
        );
    }
}
