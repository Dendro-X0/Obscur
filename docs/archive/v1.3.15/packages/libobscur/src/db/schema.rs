pub const INITIAL_SCHEMA: &str = r#"
-- Identities Table
CREATE TABLE IF NOT EXISTS identities (
    pubkey TEXT PRIMARY KEY,
    secret_key_encrypted TEXT,
    display_name TEXT,
    about TEXT,
    picture TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
);

-- Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
    pubkey TEXT PRIMARY KEY,
    alias TEXT,
    about TEXT,
    picture TEXT,
    is_trusted BOOLEAN DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now'))
);

-- Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_pubkey TEXT NOT NULL,
    content_encrypted TEXT NOT NULL,
    kind INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    received_at INTEGER DEFAULT (strftime('%s','now'))
);

-- Index for fast message retrieval
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
"#;
