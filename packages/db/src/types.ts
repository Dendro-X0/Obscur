/**
 * Mirror of libobscur MessageRecord (Rust).
 * Field names match the Rust serde snake_case serialization.
 */
export interface MessageRecord {
  event_id: string;
  profile_id: string;
  conversation_id: string;
  sender_pubkey: string;
  recipient_pubkey: string;
  plaintext: string;
  kind: number;
  created_at: number;
  received_at: number;
  is_outgoing: boolean;
  reply_to_event_id: string | null;
  has_attachment: boolean;
}

/**
 * Mirror of libobscur TombstoneRecord (Rust).
 */
export interface TombstoneRecord {
  event_id: string;
  profile_id: string;
  deleted_at: number;
  deleted_by: string;
}

/**
 * Mirror of libobscur ConversationRecord (Rust).
 */
export interface ConversationRecord {
  id: string;
  profile_id: string;
  peer_pubkey: string;
  last_event_id: string | null;
  last_message_at: number | null;
  last_plaintext_preview: string | null;
  unread_count: number;
}

/**
 * Mirror of libobscur GroupRecord (Rust).
 */
export interface GroupRecord {
  id: string;
  profile_id: string;
  name: string;
  relay_url: string;
  kind: string;
  joined_at: number;
}

/**
 * Mirror of libobscur GroupMessageRecord (Rust).
 */
export interface GroupMessageRecord {
  event_id: string;
  group_id: string;
  profile_id: string;
  sender_pubkey: string;
  plaintext: string;
  created_at: number;
  received_at: number;
}

/**
 * Mirror of libobscur GroupTombstoneRecord (Rust).
 */
export interface GroupTombstoneRecord {
  event_id: string;
  profile_id: string;
  deleted_at: number;
  deleted_by: string;
}

/**
 * Mirror of libobscur RelayCheckpointRecord (Rust).
 * last_event_at is Unix seconds (Nostr `since` filter value).
 */
export interface RelayCheckpointRecord {
  profile_id: string;
  relay_url: string;
  last_event_at: number;
}

/**
 * Mirror of libobscur MessageSearchResult (Rust).
 * Returned by db_search_messages — unified FTS5 result over DM + group messages.
 */
export interface MessageSearchResult {
  /** "dm" | "group" */
  source: string;
  event_id: string;
  profile_id: string;
  /** DM: conversation_id; group: group_id */
  scope_id: string;
  sender_pubkey: string;
  plaintext: string;
  created_at: number;
  /** FTS5 rank — lower is better */
  rank: number;
}

/**
 * Mirror of libobscur CallRecord (Rust).
 * status: 'missed' | 'answered' | 'declined' | 'timeout' | 'ended'
 */
export interface CallRecord {
  call_id: string;
  profile_id: string;
  peer_pubkey: string;
  initiated_by: string;
  status: string;
  started_at: number | null;
  ended_at: number | null;
  duration_ms: number | null;
}
