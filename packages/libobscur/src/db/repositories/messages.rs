use rusqlite::{params, Result};
use crate::db::Database;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageRecord {
    pub event_id: String,
    pub profile_id: String,
    pub conversation_id: String,
    pub sender_pubkey: String,
    pub recipient_pubkey: String,
    pub plaintext: String,
    pub kind: u32,
    pub created_at: i64,
    pub received_at: i64,
    pub is_outgoing: bool,
    pub reply_to_event_id: Option<String>,
    pub has_attachment: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TombstoneRecord {
    pub event_id: String,
    pub profile_id: String,
    pub deleted_at: i64,
    pub deleted_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationRecord {
    pub id: String,
    pub profile_id: String,
    pub peer_pubkey: String,
    pub last_event_id: Option<String>,
    pub last_message_at: Option<i64>,
    pub last_plaintext_preview: Option<String>,
    pub unread_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayCheckpointRecord {
    pub profile_id: String,
    pub relay_url: String,
    /// Unix seconds — matches the Nostr `since` filter field.
    pub last_event_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultMediaIndexRecord {
    pub remote_url: String,
    pub profile_id: String,
    pub relative_path: String,
    pub saved_at_unix_ms: i64,
    pub file_name: String,
    pub content_type: String,
    pub size_bytes: i64,
    pub message_event_id: Option<String>,
    pub explicit_chat_save: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupRecord {
    pub id: String,
    pub profile_id: String,
    pub name: String,
    pub relay_url: String,
    pub kind: String,
    pub joined_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupMessageRecord {
    pub event_id: String,
    pub group_id: String,
    pub profile_id: String,
    pub sender_pubkey: String,
    pub plaintext: String,
    pub created_at: i64,
    pub received_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupTombstoneRecord {
    pub event_id: String,
    pub profile_id: String,
    pub deleted_at: i64,
    pub deleted_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallRecord {
    pub call_id: String,
    pub profile_id: String,
    pub peer_pubkey: String,
    pub initiated_by: String,
    pub status: String,
    pub started_at: Option<i64>,
    pub ended_at: Option<i64>,
    pub duration_ms: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WipeProfileLocalDataReport {
    pub profile_id: String,
    pub rows_deleted: u64,
    pub profile_row_deleted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageSearchResult {
    /// Which source table the hit came from: "dm" or "group".
    pub source: String,
    pub event_id: String,
    pub profile_id: String,
    /// DM: conversation_id; group: group_id.
    pub scope_id: String,
    pub sender_pubkey: String,
    pub plaintext: String,
    pub created_at: i64,
    /// FTS5 rank score (lower = better match).
    pub rank: f64,
}

impl Database {
    /// Ensures a local profile slot exists so FK-backed inserts do not silently no-op.
    pub fn ensure_profile_slot(&self, profile_id: &str, public_key: &str) -> Result<()> {
        let created_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_secs() as i64)
            .unwrap_or(0);
        self.conn.execute(
            "INSERT OR IGNORE INTO profiles (id, public_key, created_at) VALUES (?1, ?2, ?3)",
            params![profile_id, public_key, created_at],
        )?;
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Messages
    // -----------------------------------------------------------------------

    /// Hard-delete a single message row by (event_id, profile_id).
    /// Also removes any tombstone for the same pair (redundant after hard delete).
    pub fn delete_message(&self, event_id: &str, profile_id: &str) -> Result<()> {
        self.conn.execute(
            "DELETE FROM messages WHERE event_id = ?1 AND profile_id = ?2",
            params![event_id, profile_id],
        )?;
        self.conn.execute(
            "DELETE FROM tombstones WHERE event_id = ?1 AND profile_id = ?2",
            params![event_id, profile_id],
        )?;
        Ok(())
    }

    /// Bulk hard-delete message rows by a list of event_ids for a profile.
    pub fn delete_messages(&self, event_ids: &[String], profile_id: &str) -> Result<()> {
        for event_id in event_ids {
            self.delete_message(event_id, profile_id)?;
        }
        Ok(())
    }

    /// Insert a message. Silently ignored if (event_id, profile_id) already exists.
    pub fn insert_message(&self, msg: &MessageRecord) -> Result<()> {
        let account_pubkey = if msg.is_outgoing {
            msg.sender_pubkey.as_str()
        } else {
            msg.recipient_pubkey.as_str()
        };
        if !account_pubkey.is_empty() {
            self.ensure_profile_slot(&msg.profile_id, account_pubkey)?;
        }
        self.conn.execute(
            "INSERT OR IGNORE INTO messages
             (event_id, profile_id, conversation_id, sender_pubkey, recipient_pubkey,
              plaintext, kind, created_at, received_at, is_outgoing,
              reply_to_event_id, has_attachment)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
            params![
                msg.event_id,
                msg.profile_id,
                msg.conversation_id,
                msg.sender_pubkey,
                msg.recipient_pubkey,
                msg.plaintext,
                msg.kind,
                msg.created_at,
                msg.received_at,
                msg.is_outgoing as u32,
                msg.reply_to_event_id,
                msg.has_attachment as u32,
            ],
        )?;
        Ok(())
    }

    /// Fetch visible (non-tombstoned) messages for a conversation, newest first.
    /// Pass `before_received_at` (ms) to paginate backwards; omit for the latest window.
    pub fn get_messages_by_conversation(
        &self,
        profile_id: &str,
        conversation_id: &str,
        limit: u32,
        before_received_at: Option<i64>,
    ) -> Result<Vec<MessageRecord>> {
        match before_received_at {
            Some(before_ms) => self.query_messages_before(profile_id, conversation_id, limit, before_ms),
            None => self.query_messages_latest(profile_id, conversation_id, limit),
        }
    }

    fn query_messages_before(
        &self,
        profile_id: &str,
        conversation_id: &str,
        limit: u32,
        before_ms: i64,
    ) -> Result<Vec<MessageRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT m.event_id, m.profile_id, m.conversation_id, m.sender_pubkey,
                    m.recipient_pubkey, m.plaintext, m.kind, m.created_at,
                    m.received_at, m.is_outgoing, m.reply_to_event_id, m.has_attachment
             FROM messages m
             LEFT JOIN tombstones t
               ON t.event_id = m.event_id AND t.profile_id = m.profile_id
             WHERE m.profile_id = ?1
               AND m.conversation_id = ?2
               AND t.event_id IS NULL
               AND m.received_at < ?3
             ORDER BY m.received_at DESC
             LIMIT ?4",
        )?;
        let rows = stmt.query_map(params![profile_id, conversation_id, before_ms, limit], |row| {
            Ok(MessageRecord {
                event_id: row.get(0)?,
                profile_id: row.get(1)?,
                conversation_id: row.get(2)?,
                sender_pubkey: row.get(3)?,
                recipient_pubkey: row.get(4)?,
                plaintext: row.get(5)?,
                kind: row.get(6)?,
                created_at: row.get(7)?,
                received_at: row.get(8)?,
                is_outgoing: row.get::<_, u32>(9)? != 0,
                reply_to_event_id: row.get(10)?,
                has_attachment: row.get::<_, u32>(11)? != 0,
            })
        });
        match rows {
            Ok(mapped) => mapped.collect(),
            Err(e) => Err(e),
        }
    }

    fn query_messages_latest(
        &self,
        profile_id: &str,
        conversation_id: &str,
        limit: u32,
    ) -> Result<Vec<MessageRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT m.event_id, m.profile_id, m.conversation_id, m.sender_pubkey,
                    m.recipient_pubkey, m.plaintext, m.kind, m.created_at,
                    m.received_at, m.is_outgoing, m.reply_to_event_id, m.has_attachment
             FROM messages m
             LEFT JOIN tombstones t
               ON t.event_id = m.event_id AND t.profile_id = m.profile_id
             WHERE m.profile_id = ?1
               AND m.conversation_id = ?2
               AND t.event_id IS NULL
             ORDER BY m.received_at DESC
             LIMIT ?3",
        )?;
        let rows = stmt.query_map(params![profile_id, conversation_id, limit], |row| {
            Ok(MessageRecord {
                event_id: row.get(0)?,
                profile_id: row.get(1)?,
                conversation_id: row.get(2)?,
                sender_pubkey: row.get(3)?,
                recipient_pubkey: row.get(4)?,
                plaintext: row.get(5)?,
                kind: row.get(6)?,
                created_at: row.get(7)?,
                received_at: row.get(8)?,
                is_outgoing: row.get::<_, u32>(9)? != 0,
                reply_to_event_id: row.get(10)?,
                has_attachment: row.get::<_, u32>(11)? != 0,
            })
        });
        match rows {
            Ok(mapped) => mapped.collect(),
            Err(e) => Err(e),
        }
    }

    // -----------------------------------------------------------------------
    // Tombstones
    // -----------------------------------------------------------------------

    /// Record a delete. If the row exists, keep the later `deleted_at` (merge semantics).
    pub fn insert_tombstone(&self, t: &TombstoneRecord) -> Result<()> {
        self.conn.execute(
            "INSERT INTO tombstones (event_id, profile_id, deleted_at, deleted_by)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(event_id, profile_id) DO UPDATE SET
               deleted_at = CASE
                 WHEN excluded.deleted_at > tombstones.deleted_at THEN excluded.deleted_at
                 ELSE tombstones.deleted_at END,
               deleted_by = CASE
                 WHEN excluded.deleted_at > tombstones.deleted_at THEN excluded.deleted_by
                 ELSE tombstones.deleted_by END",
            params![t.event_id, t.profile_id, t.deleted_at, t.deleted_by],
        )?;
        Ok(())
    }

    /// Bulk-insert tombstones (e.g. from a delete command targeting many IDs).
    pub fn insert_tombstones(&self, records: &[TombstoneRecord]) -> Result<()> {
        for t in records {
            self.insert_tombstone(t)?;
        }
        Ok(())
    }

    /// Fetch all tombstones for a profile (used to seed the UI delete-suppression set on startup).
    pub fn get_tombstones(&self, profile_id: &str) -> Result<Vec<TombstoneRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT event_id, profile_id, deleted_at, deleted_by
             FROM tombstones
             WHERE profile_id = ?1
             ORDER BY deleted_at DESC",
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            Ok(TombstoneRecord {
                event_id: row.get(0)?,
                profile_id: row.get(1)?,
                deleted_at: row.get(2)?,
                deleted_by: row.get(3)?,
            })
        })?;
        rows.collect()
    }

    /// Remove all DM tombstones for a profile (e.g. account reset / tests).
    pub fn delete_all_tombstones_for_profile(&self, profile_id: &str) -> Result<()> {
        self.conn.execute(
            "DELETE FROM tombstones WHERE profile_id = ?1",
            params![profile_id],
        )?;
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Conversations
    // -----------------------------------------------------------------------

    /// Upsert a conversation row (creates or updates last_message metadata).
    pub fn upsert_conversation(&self, c: &ConversationRecord) -> Result<()> {
        self.conn.execute(
            "INSERT INTO conversations
               (id, profile_id, peer_pubkey, last_event_id, last_message_at,
                last_plaintext_preview, unread_count)
             VALUES (?1,?2,?3,?4,?5,?6,?7)
             ON CONFLICT(id, profile_id) DO UPDATE SET
               last_event_id          = excluded.last_event_id,
               last_message_at        = excluded.last_message_at,
               last_plaintext_preview = excluded.last_plaintext_preview,
               unread_count           = excluded.unread_count",
            params![
                c.id,
                c.profile_id,
                c.peer_pubkey,
                c.last_event_id,
                c.last_message_at,
                c.last_plaintext_preview,
                c.unread_count,
            ],
        )?;
        Ok(())
    }

    /// Fetch all conversations for a profile, newest first.
    pub fn get_conversations(&self, profile_id: &str) -> Result<Vec<ConversationRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, profile_id, peer_pubkey, last_event_id, last_message_at,
                    last_plaintext_preview, unread_count
             FROM conversations
             WHERE profile_id = ?1
             ORDER BY last_message_at DESC NULLS LAST",
        )?;

        let rows = stmt.query_map(params![profile_id], |row| {
            Ok(ConversationRecord {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                peer_pubkey: row.get(2)?,
                last_event_id: row.get(3)?,
                last_message_at: row.get(4)?,
                last_plaintext_preview: row.get(5)?,
                unread_count: row.get(6)?,
            })
        })?;

        rows.collect()
    }

    // -----------------------------------------------------------------------
    // Groups
    // -----------------------------------------------------------------------

    /// Upsert a group. Creates or updates name/relay_url/kind.
    pub fn upsert_group(&self, g: &GroupRecord) -> Result<()> {
        self.conn.execute(
            "INSERT INTO groups (id, profile_id, name, relay_url, kind, joined_at)
             VALUES (?1,?2,?3,?4,?5,?6)
             ON CONFLICT(id, profile_id) DO UPDATE SET
               name      = excluded.name,
               relay_url = excluded.relay_url,
               kind      = excluded.kind",
            params![g.id, g.profile_id, g.name, g.relay_url, g.kind, g.joined_at],
        )?;
        Ok(())
    }

    /// Fetch all groups the profile has joined.
    pub fn get_groups(&self, profile_id: &str) -> Result<Vec<GroupRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, profile_id, name, relay_url, kind, joined_at
             FROM groups
             WHERE profile_id = ?1
             ORDER BY joined_at DESC",
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            Ok(GroupRecord {
                id: row.get(0)?,
                profile_id: row.get(1)?,
                name: row.get(2)?,
                relay_url: row.get(3)?,
                kind: row.get(4)?,
                joined_at: row.get(5)?,
            })
        })?;
        rows.collect()
    }

    // -----------------------------------------------------------------------
    // Group messages
    // -----------------------------------------------------------------------

    /// Insert a group message. Silently ignored on duplicate (event_id, profile_id).
    pub fn insert_group_message(&self, m: &GroupMessageRecord) -> Result<()> {
        self.ensure_profile_slot(&m.profile_id, &m.sender_pubkey)?;
        self.conn.execute(
            "INSERT OR IGNORE INTO group_messages
             (event_id, group_id, profile_id, sender_pubkey, plaintext, created_at, received_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7)",
            params![
                m.event_id, m.group_id, m.profile_id,
                m.sender_pubkey, m.plaintext,
                m.created_at, m.received_at,
            ],
        )?;
        Ok(())
    }

    /// Fetch visible (non-tombstoned) group messages, newest first.
    /// Pass `before_received_at` (ms) to paginate backwards.
    pub fn get_group_messages(
        &self,
        profile_id: &str,
        group_id: &str,
        limit: u32,
        before_received_at: Option<i64>,
    ) -> Result<Vec<GroupMessageRecord>> {
        match before_received_at {
            Some(before_ms) => self.query_group_messages_before(profile_id, group_id, limit, before_ms),
            None => self.query_group_messages_latest(profile_id, group_id, limit),
        }
    }

    fn query_group_messages_latest(
        &self,
        profile_id: &str,
        group_id: &str,
        limit: u32,
    ) -> Result<Vec<GroupMessageRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT m.event_id, m.group_id, m.profile_id, m.sender_pubkey,
                    m.plaintext, m.created_at, m.received_at
             FROM group_messages m
             LEFT JOIN group_tombstones t
               ON t.event_id = m.event_id AND t.profile_id = m.profile_id
             WHERE m.profile_id = ?1
               AND m.group_id = ?2
               AND t.event_id IS NULL
             ORDER BY m.received_at DESC
             LIMIT ?3",
        )?;
        let rows = stmt.query_map(params![profile_id, group_id, limit], |row| {
            Ok(GroupMessageRecord {
                event_id: row.get(0)?,
                group_id: row.get(1)?,
                profile_id: row.get(2)?,
                sender_pubkey: row.get(3)?,
                plaintext: row.get(4)?,
                created_at: row.get(5)?,
                received_at: row.get(6)?,
            })
        })?;
        rows.collect()
    }

    fn query_group_messages_before(
        &self,
        profile_id: &str,
        group_id: &str,
        limit: u32,
        before_ms: i64,
    ) -> Result<Vec<GroupMessageRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT m.event_id, m.group_id, m.profile_id, m.sender_pubkey,
                    m.plaintext, m.created_at, m.received_at
             FROM group_messages m
             LEFT JOIN group_tombstones t
               ON t.event_id = m.event_id AND t.profile_id = m.profile_id
             WHERE m.profile_id = ?1
               AND m.group_id = ?2
               AND t.event_id IS NULL
               AND m.received_at < ?3
             ORDER BY m.received_at DESC
             LIMIT ?4",
        )?;
        let rows = stmt.query_map(params![profile_id, group_id, before_ms, limit], |row| {
            Ok(GroupMessageRecord {
                event_id: row.get(0)?,
                group_id: row.get(1)?,
                profile_id: row.get(2)?,
                sender_pubkey: row.get(3)?,
                plaintext: row.get(4)?,
                created_at: row.get(5)?,
                received_at: row.get(6)?,
            })
        })?;
        rows.collect()
    }

    // -----------------------------------------------------------------------
    // Group tombstones
    // -----------------------------------------------------------------------

    /// Record a group message delete. Silently ignored if already tombstoned.
    pub fn insert_group_tombstone(&self, t: &GroupTombstoneRecord) -> Result<()> {
        self.conn.execute(
            "INSERT OR IGNORE INTO group_tombstones (event_id, profile_id, deleted_at, deleted_by)
             VALUES (?1, ?2, ?3, ?4)",
            params![t.event_id, t.profile_id, t.deleted_at, t.deleted_by],
        )?;
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Call records
    // -----------------------------------------------------------------------

    /// Insert a call record. Silently ignored on duplicate call_id.
    pub fn insert_call_record(&self, c: &CallRecord) -> Result<()> {
        self.conn.execute(
            "INSERT OR IGNORE INTO call_records
             (call_id, profile_id, peer_pubkey, initiated_by, status,
              started_at, ended_at, duration_ms)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![
                c.call_id, c.profile_id, c.peer_pubkey,
                c.initiated_by, c.status,
                c.started_at, c.ended_at, c.duration_ms,
            ],
        )?;
        Ok(())
    }

    /// Update call status/end metadata (used when call resolves after insert).
    pub fn update_call_record(&self, c: &CallRecord) -> Result<()> {
        self.conn.execute(
            "UPDATE call_records SET status = ?1, ended_at = ?2, duration_ms = ?3
             WHERE call_id = ?4 AND profile_id = ?5",
            params![c.status, c.ended_at, c.duration_ms, c.call_id, c.profile_id],
        )?;
        Ok(())
    }

    /// Fetch call records for a profile, most recent first.
    pub fn get_call_records(&self, profile_id: &str) -> Result<Vec<CallRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT call_id, profile_id, peer_pubkey, initiated_by, status,
                    started_at, ended_at, duration_ms
             FROM call_records
             WHERE profile_id = ?1
             ORDER BY started_at DESC NULLS LAST",
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            Ok(CallRecord {
                call_id: row.get(0)?,
                profile_id: row.get(1)?,
                peer_pubkey: row.get(2)?,
                initiated_by: row.get(3)?,
                status: row.get(4)?,
                started_at: row.get(5)?,
                ended_at: row.get(6)?,
                duration_ms: row.get(7)?,
            })
        })?;
        rows.collect()
    }

    // -----------------------------------------------------------------------
    // Relay checkpoints
    // -----------------------------------------------------------------------

    /// Upsert the resume-point for a (profile, relay) pair.
    /// `last_event_at` is Unix seconds matching the Nostr `since` filter.
    /// Caller should only advance the checkpoint, never regress it:
    ///   ON CONFLICT … DO UPDATE SET last_event_at = MAX(…)
    pub fn upsert_relay_checkpoint(&self, c: &RelayCheckpointRecord) -> Result<()> {
        self.conn.execute(
            "INSERT INTO relay_checkpoints (profile_id, relay_url, last_event_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(profile_id, relay_url) DO UPDATE SET
               last_event_at = MAX(excluded.last_event_at, relay_checkpoints.last_event_at)",
            params![c.profile_id, c.relay_url, c.last_event_at],
        )?;
        Ok(())
    }

    /// Fetch the checkpoint for a single (profile, relay) pair.
    /// Returns `None` when no checkpoint exists yet (cold start).
    pub fn get_relay_checkpoint(
        &self,
        profile_id: &str,
        relay_url: &str,
    ) -> Result<Option<RelayCheckpointRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT profile_id, relay_url, last_event_at
             FROM relay_checkpoints
             WHERE profile_id = ?1 AND relay_url = ?2",
        )?;
        let mut rows = stmt.query_map(params![profile_id, relay_url], |row| {
            Ok(RelayCheckpointRecord {
                profile_id: row.get(0)?,
                relay_url: row.get(1)?,
                last_event_at: row.get(2)?,
            })
        })?;
        match rows.next() {
            Some(Ok(record)) => Ok(Some(record)),
            Some(Err(e)) => Err(e),
            None => Ok(None),
        }
    }

    /// Fetch all relay checkpoints for a profile (used at startup to rebuild
    /// subscription filters for all relays the profile is connected to).
    pub fn get_relay_checkpoints(&self, profile_id: &str) -> Result<Vec<RelayCheckpointRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT profile_id, relay_url, last_event_at
             FROM relay_checkpoints
             WHERE profile_id = ?1
             ORDER BY relay_url ASC",
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            Ok(RelayCheckpointRecord {
                profile_id: row.get(0)?,
                relay_url: row.get(1)?,
                last_event_at: row.get(2)?,
            })
        })?;
        rows.collect()
    }

    // -----------------------------------------------------------------------
    // FTS5 search
    // -----------------------------------------------------------------------

    /// Full-text search across DM messages and group messages for a profile.
    ///
    /// Tombstoned rows are excluded at query time via LEFT JOIN.
    /// Results are ordered by FTS5 rank (best match first), then recency.
    /// `limit` caps total results across both sources.
    pub fn search_messages(
        &self,
        profile_id: &str,
        query: &str,
        limit: u32,
    ) -> Result<Vec<MessageSearchResult>> {
        let mut results: Vec<MessageSearchResult> = Vec::new();

        // --- DM messages ---
        let mut stmt = self.conn.prepare(
            "SELECT f.event_id, f.profile_id, f.conversation_id, f.sender_pubkey,
                    snippet(messages_fts, 4, '', '', '...', 32) AS plaintext,
                    f.created_at, f.rank
             FROM messages_fts f
             LEFT JOIN tombstones t
               ON t.event_id = f.event_id AND t.profile_id = f.profile_id
             WHERE messages_fts MATCH ?1
               AND f.profile_id = ?2
               AND t.event_id IS NULL
             ORDER BY f.rank, f.created_at DESC
             LIMIT ?3",
        )?;
        let dm_rows = stmt.query_map(params![query, profile_id, limit], |row| {
            Ok(MessageSearchResult {
                source: "dm".to_string(),
                event_id: row.get(0)?,
                profile_id: row.get(1)?,
                scope_id: row.get(2)?,
                sender_pubkey: row.get(3)?,
                plaintext: row.get(4)?,
                created_at: row.get(5)?,
                rank: row.get(6)?,
            })
        })?;
        for row in dm_rows {
            results.push(row?);
        }

        // --- Group messages ---
        let mut stmt = self.conn.prepare(
            "SELECT f.event_id, f.profile_id, f.group_id, f.sender_pubkey,
                    snippet(group_messages_fts, 4, '', '', '...', 32) AS plaintext,
                    f.created_at, f.rank
             FROM group_messages_fts f
             LEFT JOIN group_tombstones gt
               ON gt.event_id = f.event_id AND gt.profile_id = f.profile_id
             WHERE group_messages_fts MATCH ?1
               AND f.profile_id = ?2
               AND gt.event_id IS NULL
             ORDER BY f.rank, f.created_at DESC
             LIMIT ?3",
        )?;
        let group_rows = stmt.query_map(params![query, profile_id, limit], |row| {
            Ok(MessageSearchResult {
                source: "group".to_string(),
                event_id: row.get(0)?,
                profile_id: row.get(1)?,
                scope_id: row.get(2)?,
                sender_pubkey: row.get(3)?,
                plaintext: row.get(4)?,
                created_at: row.get(5)?,
                rank: row.get(6)?,
            })
        })?;
        for row in group_rows {
            results.push(row?);
        }

        // Sort merged results: best rank first, then newest.
        results.sort_by(|a, b| {
            a.rank.partial_cmp(&b.rank)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| b.created_at.cmp(&a.created_at))
        });
        results.truncate(limit as usize);
        Ok(results)
    }

    // -----------------------------------------------------------------------
    // Vault media index
    // -----------------------------------------------------------------------

    pub fn upsert_vault_media_index(&self, record: &VaultMediaIndexRecord) -> Result<()> {
        self.conn.execute(
            "INSERT INTO vault_media_index (
                remote_url, profile_id, relative_path, saved_at_unix_ms,
                file_name, content_type, size_bytes, message_event_id, explicit_chat_save
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT(remote_url, profile_id) DO UPDATE SET
               relative_path = excluded.relative_path,
               saved_at_unix_ms = excluded.saved_at_unix_ms,
               file_name = excluded.file_name,
               content_type = excluded.content_type,
               size_bytes = excluded.size_bytes,
               message_event_id = excluded.message_event_id,
               explicit_chat_save = excluded.explicit_chat_save",
            params![
                record.remote_url,
                record.profile_id,
                record.relative_path,
                record.saved_at_unix_ms,
                record.file_name,
                record.content_type,
                record.size_bytes,
                record.message_event_id,
                if record.explicit_chat_save { 1 } else { 0 },
            ],
        )?;
        Ok(())
    }

    pub fn get_vault_media_index_for_profile(
        &self,
        profile_id: &str,
    ) -> Result<Vec<VaultMediaIndexRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT remote_url, profile_id, relative_path, saved_at_unix_ms,
                    file_name, content_type, size_bytes, message_event_id, explicit_chat_save
             FROM vault_media_index
             WHERE profile_id = ?1
             ORDER BY saved_at_unix_ms DESC",
        )?;
        let rows = stmt.query_map(params![profile_id], |row| {
            Ok(VaultMediaIndexRecord {
                remote_url: row.get(0)?,
                profile_id: row.get(1)?,
                relative_path: row.get(2)?,
                saved_at_unix_ms: row.get(3)?,
                file_name: row.get(4)?,
                content_type: row.get(5)?,
                size_bytes: row.get(6)?,
                message_event_id: row.get(7)?,
                explicit_chat_save: row.get::<_, i64>(8)? != 0,
            })
        })?;
        rows.collect()
    }

    pub fn delete_vault_media_index(
        &self,
        profile_id: &str,
        remote_url: &str,
    ) -> Result<()> {
        self.conn.execute(
            "DELETE FROM vault_media_index WHERE profile_id = ?1 AND remote_url = ?2",
            params![profile_id, remote_url],
        )?;
        Ok(())
    }

    pub fn delete_all_vault_media_index_for_profile(&self, profile_id: &str) -> Result<u64> {
        let count = self.conn.execute(
            "DELETE FROM vault_media_index WHERE profile_id = ?1",
            params![profile_id],
        )?;
        Ok(count as u64)
    }

    /// Remove all durable SQLite rows for a profile slot (messages, groups, checkpoints, etc.).
    /// When `remove_profile_row` is false the `profiles` row is kept (cache reset while signed in).
    pub fn wipe_profile_local_data(
        &self,
        profile_id: &str,
        remove_profile_row: bool,
    ) -> Result<WipeProfileLocalDataReport> {
        const TABLES: &[&str] = &[
            "messages",
            "tombstones",
            "conversations",
            "peer_relay_hints",
            "connection_requests",
            "groups",
            "group_messages",
            "group_tombstones",
            "call_records",
            "relay_checkpoints",
            "vault_media_index",
        ];

        let mut rows_deleted: u64 = 0;
        for table in TABLES {
            let count = self.conn.execute(
                &format!("DELETE FROM {table} WHERE profile_id = ?1"),
                params![profile_id],
            )?;
            rows_deleted += count as u64;
        }

        let profile_row_deleted = if remove_profile_row {
            let count = self
                .conn
                .execute("DELETE FROM profiles WHERE id = ?1", params![profile_id])?;
            rows_deleted += count as u64;
            count > 0
        } else {
            false
        };

        Ok(WipeProfileLocalDataReport {
            profile_id: profile_id.to_string(),
            rows_deleted,
            profile_row_deleted,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;

    fn seed_profile(db: &Database, profile_id: &str) {
        db.conn.execute(
            "INSERT OR IGNORE INTO profiles (id, public_key, created_at) VALUES (?1, ?2, ?3)",
            rusqlite::params![profile_id, format!("pubkey_{}", profile_id), 1700000000i64],
        ).unwrap();
    }

    fn make_message(event_id: &str, profile_id: &str, conversation_id: &str) -> MessageRecord {
        MessageRecord {
            event_id: event_id.to_string(),
            profile_id: profile_id.to_string(),
            conversation_id: conversation_id.to_string(),
            sender_pubkey: "aaa".to_string(),
            recipient_pubkey: "bbb".to_string(),
            plaintext: "hello".to_string(),
            kind: 4,
            created_at: 1700000000,
            received_at: 1700000000000,
            is_outgoing: false,
            reply_to_event_id: None,
            has_attachment: false,
        }
    }

    #[test]
    fn incoming_insert_ensures_profile_slot_with_recipient_pubkey() {
        let db = Database::new(None).unwrap();
        let mut msg = make_message("evt_in", "profile_a", "aaa:bbb");
        msg.sender_pubkey = "peer_sender".to_string();
        msg.recipient_pubkey = "my_account".to_string();
        msg.is_outgoing = false;
        db.insert_message(&msg).unwrap();
        let public_key: String = db.conn.query_row(
            "SELECT public_key FROM profiles WHERE id = ?1",
            rusqlite::params!["profile_a"],
            |row| row.get(0),
        ).unwrap();
        assert_eq!(public_key, "my_account");
    }

    #[test]
    fn test_message_insert_and_query() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "profile_a");
        let msg = make_message("evt1", "profile_a", "aaa:bbb");
        db.insert_message(&msg).unwrap();
        let rows = db.get_messages_by_conversation("profile_a", "aaa:bbb", 10, None).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].plaintext, "hello");
    }

    #[test]
    fn test_insert_dedup() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "profile_a");
        let msg = make_message("evt1", "profile_a", "aaa:bbb");
        db.insert_message(&msg).unwrap();
        db.insert_message(&msg).unwrap(); // second insert is silently ignored
        let rows = db.get_messages_by_conversation("profile_a", "aaa:bbb", 10, None).unwrap();
        assert_eq!(rows.len(), 1);
    }

    #[test]
    fn test_profile_isolation() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "profile_a");
        seed_profile(&db, "profile_b");
        db.insert_message(&make_message("evt1", "profile_a", "aaa:bbb")).unwrap();
        db.insert_message(&make_message("evt1", "profile_b", "aaa:bbb")).unwrap();
        let a = db.get_messages_by_conversation("profile_a", "aaa:bbb", 10, None).unwrap();
        let b = db.get_messages_by_conversation("profile_b", "aaa:bbb", 10, None).unwrap();
        assert_eq!(a.len(), 1);
        assert_eq!(b.len(), 1);
    }

    #[test]
    fn test_tombstone_hides_message() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "profile_a");
        db.insert_message(&make_message("evt1", "profile_a", "aaa:bbb")).unwrap();
        db.insert_tombstone(&TombstoneRecord {
            event_id: "evt1".to_string(),
            profile_id: "profile_a".to_string(),
            deleted_at: 1700000001000,
            deleted_by: "aaa".to_string(),
        }).unwrap();
        let rows = db.get_messages_by_conversation("profile_a", "aaa:bbb", 10, None).unwrap();
        assert_eq!(rows.len(), 0);
    }

    #[test]
    fn test_tombstone_scoped_to_profile() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "profile_a");
        seed_profile(&db, "profile_b");
        db.insert_message(&make_message("evt1", "profile_a", "aaa:bbb")).unwrap();
        db.insert_message(&make_message("evt1", "profile_b", "aaa:bbb")).unwrap();
        // Only tombstone for profile_a
        db.insert_tombstone(&TombstoneRecord {
            event_id: "evt1".to_string(),
            profile_id: "profile_a".to_string(),
            deleted_at: 1700000001000,
            deleted_by: "aaa".to_string(),
        }).unwrap();
        let a = db.get_messages_by_conversation("profile_a", "aaa:bbb", 10, None).unwrap();
        let b = db.get_messages_by_conversation("profile_b", "aaa:bbb", 10, None).unwrap();
        assert_eq!(a.len(), 0, "profile_a should see message hidden");
        assert_eq!(b.len(), 1, "profile_b should still see the message");
    }

    fn make_message_at(event_id: &str, profile_id: &str, conversation_id: &str, received_at: i64) -> MessageRecord {
        MessageRecord {
            received_at,
            created_at: received_at / 1000,
            ..make_message(event_id, profile_id, conversation_id)
        }
    }

    #[test]
    fn test_pagination_cursor_returns_older_window() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        for i in 1u32..=5 {
            let m = make_message_at(&format!("e{i}"), "p", "conv", i as i64 * 1000);
            db.insert_message(&m).unwrap();
        }
        // Latest 2 (no cursor): should be e5, e4
        let latest = db.get_messages_by_conversation("p", "conv", 2, None).unwrap();
        assert_eq!(latest.len(), 2);
        assert_eq!(latest[0].event_id, "e5");
        assert_eq!(latest[1].event_id, "e4");
        // Page back before e4 (received_at=4000): should be e3, e2
        let page2 = db.get_messages_by_conversation("p", "conv", 2, Some(4000)).unwrap();
        assert_eq!(page2.len(), 2);
        assert_eq!(page2[0].event_id, "e3");
        assert_eq!(page2[1].event_id, "e2");
    }

    #[test]
    fn test_tombstoned_message_hidden_from_paginated_window() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        for i in 1u32..=4 {
            let m = make_message_at(&format!("e{i}"), "p", "conv", i as i64 * 1000);
            db.insert_message(&m).unwrap();
        }
        // Tombstone e3 — should not appear in any window
        db.insert_tombstone(&TombstoneRecord {
            event_id: "e3".to_string(),
            profile_id: "p".to_string(),
            deleted_at: 9999,
            deleted_by: "aaa".to_string(),
        }).unwrap();
        let all = db.get_messages_by_conversation("p", "conv", 10, None).unwrap();
        let ids: Vec<&str> = all.iter().map(|r| r.event_id.as_str()).collect();
        assert!(!ids.contains(&"e3"), "tombstoned message must not appear");
        assert_eq!(ids, vec!["e4", "e2", "e1"]);
    }

    #[test]
    fn test_hard_delete_removes_message_row() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        db.insert_message(&make_message("e1", "p", "conv")).unwrap();
        db.insert_message(&make_message("e2", "p", "conv")).unwrap();
        db.delete_message("e1", "p").unwrap();
        let rows = db.get_messages_by_conversation("p", "conv", 10, None).unwrap();
        let ids: Vec<&str> = rows.iter().map(|r| r.event_id.as_str()).collect();
        assert!(!ids.contains(&"e1"), "hard-deleted message must not appear");
        assert!(ids.contains(&"e2"), "undeleted message must still appear");
    }

    #[test]
    fn test_hard_delete_scoped_to_profile() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "pa");
        seed_profile(&db, "pb");
        db.insert_message(&make_message("e1", "pa", "conv")).unwrap();
        db.insert_message(&make_message("e1", "pb", "conv")).unwrap();
        db.delete_message("e1", "pa").unwrap();
        let a = db.get_messages_by_conversation("pa", "conv", 10, None).unwrap();
        let b = db.get_messages_by_conversation("pb", "conv", 10, None).unwrap();
        assert_eq!(a.len(), 0, "message must be deleted from profile_a");
        assert_eq!(b.len(), 1, "message must survive in profile_b");
    }

    #[test]
    fn test_hard_delete_also_removes_tombstone() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        db.insert_message(&make_message("e1", "p", "conv")).unwrap();
        db.insert_tombstone(&TombstoneRecord {
            event_id: "e1".to_string(),
            profile_id: "p".to_string(),
            deleted_at: 9999,
            deleted_by: "".to_string(),
        }).unwrap();
        db.delete_message("e1", "p").unwrap();
        // After hard delete, get_tombstones should not include e1
        let tombstones = db.get_tombstones("p").unwrap();
        let ts_ids: Vec<&str> = tombstones.iter().map(|t| t.event_id.as_str()).collect();
        assert!(!ts_ids.contains(&"e1"), "tombstone must be removed alongside message row");
    }

    #[test]
    fn test_bulk_delete_messages() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        for i in 1u32..=4 {
            db.insert_message(&make_message_at(&format!("e{i}"), "p", "conv", i as i64 * 1000)).unwrap();
        }
        db.delete_messages(&["e1".to_string(), "e3".to_string()], "p").unwrap();
        let rows = db.get_messages_by_conversation("p", "conv", 10, None).unwrap();
        let ids: Vec<&str> = rows.iter().map(|r| r.event_id.as_str()).collect();
        assert!(!ids.contains(&"e1") && !ids.contains(&"e3"), "bulk-deleted messages must not appear");
        assert!(ids.contains(&"e2") && ids.contains(&"e4"), "other messages must survive");
    }

    #[test]
    fn test_duplicate_conversation_upsert_single_row() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        let base = ConversationRecord {
            id: "aaa:bbb".to_string(),
            profile_id: "p".to_string(),
            peer_pubkey: "bbb".to_string(),
            last_event_id: Some("e1".to_string()),
            last_message_at: Some(1000),
            last_plaintext_preview: Some("first".to_string()),
            unread_count: 1,
        };
        db.upsert_conversation(&base).unwrap();
        // Upsert again with newer data — must not create a second row
        db.upsert_conversation(&ConversationRecord {
            last_event_id: Some("e2".to_string()),
            last_message_at: Some(2000),
            last_plaintext_preview: Some("second".to_string()),
            unread_count: 2,
            ..base
        }).unwrap();
        let list = db.get_conversations("p").unwrap();
        assert_eq!(list.len(), 1, "duplicate upsert must not create a second row");
        assert_eq!(list[0].last_plaintext_preview.as_deref(), Some("second"));
        assert_eq!(list[0].unread_count, 2);
    }

    #[test]
    fn test_conversation_list_ordered_newest_first() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        db.upsert_conversation(&ConversationRecord {
            id: "conv_old".to_string(),
            profile_id: "p".to_string(),
            peer_pubkey: "old_peer".to_string(),
            last_event_id: None,
            last_message_at: Some(1000),
            last_plaintext_preview: None,
            unread_count: 0,
        }).unwrap();
        db.upsert_conversation(&ConversationRecord {
            id: "conv_new".to_string(),
            profile_id: "p".to_string(),
            peer_pubkey: "new_peer".to_string(),
            last_event_id: None,
            last_message_at: Some(9000),
            last_plaintext_preview: None,
            unread_count: 0,
        }).unwrap();
        let list = db.get_conversations("p").unwrap();
        assert_eq!(list[0].id, "conv_new", "newest conversation must be first");
        assert_eq!(list[1].id, "conv_old");
    }

    #[test]
    fn test_conversation_upsert() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "profile_a");
        let conv = ConversationRecord {
            id: "aaa:bbb".to_string(),
            profile_id: "profile_a".to_string(),
            peer_pubkey: "bbb".to_string(),
            last_event_id: Some("evt1".to_string()),
            last_message_at: Some(1700000000),
            last_plaintext_preview: Some("hello".to_string()),
            unread_count: 1,
        };
        db.upsert_conversation(&conv).unwrap();
        let list = db.get_conversations("profile_a").unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].unread_count, 1);

        // Update it
        db.upsert_conversation(&ConversationRecord { unread_count: 0, ..conv }).unwrap();
        let list2 = db.get_conversations("profile_a").unwrap();
        assert_eq!(list2[0].unread_count, 0);
    }

    // -----------------------------------------------------------------------
    // Phase 5 tests — groups, group messages, call records
    // -----------------------------------------------------------------------

    fn make_group(id: &str, profile_id: &str) -> GroupRecord {
        GroupRecord {
            id: id.to_string(),
            profile_id: profile_id.to_string(),
            name: format!("Group {id}"),
            relay_url: "wss://relay.example".to_string(),
            kind: "public".to_string(),
            joined_at: 1700000000000,
        }
    }

    fn make_group_message(event_id: &str, group_id: &str, profile_id: &str, received_at: i64) -> GroupMessageRecord {
        GroupMessageRecord {
            event_id: event_id.to_string(),
            group_id: group_id.to_string(),
            profile_id: profile_id.to_string(),
            sender_pubkey: "aaa".to_string(),
            plaintext: "hello group".to_string(),
            created_at: received_at / 1000,
            received_at,
        }
    }

    #[test]
    fn test_group_upsert_and_query() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        db.upsert_group(&make_group("grp1", "p")).unwrap();
        db.upsert_group(&make_group("grp1", "p")).unwrap(); // upsert again — must stay 1 row
        let groups = db.get_groups("p").unwrap();
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].name, "Group grp1");
    }

    #[test]
    fn test_group_upsert_updates_name() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        db.upsert_group(&make_group("grp1", "p")).unwrap();
        db.upsert_group(&GroupRecord { name: "Renamed".to_string(), ..make_group("grp1", "p") }).unwrap();
        let groups = db.get_groups("p").unwrap();
        assert_eq!(groups[0].name, "Renamed");
    }

    #[test]
    fn test_group_message_insert_without_preseeded_profile() {
        let db = Database::new(None).unwrap();
        let msg = make_group_message("e0", "g1", "slot-a", 1000);
        db.insert_group_message(&msg).unwrap();
        let rows = db.get_group_messages("slot-a", "g1", 10, None).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].plaintext, "hello group");
    }

    #[test]
    fn test_group_message_insert_and_query() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        db.upsert_group(&make_group("g1", "p")).unwrap();
        db.insert_group_message(&make_group_message("e1", "g1", "p", 1000)).unwrap();
        let msgs = db.get_group_messages("p", "g1", 10, None).unwrap();
        assert_eq!(msgs.len(), 1);
        assert_eq!(msgs[0].plaintext, "hello group");
    }

    #[test]
    fn test_group_message_dedup() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        db.upsert_group(&make_group("g1", "p")).unwrap();
        let m = make_group_message("e1", "g1", "p", 1000);
        db.insert_group_message(&m).unwrap();
        db.insert_group_message(&m).unwrap(); // duplicate ignored
        let msgs = db.get_group_messages("p", "g1", 10, None).unwrap();
        assert_eq!(msgs.len(), 1);
    }

    #[test]
    fn test_group_tombstone_hides_message() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        db.upsert_group(&make_group("g1", "p")).unwrap();
        db.insert_group_message(&make_group_message("e1", "g1", "p", 1000)).unwrap();
        db.insert_group_tombstone(&GroupTombstoneRecord {
            event_id: "e1".to_string(),
            profile_id: "p".to_string(),
            deleted_at: 2000,
            deleted_by: "aaa".to_string(),
        }).unwrap();
        let msgs = db.get_group_messages("p", "g1", 10, None).unwrap();
        assert_eq!(msgs.len(), 0, "tombstoned group message must be hidden");
    }

    #[test]
    fn test_group_message_pagination() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        db.upsert_group(&make_group("g1", "p")).unwrap();
        for i in 1u32..=4 {
            db.insert_group_message(&make_group_message(&format!("e{i}"), "g1", "p", i as i64 * 1000)).unwrap();
        }
        // Latest 2: e4, e3
        let latest = db.get_group_messages("p", "g1", 2, None).unwrap();
        assert_eq!(latest[0].event_id, "e4");
        assert_eq!(latest[1].event_id, "e3");
        // Page before e3 (received_at=3000): e2, e1
        let page2 = db.get_group_messages("p", "g1", 2, Some(3000)).unwrap();
        assert_eq!(page2[0].event_id, "e2");
        assert_eq!(page2[1].event_id, "e1");
    }

    #[test]
    fn test_call_record_insert_and_query() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        let call = CallRecord {
            call_id: "call-1".to_string(),
            profile_id: "p".to_string(),
            peer_pubkey: "bbb".to_string(),
            initiated_by: "aaa".to_string(),
            status: "missed".to_string(),
            started_at: Some(1700000000000),
            ended_at: None,
            duration_ms: None,
        };
        db.insert_call_record(&call).unwrap();
        let records = db.get_call_records("p").unwrap();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].status, "missed");
    }

    #[test]
    fn test_call_record_dedup() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        let call = CallRecord {
            call_id: "call-1".to_string(),
            profile_id: "p".to_string(),
            peer_pubkey: "bbb".to_string(),
            initiated_by: "aaa".to_string(),
            status: "missed".to_string(),
            started_at: Some(1000),
            ended_at: None,
            duration_ms: None,
        };
        db.insert_call_record(&call).unwrap();
        db.insert_call_record(&call).unwrap(); // duplicate ignored
        assert_eq!(db.get_call_records("p").unwrap().len(), 1);
    }

    #[test]
    fn test_call_record_update() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        let call = CallRecord {
            call_id: "call-1".to_string(),
            profile_id: "p".to_string(),
            peer_pubkey: "bbb".to_string(),
            initiated_by: "aaa".to_string(),
            status: "answered".to_string(),
            started_at: Some(1000),
            ended_at: None,
            duration_ms: None,
        };
        db.insert_call_record(&call).unwrap();
        db.update_call_record(&CallRecord {
            status: "ended".to_string(),
            ended_at: Some(5000),
            duration_ms: Some(4000),
            ..call
        }).unwrap();
        let records = db.get_call_records("p").unwrap();
        assert_eq!(records[0].status, "ended");
        assert_eq!(records[0].ended_at, Some(5000));
        assert_eq!(records[0].duration_ms, Some(4000));
    }

    // -----------------------------------------------------------------------
    // Vault media index
    // -----------------------------------------------------------------------

    fn make_vault_media_index(
        profile_id: &str,
        remote_url: &str,
        relative_path: &str,
    ) -> VaultMediaIndexRecord {
        VaultMediaIndexRecord {
            remote_url: remote_url.to_string(),
            profile_id: profile_id.to_string(),
            relative_path: relative_path.to_string(),
            saved_at_unix_ms: 1_700_000_000_000,
            file_name: "photo.jpg".to_string(),
            content_type: "image/jpeg".to_string(),
            size_bytes: 1024,
            message_event_id: None,
            explicit_chat_save: true,
        }
    }

    #[test]
    fn test_vault_media_index_upsert_and_list() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        db.upsert_vault_media_index(&make_vault_media_index(
            "p",
            "obscur://vault/local/abc",
            "vault-media/abc.obscurvault",
        ))
        .unwrap();
        let rows = db.get_vault_media_index_for_profile("p").unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].remote_url, "obscur://vault/local/abc");
        assert!(rows[0].explicit_chat_save);
    }

    // -----------------------------------------------------------------------
    // Phase 6 tests — relay checkpoints
    // -----------------------------------------------------------------------

    fn make_checkpoint(profile_id: &str, relay_url: &str, last_event_at: i64) -> RelayCheckpointRecord {
        RelayCheckpointRecord {
            profile_id: profile_id.to_string(),
            relay_url: relay_url.to_string(),
            last_event_at,
        }
    }

    #[test]
    fn test_relay_checkpoint_insert_and_get() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        db.upsert_relay_checkpoint(&make_checkpoint("p", "wss://relay.example", 1700000000)).unwrap();
        let cp = db.get_relay_checkpoint("p", "wss://relay.example").unwrap();
        assert!(cp.is_some());
        assert_eq!(cp.unwrap().last_event_at, 1700000000);
    }

    #[test]
    fn test_relay_checkpoint_returns_none_on_cold_start() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        let cp = db.get_relay_checkpoint("p", "wss://relay.example").unwrap();
        assert!(cp.is_none(), "missing checkpoint must return None, not an error");
    }

    #[test]
    fn test_relay_checkpoint_advances_forward() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        db.upsert_relay_checkpoint(&make_checkpoint("p", "wss://r", 1000)).unwrap();
        db.upsert_relay_checkpoint(&make_checkpoint("p", "wss://r", 2000)).unwrap();
        let cp = db.get_relay_checkpoint("p", "wss://r").unwrap().unwrap();
        assert_eq!(cp.last_event_at, 2000, "checkpoint must advance to newer value");
    }

    #[test]
    fn test_relay_checkpoint_does_not_regress() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        db.upsert_relay_checkpoint(&make_checkpoint("p", "wss://r", 5000)).unwrap();
        // Attempt to write a stale (older) checkpoint — must be silently ignored
        db.upsert_relay_checkpoint(&make_checkpoint("p", "wss://r", 1000)).unwrap();
        let cp = db.get_relay_checkpoint("p", "wss://r").unwrap().unwrap();
        assert_eq!(cp.last_event_at, 5000, "checkpoint must not regress");
    }

    #[test]
    fn test_relay_checkpoint_scoped_per_relay() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        db.upsert_relay_checkpoint(&make_checkpoint("p", "wss://relay-a", 1000)).unwrap();
        db.upsert_relay_checkpoint(&make_checkpoint("p", "wss://relay-b", 9000)).unwrap();
        let a = db.get_relay_checkpoint("p", "wss://relay-a").unwrap().unwrap();
        let b = db.get_relay_checkpoint("p", "wss://relay-b").unwrap().unwrap();
        assert_eq!(a.last_event_at, 1000);
        assert_eq!(b.last_event_at, 9000);
    }

    #[test]
    fn test_relay_checkpoints_profile_isolation() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "alice");
        seed_profile(&db, "bob");
        db.upsert_relay_checkpoint(&make_checkpoint("alice", "wss://r", 1000)).unwrap();
        db.upsert_relay_checkpoint(&make_checkpoint("bob",   "wss://r", 9000)).unwrap();
        let alice_cp = db.get_relay_checkpoint("alice", "wss://r").unwrap().unwrap();
        let bob_cp   = db.get_relay_checkpoint("bob",   "wss://r").unwrap().unwrap();
        assert_eq!(alice_cp.last_event_at, 1000);
        assert_eq!(bob_cp.last_event_at, 9000);
    }

    #[test]
    fn test_get_all_relay_checkpoints_for_profile() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        db.upsert_relay_checkpoint(&make_checkpoint("p", "wss://relay-a", 1000)).unwrap();
        db.upsert_relay_checkpoint(&make_checkpoint("p", "wss://relay-b", 2000)).unwrap();
        db.upsert_relay_checkpoint(&make_checkpoint("p", "wss://relay-c", 3000)).unwrap();
        let all = db.get_relay_checkpoints("p").unwrap();
        assert_eq!(all.len(), 3);
        // Ordered by relay_url ASC
        assert_eq!(all[0].relay_url, "wss://relay-a");
        assert_eq!(all[1].relay_url, "wss://relay-b");
        assert_eq!(all[2].relay_url, "wss://relay-c");
    }

    // -----------------------------------------------------------------------
    // Phase 5 tests — FTS5 unified search
    // -----------------------------------------------------------------------

    fn seed_message(db: &Database, event_id: &str, profile_id: &str, conversation_id: &str, plaintext: &str, created_at: i64) {
        db.insert_message(&MessageRecord {
            event_id: event_id.to_string(),
            profile_id: profile_id.to_string(),
            conversation_id: conversation_id.to_string(),
            sender_pubkey: "spk".to_string(),
            recipient_pubkey: "rpk".to_string(),
            plaintext: plaintext.to_string(),
            kind: 14,
            created_at,
            received_at: created_at,
            is_outgoing: false,
            reply_to_event_id: None,
            has_attachment: false,
        }).unwrap();
    }

    fn seed_group_message(db: &Database, event_id: &str, group_id: &str, profile_id: &str, plaintext: &str, created_at: i64) {
        db.insert_group_message(&GroupMessageRecord {
            event_id: event_id.to_string(),
            group_id: group_id.to_string(),
            profile_id: profile_id.to_string(),
            sender_pubkey: "spk".to_string(),
            plaintext: plaintext.to_string(),
            created_at,
            received_at: created_at,
        }).unwrap();
    }

    #[test]
    fn test_fts_finds_dm_message() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        seed_message(&db, "evt1", "p", "conv:a", "hello world from Alice", 1000);
        let results = db.search_messages("p", "hello", 20).unwrap();
        assert!(!results.is_empty(), "should find DM hit");
        assert_eq!(results[0].event_id, "evt1");
        assert_eq!(results[0].source, "dm");
    }

    #[test]
    fn test_fts_finds_group_message() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        seed_group_message(&db, "gm1", "group-alpha", "p", "welcome to the community", 2000);
        let results = db.search_messages("p", "community", 20).unwrap();
        assert!(!results.is_empty(), "should find group hit");
        assert_eq!(results[0].event_id, "gm1");
        assert_eq!(results[0].source, "group");
        assert_eq!(results[0].scope_id, "group-alpha");
    }

    #[test]
    fn test_fts_excludes_tombstoned_dm() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        seed_message(&db, "evt-del", "p", "conv:b", "secret deleted text", 1000);
        db.insert_tombstone(&TombstoneRecord {
            event_id: "evt-del".to_string(),
            profile_id: "p".to_string(),
            deleted_at: 2000,
            deleted_by: "p".to_string(),
        }).unwrap();
        let results = db.search_messages("p", "secret", 20).unwrap();
        assert!(results.is_empty(), "tombstoned DM must not appear in search");
    }

    #[test]
    fn test_fts_excludes_tombstoned_group_message() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        seed_group_message(&db, "gm-del", "group-beta", "p", "ephemeral group text", 3000);
        db.insert_group_tombstone(&GroupTombstoneRecord {
            event_id: "gm-del".to_string(),
            profile_id: "p".to_string(),
            deleted_at: 4000,
            deleted_by: "mod".to_string(),
        }).unwrap();
        let results = db.search_messages("p", "ephemeral", 20).unwrap();
        assert!(results.is_empty(), "tombstoned group message must not appear in search");
    }

    #[test]
    fn test_fts_profile_isolation() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "alice");
        seed_profile(&db, "bob");
        seed_message(&db, "a1", "alice", "conv:a", "alice private note", 1000);
        seed_message(&db, "b1", "bob",   "conv:b", "alice private note", 1000);
        let alice_results = db.search_messages("alice", "private", 20).unwrap();
        let bob_results   = db.search_messages("bob",   "private", 20).unwrap();
        assert_eq!(alice_results.len(), 1);
        assert_eq!(alice_results[0].event_id, "a1");
        assert_eq!(bob_results.len(), 1);
        assert_eq!(bob_results[0].event_id, "b1");
    }

    #[test]
    fn test_fts_no_match_returns_empty() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        seed_message(&db, "e1", "p", "conv:c", "ordinary text here", 1000);
        let results = db.search_messages("p", "xyzzy", 20).unwrap();
        assert!(results.is_empty(), "no match should return empty vec");
    }

    #[test]
    fn test_fts_limit_respected() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "p");
        for i in 0..10u32 {
            seed_message(&db, &format!("e{i}"), "p", "conv:d", "needle in haystack", i as i64 * 1000);
        }
        let results = db.search_messages("p", "needle", 5).unwrap();
        assert!(results.len() <= 5, "limit must be respected");
    }

    #[test]
    fn test_wipe_profile_local_data_keeps_profile_row_by_default() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "pa");
        seed_profile(&db, "pb");
        db.insert_message(&make_message("e1", "pa", "conv")).unwrap();
        db.insert_message(&make_message("e2", "pb", "conv")).unwrap();

        let report = db.wipe_profile_local_data("pa", false).unwrap();
        assert!(report.rows_deleted >= 1);
        assert!(!report.profile_row_deleted);

        assert_eq!(db.get_messages_by_conversation("pa", "conv", 10, None).unwrap().len(), 0);
        assert_eq!(db.get_messages_by_conversation("pb", "conv", 10, None).unwrap().len(), 1);
        let profile_count: i64 = db
            .conn
            .query_row("SELECT COUNT(*) FROM profiles WHERE id = ?1", params!["pa"], |row| row.get(0))
            .unwrap();
        assert_eq!(profile_count, 1);
    }

    #[test]
    fn test_wipe_profile_local_data_can_remove_profile_row() {
        let db = Database::new(None).unwrap();
        seed_profile(&db, "pa");
        db.insert_message(&make_message("e1", "pa", "conv")).unwrap();

        let report = db.wipe_profile_local_data("pa", true).unwrap();
        assert!(report.profile_row_deleted);

        let profile_count: i64 = db
            .conn
            .query_row("SELECT COUNT(*) FROM profiles WHERE id = ?1", params!["pa"], |row| row.get(0))
            .unwrap();
        assert_eq!(profile_count, 0);
    }

    /// Canonical DM read hot path — page budget for engine-lab B3 gate.
    #[test]
    fn test_dm_read_path_page_budget() {
        use std::time::Instant;

        let db = Database::new(None).unwrap();
        seed_profile(&db, "bench_profile");
        const MESSAGE_COUNT: usize = 500;
        const PAGE_LIMIT: u32 = 200;
        const BUDGET_MS: u128 = 500;

        for i in 0..MESSAGE_COUNT {
            db.insert_message(&make_message_at(
                &format!("evt_{i}"),
                "bench_profile",
                "dm:aa:bb",
                1_700_000_000_000 + i as i64,
            ))
            .unwrap();
        }

        let started = Instant::now();
        let rows = db
            .get_messages_by_conversation("bench_profile", "dm:aa:bb", PAGE_LIMIT, None)
            .unwrap();
        let elapsed_ms = started.elapsed().as_millis();

        assert_eq!(rows.len(), PAGE_LIMIT as usize);
        assert!(
            elapsed_ms < BUDGET_MS,
            "dm read page exceeded budget: {elapsed_ms}ms (limit {BUDGET_MS}ms)"
        );
    }
}
