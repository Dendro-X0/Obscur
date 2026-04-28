/**
 * Community Membership Gossip Protocol
 * 
 * Phase 2 of the CRDT Protocol Rewrite: Gossip-based membership synchronization.
 * 
 * This module implements:
 * - Delta generation for efficient sync
 * - Nostr event encoding for membership deltas
 * - Anti-entropy protocol for reconciliation
 * - Publish/subscribe for real-time gossip
 * 
 * @example
 * ```typescript
 * // Generate delta since last sync
 * const delta = generateMembershipDelta(membership, lastKnownClock);
 * 
 * // Encode as Nostr event
 * const event = encodeMembershipDeltaAsNostrEvent(delta, communityId, signer);
 * 
 * // Apply received delta
 * const updated = applyMembershipDelta(membership, decodedDelta);
 * ```
 */

import type { CommunityMembership, MembershipDelta } from './community-membership-crdt.js';
import {
  createMembershipDelta,
  applyMembershipDelta,
  getMembershipClock,
} from './community-membership-crdt.js';
import type { VectorClock } from '@dweb/crdt/vector-clock';
import { vectorCompare, mergeClocks } from '@dweb/crdt/vector-clock';
import { logAppEvent } from '@/app/shared/log-app-event';

/**
 * Nostr event kind for membership gossip.
 */
export const MEMBERSHIP_GOSSIP_EVENT_KIND = 39001;

/**
 * Nostr event kind for membership anti-entropy requests.
 */
export const MEMBERSHIP_ANTI_ENTROPY_REQUEST_KIND = 39002;

/**
 * Gossip configuration options.
 */
export interface GossipConfig {
  /** Maximum delta size in bytes before falling back to full sync */
  maxDeltaSizeBytes: number;
  /** Anti-entropy interval in milliseconds */
  antiEntropyIntervalMs: number;
  /** Gossip fanout (how many peers to gossip to) */
  gossipFanout: number;
  /** Enable verbose logging */
  verboseLogging: boolean;
}

/**
 * Default gossip configuration.
 */
export const DEFAULT_GOSSIP_CONFIG: GossipConfig = {
  maxDeltaSizeBytes: 50000, // 50KB
  antiEntropyIntervalMs: 30000, // 30 seconds
  gossipFanout: 3,
  verboseLogging: false,
};

/**
 * Encoded delta for transmission.
 */
export interface EncodedMembershipDelta {
  /** Community ID */
  communityId: string;
  /** Sender device ID */
  senderDeviceId: string;
  /** Vector clock at time of delta generation */
  vectorClock: VectorClock;
  /** Base64-encoded delta payload */
  payload: string;
  /** Unix timestamp (milliseconds) */
  timestamp: number;
}

/**
 * Anti-entropy request.
 */
export interface AntiEntropyRequest {
  /** Community ID */
  communityId: string;
  /** Requester device ID */
  deviceId: string;
  /** Known vector clock (what we have) */
  knownClock: VectorClock;
  /** Request timestamp */
  timestamp: number;
}

/**
 * Anti-entropy response.
 */
export interface AntiEntropyResponse {
  /** Community ID */
  communityId: string;
  /** Responder device ID */
  deviceId: string;
  /** Delta to bring requester up to date */
  delta: MembershipDelta;
  /** Responder's current clock */
  responderClock: VectorClock;
  /** Response timestamp */
  timestamp: number;
}

/**
 * Generate gossip configuration with optional overrides.
 */
export function createGossipConfig(overrides?: Partial<GossipConfig>): GossipConfig {
  return {
    ...DEFAULT_GOSSIP_CONFIG,
    ...overrides,
  };
}

/**
 * Generate a membership delta for gossip.
 * 
 * Creates a delta containing only changes since the given clock.
 * If the delta would be too large, returns null (fall back to full sync).
 */
export function generateGossipDelta(
  membership: CommunityMembership,
  sinceClock: VectorClock | null,
  config: GossipConfig = DEFAULT_GOSSIP_CONFIG
): MembershipDelta | null {
  const delta = sinceClock 
    ? createMembershipDelta(membership, sinceClock)
    : createMembershipDelta(membership, {});
  
  // Estimate size (rough approximation)
  const estimatedSize = JSON.stringify(delta).length * 2; // UTF-16
  
  if (estimatedSize > config.maxDeltaSizeBytes) {
    logAppEvent({
      name: 'crdt.gossip.delta_too_large',
      level: 'warn',
      scope: { feature: 'crdt', action: 'gossip' },
      context: {
        communityId: membership.communityId,
        estimatedSize,
        maxSize: config.maxDeltaSizeBytes,
      }
    });
    return null;
  }
  
  if (config.verboseLogging) {
    logAppEvent({
      name: 'crdt.gossip.delta_generated',
      level: 'info',
      scope: { feature: 'crdt', action: 'gossip' },
      context: {
        communityId: membership.communityId,
        adds: delta.adds.length,
        removes: delta.removes.length,
        estimatedSize,
      }
    });
  }
  
  return delta;
}

