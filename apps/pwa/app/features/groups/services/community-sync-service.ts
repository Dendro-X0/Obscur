/**
 * Community Sync Service
 *
 * Handles publishing and subscribing to community operations via Nostr relays.
 * Uses Nostr's native gossip protocol for operation distribution.
 *
 * Operations are published as Nostr events with kind 9021 (custom for community ops).
 * Each subscription receives operations from the relay and merges them into the local log.
 *
 * Key features:
 * - Publish: Send signed operations to relay
 * - Subscribe: Receive operations from relay and merge
 * - Gossip: Relay forwards to all subscribers
 * - Catching up: New subscribers get recent operations via NIP-01 filters
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityMembershipOperation, CommunityOperationType } from "./community-operation-log";
import { addOperation, loadOperationLog } from "./community-operation-log";
import { computeCommunityState } from "./community-crdt-engine";
import { logAppEvent } from "@/app/shared/log-app-event";
import { getProfileRuntimeScope, getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

// Nostr event kind for community operations
const COMMUNITY_OP_KIND = 9021;

/** Legacy window event when derived community state changes after a relay op merge */
export const COMMUNITY_STATE_UPDATED_EVENT = "obscur:community-state-updated" as const;

// Sync state by community
interface SyncState {
  readonly subscriptionId: string | null;
  readonly lastPublishedClock: Record<string, number>;
  readonly pendingPublishes: Set<string>;
}

const syncStateByProfileAndCommunity = new Map<string, SyncState>();

const syncStateKey = (communityId: string, profileId?: string): string => {
  const resolvedProfileId = profileId ?? getResolvedProfileId();
  return `${resolvedProfileId}:${communityId}`;
};

/**
 * Convert operation to Nostr event format
 */
const operationToNostrEvent = (op: CommunityMembershipOperation): {
  kind: number;
  content: string;
  tags: string[][];
  pubkey: string;
  id: string;
  sig: string;
} => {
  // Content is encrypted or empty (data is in tags)
  const content = JSON.stringify({
    metadata: op.metadata,
    timestamp: op.timestamp,
  });

  // Tags carry the essential data
  const tags = [
    ["e", op.communityId],           // community reference
    ["p", op.subjectPubkey],           // subject
    ["actor", op.actorPubkey],       // actor
    ["op", op.type],                 // operation type
    ["vc", JSON.stringify(op.vectorClock)], // vector clock
    ["id", op.id],                   // operation id (hash)
    ["relay", op.relayUrl],          // authoritative relay
  ];

  return {
    kind: COMMUNITY_OP_KIND,
    content,
    tags,
    pubkey: op.actorPubkey,
    id: op.id,
    sig: op.signature,
  };
};

/**
 * Parse Nostr event back to operation
 */
const nostrEventToOperation = (
  event: {
    kind: number;
    content: string;
    tags: string[][];
    pubkey: string;
    id: string;
    sig: string;
  }
): CommunityMembershipOperation | null => {
  try {
    const tagMap = new Map(event.tags.map(t => [t[0], t.slice(1)]));
    
    const communityId = tagMap.get("e")?.[0];
    const subjectPubkey = tagMap.get("p")?.[0] as PublicKeyHex;
    const actorPubkey = tagMap.get("actor")?.[0] as PublicKeyHex;
    const type = tagMap.get("op")?.[0] as CommunityOperationType;
    const vectorClock = JSON.parse(tagMap.get("vc")?.[0] ?? "{}");
    const opId = tagMap.get("id")?.[0];
    const relayUrl = tagMap.get("relay")?.[0] ?? "unknown";
    
    if (!communityId || !subjectPubkey || !actorPubkey || !type || !opId) {
      return null;
    }

    const content = JSON.parse(event.content || "{}");

    return {
      id: opId,
      type,
      communityId,
      subjectPubkey,
      actorPubkey,
      vectorClock,
      timestamp: content.timestamp ?? Date.now(),
      relayUrl,
      metadata: content.metadata,
      signature: event.sig,
    };
  } catch {
    return null;
  }
};

/**
 * Publish an operation to the relay
 */
export const publishOperation = async (
  pool: { publishToUrls: (urls: string[], event: unknown) => Promise<void> },
  operation: CommunityMembershipOperation,
  relayUrls: string[]
): Promise<boolean> => {
  try {
    const nostrEvent = operationToNostrEvent(operation);
    
    await pool.publishToUrls(relayUrls, nostrEvent);

    // Track pending
    const stateKey = syncStateKey(operation.communityId);
    const state = syncStateByProfileAndCommunity.get(stateKey) ?? {
      subscriptionId: null,
      lastPublishedClock: {},
      pendingPublishes: new Set(),
    };
    syncStateByProfileAndCommunity.set(stateKey, {
      ...state,
      pendingPublishes: new Set([...state.pendingPublishes, operation.id]),
      lastPublishedClock: {
        ...state.lastPublishedClock,
        ...operation.vectorClock,
      },
    });

    logAppEvent({
      name: "community.operation.published",
      level: "info",
      context: {
        operationId: operation.id,
        type: operation.type,
        communityId: operation.communityId,
        relayCount: relayUrls.length,
      },
    });

    return true;
  } catch (error) {
    logAppEvent({
      name: "community.operation.publish_failed",
      level: "error",
      context: {
        operationId: operation.id,
        error: String(error),
      },
    });
    return false;
  }
};

