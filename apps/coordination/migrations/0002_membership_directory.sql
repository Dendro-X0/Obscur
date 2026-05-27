-- v1.9.2 B2 — community membership directory (signed deltas, no message plaintext)

CREATE TABLE IF NOT EXISTS community_membership_heads (
  community_id TEXT PRIMARY KEY,
  latest_seq INTEGER NOT NULL DEFAULT 0,
  head_hash TEXT NOT NULL DEFAULT '',
  updated_at_unix_ms INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS community_membership_deltas (
  delta_id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  action TEXT NOT NULL,
  subject_pubkey TEXT NOT NULL,
  actor_pubkey TEXT NOT NULL,
  created_at_unix_ms INTEGER NOT NULL,
  signature TEXT NOT NULL,
  UNIQUE (community_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_membership_deltas_community_seq
  ON community_membership_deltas (community_id, seq);
