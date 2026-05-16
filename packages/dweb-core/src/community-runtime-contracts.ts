/**
 * Community Runtime Contracts — v1.5.0 owner boundary types
 *
 * These types define the explicit scope, evidence, and projection contracts
 * required for the single community runtime owner introduced in v1.5.0.
 *
 * All community, restore, sync, and profile-sensitive operations must receive
 * an explicit CommunityRuntimeScope. Storage modules must not derive account
 * or profile scope from mutable ambient state when the caller can pass it.
 */

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

export type CommunityRuntimeScope = Readonly<{
  profileId: string;
  publicKeyHex: string;
  deviceId: string;
  windowId: string;
}>;

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export type CommunityEvidenceSource =
  | "local_user_action"
  | "live_relay"
  | "restore_backup"
  | "legacy_migration"
  | "retry_outbox";

export type CommunityEvidenceFreshness =
  | "current"
  | "historical"
  | "unknown";

export type CommunityEvidence = Readonly<{
  source: CommunityEvidenceSource;
  freshness: CommunityEvidenceFreshness;
  communityId: string;
  groupId: string;
  relayUrl: string;
  observedAtUnixMs: number;
  evidenceId?: string;
}>;

// ---------------------------------------------------------------------------
// Self-membership
// ---------------------------------------------------------------------------

export type CommunitySelfMembershipStatus =
  | "joined"
  | "left"
  | "pending_join"
  | "pending_leave"
  | "historical"
  | "unknown";

/**
 * Private durable self-membership intent.
 *
 * This is the primary guard against ghost communities after fresh-window or
 * fresh-device login. It must be included in encrypted account backup/restore
 * and must take precedence over historical reconstruction.
 */
export type CommunitySelfMembershipIntent = Readonly<{
  scope: CommunityRuntimeScope;
  communityId: string;
  groupId: string;
  relayUrl: string;
  status: "joined" | "left" | "pending_join" | "pending_leave";
  decidedAtUnixMs: number;
  localDecisionId: string;
}>;

// ---------------------------------------------------------------------------
// Relay publish outbox
// ---------------------------------------------------------------------------

export type CommunityRelayPublishOutboxStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "rate_limited";

/**
 * Relay publish is a separate reliability concern from private intent.
 *
 * Rate limiting produces "rate_limited" or "pending", never a rollback of
 * private membership state.
 */
export type CommunityRelayPublishOutboxItem = Readonly<{
  scope: CommunityRuntimeScope;
  localDecisionId: string;
  communityId: string;
  relayUrl: string;
  operation: "join" | "leave" | "disband" | "metadata";
  status: CommunityRelayPublishOutboxStatus;
  attempts: number;
  nextAttemptAtUnixMs?: number;
  lastError?: string;
}>;

// ---------------------------------------------------------------------------
// Restore classification
// ---------------------------------------------------------------------------

/**
 * MessageIngestionMode controls which downstream effects fire.
 *
 * Only "live" may trigger: notifications, unread toasts, voice ringing,
 * active call session transitions.
 */
export type MessageIngestionMode =
  | "live"
  | "restore_static"
  | "outbox_replay";

// ---------------------------------------------------------------------------
// Sendability
// ---------------------------------------------------------------------------

export type CommunitySendabilityStatus =
  | "can_send"
  | "blocked_left"
  | "blocked_pending_leave"
  | "blocked_room_key_missing"
  | "blocked_relay_degraded"
  | "blocked_unknown_membership";