/**
 * Encode membership delta for Nostr transmission.
 */
export function encodeMembershipDelta(
  delta: MembershipDelta,
  membership: CommunityMembership
): EncodedMembershipDelta {
  const payload = btoa(JSON.stringify(delta));
  
  return {
    communityId: membership.communityId,
    senderDeviceId: membership.localDeviceId,
    vectorClock: membership.vectorClock,
    payload,
    timestamp: Date.now(),
  };
}

/**
 * Decode membership delta from Nostr event content.
 */
export function decodeMembershipDelta(encoded: EncodedMembershipDelta): MembershipDelta {
  const decoded = JSON.parse(atob(encoded.payload));
  return decoded as MembershipDelta;
}

/**
 * Create Nostr event for membership gossip.
 */
export function createMembershipGossipEvent(
  encodedDelta: EncodedMembershipDelta,
  signer: { signEvent: (event: { kind: number; content: string; tags: string[][]; created_at: number }) => Promise<{ id: string; sig: string }> },
  relayHints?: string[]
): Promise<{
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}> {
  const content = JSON.stringify({
    communityId: encodedDelta.communityId,
    payload: encodedDelta.payload,
    vectorClock: encodedDelta.vectorClock,
  });
  
  const tags: string[][] = [
    ['d', encodedDelta.communityId],
    ['device', encodedDelta.senderDeviceId],
    ['t', 'membership-delta'],
  ];
  
  // Add relay hints for better delivery
  if (relayHints) {
    relayHints.forEach(url => {
      tags.push(['r', url]);
    });
  }
  
  const eventTemplate = {
    kind: MEMBERSHIP_GOSSIP_EVENT_KIND,
    content,
    tags,
    created_at: Math.floor(encodedDelta.timestamp / 1000),
  };
  
  return signer.signEvent(eventTemplate).then(sig => ({
    ...eventTemplate,
    id: sig.id,
    sig: sig.sig,
    pubkey: '', // Will be filled by signer
  }));
}

/**
 * Parse membership gossip from Nostr event.
 */