/**
 * Subscribe to operations for a community
 */
export const subscribeToCommunity = (
  pool: { 
    subscribeToUrls: (urls: string[], filters: unknown[], onEvent: (e: unknown) => void) => string;
    unsubscribe: (id: string) => void;
  },
  communityId: string,
  relayUrls: string[],
  publicKeyHex: string
): string => {
  const profileId = getResolvedProfileId();
  const stateKey = syncStateKey(communityId, profileId);
  // Unsubscribe existing
  const existing = syncStateByProfileAndCommunity.get(stateKey);
  if (existing?.subscriptionId) {
    pool.unsubscribe(existing.subscriptionId);
  }

  // Nostr filter for community operations
  const filters = [
    {
      kinds: [COMMUNITY_OP_KIND],
      "#e": [communityId], // tag 'e' equals communityId
      since: Math.floor(Date.now() / 1000) - 86400, // last 24 hours
    },
  ];

  // Handler for incoming events
  const onEvent = (event: unknown) => {
    const e = event as {
      kind: number;
      content: string;
      tags: string[][];
      pubkey: string;
      id: string;
      sig: string;
    };

    if (e.kind !== COMMUNITY_OP_KIND) return;

    const operation = nostrEventToOperation(e);
    if (!operation) return;

    const profileId = getResolvedProfileId();

    // Add to local log
    const added = addOperation(publicKeyHex, operation, {
      profileId,
      receivedFrom: "relay",
    });

    if (added) {
      // Compute new state and notify
      const operations = loadOperationLog(publicKeyHex, { profileId });
      const state = computeCommunityState(communityId, operations);

      // Emit update for UI
      const detail = { communityId, state, operation, profileId };
      const scope = getProfileRuntimeScope();
      if (scope?.bus && scope.profileId === profileId) {
        scope.bus.publish({
          type: "community-state-updated",
          detail,
        });
      }
    }
  };

  // Subscribe
  const subscriptionId = pool.subscribeToUrls(relayUrls, filters, onEvent);

  syncStateByProfileAndCommunity.set(stateKey, {
    subscriptionId,
    lastPublishedClock: existing?.lastPublishedClock ?? {},
    pendingPublishes: existing?.pendingPublishes ?? new Set(),
  });

  logAppEvent({
    name: "community.sync.subscribed",
    level: "info",
    context: { communityId, relayCount: relayUrls.length },
  });

  return subscriptionId;
};

/**
 * Unsubscribe from a community
 */
export const unsubscribeFromCommunity = (
  pool: { unsubscribe: (id: string) => void },
  communityId: string,
  options?: Readonly<{ profileId?: string }>,
): void => {
  const stateKey = syncStateKey(communityId, options?.profileId);
  const state = syncStateByProfileAndCommunity.get(stateKey);
  if (state?.subscriptionId) {
    pool.unsubscribe(state.subscriptionId);
    syncStateByProfileAndCommunity.delete(stateKey);
  }
};

/**
 * Perform anti-entropy sync with a peer
 * (exchange missing operations)
 */
export const syncWithPeer = async (
  peerPublicKey: PublicKeyHex,
  communityId: string,
  _localOps: CommunityMembershipOperation[]
): Promise<number> => {
  // In a real implementation, this would:
  // 1. Exchange vector clocks with peer
  // 2. Request ops the peer has that we don't (based on clock comparison)
  // 3. Send ops we have that peer doesn't
  
  // For now, stub - real implementation needs P2P connection
  logAppEvent({
    name: "community.sync.peer_requested",
    level: "info",
    context: { peer: peerPublicKey.slice(-8), communityId },
  });
  
  return 0;
};

/**
 * Get sync status for debugging
 */
export const getSyncStatus = (
  communityId: string,
  options?: Readonly<{ profileId?: string }>,
): {
  subscribed: boolean;
  pendingPublishes: number;
  lastPublishedClock: Record<string, number>;
} => {
  const state = syncStateByProfileAndCommunity.get(syncStateKey(communityId, options?.profileId));
  return {
    subscribed: !!state?.subscriptionId,
    pendingPublishes: state?.pendingPublishes.size ?? 0,
    lastPublishedClock: state?.lastPublishedClock ?? {},
  };
};

// For testing
export const syncServiceInternals = {
  resetSyncState: () => {
    syncStateByProfileAndCommunity.clear();
  },
  syncStateKey,
};
