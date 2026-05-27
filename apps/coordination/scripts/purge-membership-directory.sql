-- Dev-only: wipe coordination membership directory (local D1).
DELETE FROM community_membership_deltas;
DELETE FROM community_membership_heads;
