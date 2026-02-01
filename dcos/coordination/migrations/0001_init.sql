-- Initial schema for Obscur Coordination Service

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
