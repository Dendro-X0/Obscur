CREATE TABLE IF NOT EXISTS invites (
  invite_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  inviter_pubkey TEXT NOT NULL,
  community_label TEXT,
  relays_json TEXT NOT NULL,
  created_at_unix_seconds INTEGER NOT NULL,
  expires_at_unix_seconds INTEGER
);

CREATE INDEX IF NOT EXISTS idx_invites_expires ON invites(expires_at_unix_seconds);

CREATE TABLE IF NOT EXISTS invite_redemptions (
  redemption_id TEXT PRIMARY KEY,
  invite_id TEXT NOT NULL,
  redeemer_pubkey TEXT NOT NULL,
  redeemed_at_unix_seconds INTEGER NOT NULL,
  FOREIGN KEY (invite_id) REFERENCES invites(invite_id)
);

CREATE INDEX IF NOT EXISTS idx_redemptions_invite_id ON invite_redemptions(invite_id);

-- v1.9.2 membership directory (see migrations/0002_membership_directory.sql)
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

-- Phase 1B Slice C (see migrations/0003_member_room_key_wraps.sql)
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
