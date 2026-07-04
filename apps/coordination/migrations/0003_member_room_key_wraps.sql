-- Phase 1B Slice C — E2E-wrapped room keys per member (ciphertext only)

CREATE TABLE IF NOT EXISTS community_member_room_key_wraps (
  wrap_id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL,
  subject_pubkey TEXT NOT NULL,
  wrap_seq INTEGER NOT NULL,
  scheme TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  actor_pubkey TEXT NOT NULL,
  created_at_unix_ms INTEGER NOT NULL,
  signature TEXT NOT NULL,
  UNIQUE (community_id, subject_pubkey, wrap_seq)
);

CREATE INDEX IF NOT EXISTS idx_room_key_wraps_community_subject_seq
  ON community_member_room_key_wraps (community_id, subject_pubkey, wrap_seq);