export function parseMembershipGossipEvent(
  event: { kind: number; content: string; tags: string[][]; pubkey: string }
): EncodedMembershipDelta | null {
  if (event.kind !== MEMBERSHIP_GOSSIP_EVENT_KIND) {
    return null;
  }
  
  try {
    const parsed = JSON.parse(event.content);
    const deviceTag = event.tags.find(t => t[0] === 'device');
    
    return {
      communityId: parsed.communityId,
      senderDeviceId: deviceTag?.[1] ?? event.pubkey.slice(0, 32),
      vectorClock: parsed.vectorClock,
      payload: parsed.payload,
      timestamp: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Create anti-entropy request.
 */
export function createAntiEntropyRequest(
  communityId: string,
  deviceId: string,
  knownClock: VectorClock
): AntiEntropyRequest {
  return {
    communityId,
    deviceId,
    knownClock,
    timestamp: Date.now(),
  };
}

/**
 * Create anti-entropy response.
 */
export function createAntiEntropyResponse(
  membership: CommunityMembership,
  request: AntiEntropyRequest
): AntiEntropyResponse | null {
  // Check if we have any changes the requester doesn't have
  const ourClock = getMembershipClock(membership);
  const comparison = vectorCompare(ourClock, request.knownClock);
  
  // If we're behind or equal, no response needed
  if (comparison <= 0) {
    return null;
  }
  
  // Generate delta for what requester is missing
  const delta = createMembershipDelta(membership, request.knownClock);
  
  return {
    communityId: membership.communityId,
    deviceId: membership.localDeviceId,
    delta,
    responderClock: ourClock,
    timestamp: Date.now(),
  };
}

/**
 * Apply anti-entropy response to local membership.
 */
export function applyAntiEntropyResponse(
  membership: CommunityMembership,
  response: AntiEntropyResponse
): CommunityMembership {
  if (response.communityId !== membership.communityId) {
    throw new Error(`Community ID mismatch: ${response.communityId} vs ${membership.communityId}`);
  }
  
  const updated = applyMembershipDelta(membership, response.delta);
  
  logAppEvent({
    name: 'crdt.gossip.anti_entropy_applied',
    level: 'info',
    scope: { feature: 'crdt', action: 'gossip' },
    context: {
      communityId: membership.communityId,
      fromDevice: response.deviceId.slice(0, 16) + '...',
      addsApplied: response.delta.adds.length,
      removesApplied: response.delta.removes.length,
    }
  });
  
  return updated;
}

/**
 * Determine if anti-entropy is needed.
 * 
 * Returns true if remote clock has events we don't have.
 */
export function needsAntiEntropy(
  localClock: VectorClock,
  remoteClock: VectorClock
): boolean {
  const comparison = vectorCompare(localClock, remoteClock);
  return comparison < 0; // We're behind
}

/**
 * Gossip manager for a community.
 * 
 * Manages periodic anti-entropy and gossip fanout.
 */
export interface GossipManager {
  /** Start gossip manager */
  start(): void;
  /** Stop gossip manager */
  stop(): void;
  /** Trigger immediate gossip */
  gossipNow(): void;
  /** Request anti-entropy from peers */
  requestAntiEntropy(): void;
  /** Get last gossip timestamp */
  getLastGossipTime(): number;
  /** Get pending delta count */
  getPendingCount(): number;
}

/**
 * Create gossip manager for community membership.
 */
export function createMembershipGossipManager(
  communityId: string,
  deviceId: string,
  getMembership: () => CommunityMembership,
  setMembership: (m: CommunityMembership) => void,
  publishEvent: (event: unknown) => Promise<void>,
  config: GossipConfig = DEFAULT_GOSSIP_CONFIG
): GossipManager {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let lastGossipTime = 0;
  let pendingDeltas: MembershipDelta[] = [];
  
  const doGossip = async () => {
    const membership = getMembership();
    const delta = generateGossipDelta(membership, null, config);
    
    if (!delta || (delta.adds.length === 0 && delta.removes.length === 0)) {
      return;
    }
    
    const encoded = encodeMembershipDelta(delta, membership);
    
    // In a real implementation, this would create and sign a Nostr event
    // For now, we emit a window event for the relay layer to pick up
    window.dispatchEvent(new CustomEvent('obscur:crdt-membership-gossip', {
      detail: {
        communityId,
        deviceId,
        encoded,
      }
    }));
    
    lastGossipTime = Date.now();
    pendingDeltas = [];
    
    if (config.verboseLogging) {
      logAppEvent({
        name: 'crdt.gossip.sent',
        level: 'info',
        scope: { feature: 'crdt', action: 'gossip' },
        context: { communityId, adds: delta.adds.length, removes: delta.removes.length }
      });
    }
  };
  
  const doAntiEntropy = async () => {
    const membership = getMembership();
    const clock = getMembershipClock(membership);
    
    window.dispatchEvent(new CustomEvent('obscur:crdt-anti-entropy-request', {
      detail: {
        communityId,
        deviceId,
        knownClock: clock,
      }
    }));
  };
  
  return {
    start() {
      if (intervalId) return;
      
      intervalId = setInterval(() => {
        doAntiEntropy();
      }, config.antiEntropyIntervalMs);
      
      logAppEvent({
        name: 'crdt.gossip.started',
        level: 'info',
        scope: { feature: 'crdt', action: 'gossip' },
        context: { communityId, intervalMs: config.antiEntropyIntervalMs }
      });
    },
    
    stop() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      
      logAppEvent({
        name: 'crdt.gossip.stopped',
        level: 'info',
        scope: { feature: 'crdt', action: 'gossip' },
        context: { communityId }
      });
    },
    
    gossipNow() {
      void doGossip();
    },
    
    requestAntiEntropy() {
      void doAntiEntropy();
    },
    
    getLastGossipTime() {
      return lastGossipTime;
    },
    
    getPendingCount() {
      return pendingDeltas.length;
    },
  };
}

/**
 * Utility to merge delta into membership and notify listeners.
 */
export function mergeGossipDelta(
  membership: CommunityMembership,
  encodedDelta: EncodedMembershipDelta,
  onUpdated?: (updated: CommunityMembership) => void
): CommunityMembership {
  const delta = decodeMembershipDelta(encodedDelta);
  let updated = applyMembershipDelta(membership, delta);
  
  // Merge sender's vector clock and update metadata immutably
  updated = {
    ...updated,
    vectorClock: mergeClocks(updated.vectorClock, encodedDelta.vectorClock),
    metadata: {
      ...updated.metadata,
      lastModifiedAt: Date.now(),
      operationCount: updated.metadata.operationCount + delta.adds.length + delta.removes.length,
    },
  };
  
  if (onUpdated) {
    onUpdated(updated);
  }
  
  return updated;
}
