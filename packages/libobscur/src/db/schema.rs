/// Current schema version. Increment when adding new migrations.
pub const SCHEMA_VERSION: u32 = 4;

/// Version tracking table — always created first.
pub const SCHEMA_VERSION_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS schema_version (
    version  INTEGER NOT NULL,
    applied_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
"#;

/// V1: Full baseline schema.
/// All account-scoped tables carry profile_id for strict isolation.
/// Deduplication is free: PRIMARY KEY (event_id, profile_id) + INSERT OR IGNORE.
pub const SCHEMA_V1: &str = r#"
-- -----------------------------------------------------------------------
-- Profiles (local accounts on this device)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id           TEXT PRIMARY KEY,
    public_key   TEXT NOT NULL UNIQUE,
    display_name TEXT,
    created_at   INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    is_active    INTEGER NOT NULL DEFAULT 0
);

-- -----------------------------------------------------------------------
-- DM Messages (kind 4 and NIP-17 kind 14 rumor plaintext)
-- Primary key on (event_id, profile_id): INSERT OR IGNORE = free dedup
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    event_id          TEXT    NOT NULL,
    profile_id        TEXT    NOT NULL REFERENCES profiles(id),
    conversation_id   TEXT    NOT NULL,
    sender_pubkey     TEXT    NOT NULL,
    recipient_pubkey  TEXT    NOT NULL,
    plaintext         TEXT    NOT NULL,
    kind              INTEGER NOT NULL,
    created_at        INTEGER NOT NULL,
    received_at       INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
    is_outgoing       INTEGER NOT NULL DEFAULT 0,
    reply_to_event_id TEXT,
    has_attachment    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (event_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_conv
    ON messages(profile_id, conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_messages_conv_received
    ON messages(profile_id, conversation_id, received_at);

-- -----------------------------------------------------------------------
-- Tombstones (delete-for-everyone)
-- A row here means the message is hidden for this profile.
-- Display query: LEFT JOIN tombstones WHERE tombstones.event_id IS NULL
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tombstones (
    event_id   TEXT    NOT NULL,
    profile_id TEXT    NOT NULL REFERENCES profiles(id),
    deleted_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
    deleted_by TEXT    NOT NULL,
    PRIMARY KEY (event_id, profile_id)
);

-- -----------------------------------------------------------------------
-- Conversations index (derived from messages, kept current via app logic)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
    id                     TEXT NOT NULL,
    profile_id             TEXT NOT NULL REFERENCES profiles(id),
    peer_pubkey            TEXT NOT NULL,
    last_event_id          TEXT,
    last_message_at        INTEGER,
    last_plaintext_preview TEXT,
    unread_count           INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_profile
    ON conversations(profile_id, last_message_at DESC);

-- -----------------------------------------------------------------------
-- Peer relay hints (informs publish targeting)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS peer_relay_hints (
    peer_pubkey  TEXT    NOT NULL,
    profile_id   TEXT    NOT NULL REFERENCES profiles(id),
    relay_url    TEXT    NOT NULL,
    last_seen_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
    PRIMARY KEY (peer_pubkey, relay_url, profile_id)
);

-- -----------------------------------------------------------------------
-- Connection requests (separate from DMs)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS connection_requests (
    event_id      TEXT    NOT NULL,
    profile_id    TEXT    NOT NULL REFERENCES profiles(id),
    sender_pubkey TEXT    NOT NULL,
    intro_message TEXT,
    status        TEXT    NOT NULL DEFAULT 'pending',
    received_at   INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
    PRIMARY KEY (event_id, profile_id)
);

-- -----------------------------------------------------------------------
-- Groups
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS groups (
    id         TEXT    NOT NULL,
    profile_id TEXT    NOT NULL REFERENCES profiles(id),
    name       TEXT    NOT NULL,
    relay_url  TEXT    NOT NULL,
    kind       TEXT    NOT NULL DEFAULT 'public',
    joined_at  INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
    PRIMARY KEY (id, profile_id)
);

CREATE TABLE IF NOT EXISTS group_messages (
    event_id      TEXT    NOT NULL,
    group_id      TEXT    NOT NULL,
    profile_id    TEXT    NOT NULL REFERENCES profiles(id),
    sender_pubkey TEXT    NOT NULL,
    plaintext     TEXT    NOT NULL,
    created_at    INTEGER NOT NULL,
    received_at   INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
    PRIMARY KEY (event_id, profile_id)
);

CREATE TABLE IF NOT EXISTS group_tombstones (
    event_id   TEXT    NOT NULL,
    profile_id TEXT    NOT NULL REFERENCES profiles(id),
    deleted_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
    deleted_by TEXT    NOT NULL,
    PRIMARY KEY (event_id, profile_id)
);

-- -----------------------------------------------------------------------
-- Voice call records
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS call_records (
    call_id      TEXT    PRIMARY KEY,
    profile_id   TEXT    NOT NULL REFERENCES profiles(id),
    peer_pubkey  TEXT    NOT NULL,
    initiated_by TEXT    NOT NULL,
    status       TEXT    NOT NULL,
    started_at   INTEGER,
    ended_at     INTEGER,
    duration_ms  INTEGER
);

-- -----------------------------------------------------------------------
-- Relay checkpoints (resume subscriptions after restart)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS relay_checkpoints (
    profile_id    TEXT    NOT NULL REFERENCES profiles(id),
    relay_url     TEXT    NOT NULL,
    last_event_at INTEGER NOT NULL,
    PRIMARY KEY (profile_id, relay_url)
);
"#;

/// V2: Add received_at index to messages for efficient pagination queries.
pub const SCHEMA_V2: &str = r#"
CREATE INDEX IF NOT EXISTS idx_messages_conv_received
    ON messages(profile_id, conversation_id, received_at);
"#;

/// V3: Full-text search (FTS5) over DM messages and group messages.
///
/// Schema:
///   - `messages_fts` — content table shadowing `messages`; rowid-linked.
///   - `group_messages_fts` — content table shadowing `group_messages`.
///
/// Both tables are content= tables (external content) so the plaintext is
/// stored only once.  INSERT/UPDATE/DELETE triggers keep them in sync.
///
/// Tombstoned messages are NOT removed from the FTS index here; the search
/// query JOIN against tombstones / group_tombstones at query time instead,
/// which is cheaper than maintaining a secondary trigger chain.
pub const SCHEMA_V3: &str = r#"
-- DM full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    event_id    UNINDEXED,
    profile_id  UNINDEXED,
    conversation_id UNINDEXED,
    sender_pubkey   UNINDEXED,
    plaintext,
    created_at  UNINDEXED,
    content='messages',
    content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS messages_fts_ai
AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, event_id, profile_id, conversation_id,
                             sender_pubkey, plaintext, created_at)
    VALUES (new.rowid, new.event_id, new.profile_id, new.conversation_id,
            new.sender_pubkey, new.plaintext, new.created_at);
END;

CREATE TRIGGER IF NOT EXISTS messages_fts_ad
AFTER DELETE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, event_id, profile_id,
                             conversation_id, sender_pubkey, plaintext, created_at)
    VALUES ('delete', old.rowid, old.event_id, old.profile_id,
            old.conversation_id, old.sender_pubkey, old.plaintext, old.created_at);
