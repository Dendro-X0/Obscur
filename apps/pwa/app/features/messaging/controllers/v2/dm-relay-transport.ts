/**
 * dm-relay-transport.ts
 *
 * Single canonical relay transport layer for DM messaging.
 * Owns: publish to relays, subscribe to incoming events, connection management.
 * Does NOT own: encryption, message state, persistence.
 */

import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type {
  NostrFilter,
  PublishResult,
  RelayPoolContract,
} from "./dm-controller-types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUBSCRIBE_SINCE_SKEW_SECONDS = 30;
const MIN_QUORUM = 1;

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

export const publishToRelays = async (params: Readonly<{
  pool: RelayPoolContract;
  signedEvent: NostrEvent;
  targetRelayUrls?: ReadonlyArray<string>;
}>): Promise<PublishResult> => {
  const { pool, signedEvent, targetRelayUrls } = params;
  const eventPayload = JSON.stringify(["EVENT", signedEvent]);

  // Prefer scoped publish to target relays
  if (targetRelayUrls && targetRelayUrls.length > 0 && pool.publishToUrls) {
    try {
      const result = await pool.publishToUrls(targetRelayUrls, eventPayload);
      const mapped = mapPoolResult(result);
      if (mapped.success) return mapped;
      // Scoped publish failed — fall through to broadcast
      console.warn("[dm-relay-transport] publishToUrls returned failure, falling back to broadcast", {
        targetRelayCount: targetRelayUrls.length,
        successCount: mapped.successCount,
      });
    } catch (err) {
      console.warn("[dm-relay-transport] publishToUrls threw, falling back", err);
    }
  }

  // Fallback to broadcast
  if (pool.publishToAll) {
    try {
      const result = await pool.publishToAll(eventPayload);
      return mapPoolResult(result);
    } catch (err) {
      console.warn("[dm-relay-transport] publishToAll threw, falling back to sendToOpen", err);
    }
  }

  // Last resort: sendToOpen (fire-and-forget, no confirmation)
  try {
    pool.sendToOpen(eventPayload);
    const openRelayCount = pool.connections.filter(c => c.status === "open").length;
    return {
      success: openRelayCount > 0,
      successCount: openRelayCount,
      totalRelays: openRelayCount,
      outcomes: pool.connections
        .filter(c => c.status === "open")
        .map(c => ({ relayUrl: c.url, success: true })),
    };
  } catch (err) {
    return {
      success: false,
      successCount: 0,
      totalRelays: 0,
      outcomes: [],
      overallError: err instanceof Error ? err.message : String(err),
    };
  }
};

const mapPoolResult = (raw: {
  success: boolean;
  successCount: number;
  totalRelays: number;
  results: Array<{ relayUrl: string; success: boolean; error?: string; latency?: number }>;
  overallError?: string;
}): PublishResult => ({
  success: raw.successCount >= MIN_QUORUM,
  successCount: raw.successCount,
  totalRelays: raw.totalRelays,
  outcomes: raw.results.map(r => ({
    relayUrl: r.relayUrl,
    success: r.success,
    error: r.error,
    latencyMs: r.latency,
    latency: r.latency,
  })),
  overallError: raw.overallError,
});

// ---------------------------------------------------------------------------
// Subscribe
// ---------------------------------------------------------------------------

export type SubscriptionHandle = Readonly<{
  id: string;
  unsubscribe: () => void;
}>;

export const subscribeToIncomingDMs = (params: Readonly<{
  pool: RelayPoolContract;
  myPublicKeyHex: string;
  onEvent: (event: NostrEvent, relayUrl: string) => void;
}>): SubscriptionHandle => {
  const { pool, myPublicKeyHex, onEvent } = params;

  const sinceUnixSeconds = Math.max(
    0,
    Math.floor(Date.now() / 1000) - SUBSCRIBE_SINCE_SKEW_SECONDS,
  );

  const filters: ReadonlyArray<NostrFilter> = [
    {
      kinds: [4, 1059],
      "#p": [myPublicKeyHex],
      limit: 50,
      since: sinceUnixSeconds,
    },
    {
      kinds: [4],
      authors: [myPublicKeyHex],
      limit: 50,
      since: sinceUnixSeconds,
    },
  ];

  const subId = pool.subscribe(filters, onEvent);

  return {
    id: subId,
    unsubscribe: () => {
      pool.unsubscribe(subId);
    },
  };
};

// ---------------------------------------------------------------------------
// Relay URL resolution
// ---------------------------------------------------------------------------

export const resolveTargetRelayUrls = (params: Readonly<{
  pool: RelayPoolContract;
  peerPublicKeyHex: string;
}>): ReadonlyArray<string> => {
  const { pool } = params;
  // Use writable relays if snapshot is available
  if (pool.getWritableRelaySnapshot) {
    const snapshot = pool.getWritableRelaySnapshot();
    if (snapshot.writableRelayUrls.length > 0) {
      return snapshot.writableRelayUrls;
    }
  }

  // Fallback: all open connections
  return pool.connections
    .filter(c => c.status === "open")
    .map(c => c.url);
};
