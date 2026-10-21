/**
 * Port surfaces for ProtocolAdaptationLayer (Slice S4 → owned by S5 package).
 *
 * Platform (Obscur) — prefer for new protocol-neutral shell work:
 *   listConversations · listMessages · sendMessage · Canonical*
 *
 * Obscur-Nostr rich — existing MessagingProvider / dm-controller / thread hook:
 *   listDmConversations · listDmMessages · sendDm · sendConnectionRequest
 * These stay wired for behavior parity. They are not the long-term platform DTO.
 *
 * Obscur-Nostr private — always Nostr wire even if Matrix is the active protocol id:
 *   nostrAdapter.sendDm · nostrAdapter.sendConnectionRequest
 * Use for delete/retry and other Nostr-only pipelines (see D1).
 */

export const PLATFORM_CANONICAL_PORTS = [
  "listConversations",
  "listMessages",
  "sendMessage",
] as const;

export const OBSCUR_NOSTR_RICH_PORTS = [
  "listDmConversations",
  "listDmMessages",
  "sendDm",
  "sendConnectionRequest",
] as const;

export const OBSCUR_NOSTR_PRIVATE_SEND = "nostrAdapter.sendDm" as const;