END;

CREATE TRIGGER IF NOT EXISTS messages_fts_au
AFTER UPDATE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, event_id, profile_id,
                             conversation_id, sender_pubkey, plaintext, created_at)
    VALUES ('delete', old.rowid, old.event_id, old.profile_id,
            old.conversation_id, old.sender_pubkey, old.plaintext, old.created_at);
    INSERT INTO messages_fts(rowid, event_id, profile_id, conversation_id,
                             sender_pubkey, plaintext, created_at)
    VALUES (new.rowid, new.event_id, new.profile_id, new.conversation_id,
            new.sender_pubkey, new.plaintext, new.created_at);
END;

-- Group message full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS group_messages_fts USING fts5(
    event_id    UNINDEXED,
    group_id    UNINDEXED,
    profile_id  UNINDEXED,
    sender_pubkey   UNINDEXED,
    plaintext,
    created_at  UNINDEXED,
    content='group_messages',
    content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS group_messages_fts_ai
AFTER INSERT ON group_messages BEGIN
    INSERT INTO group_messages_fts(rowid, event_id, group_id, profile_id,
                                   sender_pubkey, plaintext, created_at)
    VALUES (new.rowid, new.event_id, new.group_id, new.profile_id,
            new.sender_pubkey, new.plaintext, new.created_at);
END;

CREATE TRIGGER IF NOT EXISTS group_messages_fts_ad
AFTER DELETE ON group_messages BEGIN
    INSERT INTO group_messages_fts(group_messages_fts, rowid, event_id, group_id,
                                   profile_id, sender_pubkey, plaintext, created_at)
    VALUES ('delete', old.rowid, old.event_id, old.group_id, old.profile_id,
            old.sender_pubkey, old.plaintext, old.created_at);
END;

CREATE TRIGGER IF NOT EXISTS group_messages_fts_au
AFTER UPDATE ON group_messages BEGIN
    INSERT INTO group_messages_fts(group_messages_fts, rowid, event_id, group_id,
                                   profile_id, sender_pubkey, plaintext, created_at)
    VALUES ('delete', old.rowid, old.event_id, old.group_id, old.profile_id,
            old.sender_pubkey, old.plaintext, old.created_at);
    INSERT INTO group_messages_fts(rowid, event_id, group_id, profile_id,
                                   sender_pubkey, plaintext, created_at)
    VALUES (new.rowid, new.event_id, new.group_id, new.profile_id,
            new.sender_pubkey, new.plaintext, new.created_at);
END;
"#;

/// V4: Vault local media index (metadata for encrypted vault blobs).
pub const SCHEMA_V4: &str = r#"
CREATE TABLE IF NOT EXISTS vault_media_index (
    remote_url         TEXT    NOT NULL,
    profile_id         TEXT    NOT NULL REFERENCES profiles(id),
    relative_path      TEXT    NOT NULL,
    saved_at_unix_ms   INTEGER NOT NULL,
    file_name          TEXT    NOT NULL,
    content_type       TEXT    NOT NULL DEFAULT 'application/octet-stream',
    size_bytes         INTEGER NOT NULL DEFAULT 0,
    message_event_id   TEXT,
    explicit_chat_save INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (remote_url, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_vault_media_index_profile_saved
    ON vault_media_index(profile_id, saved_at_unix_ms DESC);
"#;
