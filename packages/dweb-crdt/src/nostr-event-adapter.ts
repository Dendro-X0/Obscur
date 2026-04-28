/**
 * Nostr Event Adapter for CRDT Integration
 * 
 * This module provides utilities to:
 * 1. Extract vector clocks from Nostr events
 * 2. Convert Nostr events to CRDT operations
 * 3. Build CRDT containers from event replay
 * 4. Generate Nostr-compatible timestamps for CRDTs
 * 
 * This bridges the gap between Nostr's event-based transport and
 * the application's CRDT-based state containers.
 * 
 * @example
 * ```typescript
 * // Extract vector clock from Nostr event
 * const clock = eventToVectorClock(nostrEvent, 'device123');
 * 
 * // Build OR-Set from community membership events
 * const memberSet = replayEventsToORSet(
 *   communityEvents,
 *   (event) => event.pubkey,
 *   'device123'
 * );
 * 
 * // Build LWW-Element-Set from DM history
 * const messages = replayEventsToLWWSet(
 *   dmEvents,
 *   (event) => event.id,
 *   (event) => event.content,
 *   'device123'
 * );
 * ```
 */

import type { DeviceId, VectorClock } from './vector-clock.js';
import { createVectorClock, incrementClock, mergeClocks } from './vector-clock.js';
import type { ORSet } from './or-set.js';
import { createORSet, addToORSet, removeFromORSet } from './or-set.js';
import type { LWWElementSet } from './lww-element-set.js';
import { createLWWElementSet, addToLWWSet } from './lww-element-set.js';

/**
 * Nostr event interface (minimal subset needed for CRDT adapter).
 */
export interface NostrEventLike {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  content: string;
  tags: string[][];
  sig: string;
}

/**
 * Extract a vector clock from a Nostr event.
 * 
 * Strategy:
 * 1. Use event.created_at as the base timestamp
 * 2. Use event.id (or a counter) for causality within the same timestamp
 * 3. Track the device (event.pubkey) as the clock source
 * 
 * For true vector clock semantics across devices, we need to track
 * seen events from other devices. This function creates a minimal
 * clock from the event itself; full causality requires gossip.
 */
export const eventToVectorClock = (
  event: NostrEventLike,
  deviceId: DeviceId,
  knownClock?: VectorClock
): VectorClock => {
  // Start with known clock or empty
  const base = knownClock ?? {};
  
  // Increment our device's counter
  // Use created_at as a proxy for logical time
  const counter = event.created_at;
  
  return {
    ...base,
    [deviceId]: counter,
  };
};

/**
 * Extract device ID from Nostr event.
 * Uses the event's pubkey as the device identifier.
 */
export const eventToDeviceId = (event: NostrEventLike): DeviceId =>
  event.pubkey;

/**
 * Convert Unix timestamp (Nostr format) to milliseconds (JS format).
 */
export const nostrTimestampToMs = (createdAt: number): number =>
  createdAt * 1000;

/**
 * Convert JS milliseconds to Nostr Unix timestamp.
 */
export const msToNostrTimestamp = (ms: number): number =>
  Math.floor(ms / 1000);

/**
 * Replay a sequence of Nostr events into an OR-Set.
 * 
 * @param events Nostr events representing add/remove operations
 * @param extractValue Function to extract the set value from an event
 * @param extractAction Function to determine if this is 'add' or 'remove'
 * @param deviceId Local device identifier for vector clock
 * @param initialSet Optional initial OR-Set to extend
 */
export const replayEventsToORSet = <T>(
  events: NostrEventLike[],
  extractValue: (event: NostrEventLike) => T,
  extractAction: (event: NostrEventLike) => 'add' | 'remove' | 'ignore',
  deviceId: DeviceId,
  initialSet?: ORSet<T>
): ORSet<T> => {
  let set = initialSet ?? createORSet<T>();
  let clock: VectorClock = {};
  
  for (const event of events) {
    // Update clock with this event
    clock = eventToVectorClock(event, deviceId, clock);
    
    const action = extractAction(event);
    const value = extractValue(event);
    
    if (action === 'add') {
      set = addToORSet(set, value, deviceId, clock);
    } else if (action === 'remove') {
      set = removeFromORSet(set, value);
    }
    // 'ignore' skips the event
  }
  
  return set;
};

/**
 * Replay a sequence of Nostr events into an LWW-Element-Set.
 * 
 * @param events Nostr events representing element additions/updates
 * @param extractId Function to extract element ID from event
 * @param extractValue Function to extract element value from event
 * @param deviceId Local device identifier
 * @param initialSet Optional initial set to extend
 */
export const replayEventsToLWWSet = <T>(
  events: NostrEventLike[],
  extractId: (event: NostrEventLike) => string,
  extractValue: (event: NostrEventLike) => T,
  deviceId: DeviceId,
  initialSet?: LWWElementSet<T>
): LWWElementSet<T> => {
  let set = initialSet ?? createLWWElementSet<T>();
  let clock: VectorClock = {};
  
  for (const event of events) {
    clock = eventToVectorClock(event, deviceId, clock);
    
    const id = extractId(event);
    const value = extractValue(event);
    const timestamp = nostrTimestampToMs(event.created_at);
    
    set = addToLWWSet(set, id, value, deviceId, clock, timestamp);
  }
  
  return set;
};

/**
 * Nostr kind constants for Obscur CRDT events.
 * These should align with the application's NIP definitions.
 */
export const NOSTR_KINDS = {
  // Standard Nostr kinds
  METADATA: 0,
  TEXT_NOTE: 1,
  CONTACTS: 3,
  ENCRYPTED_DM: 4,
  DELETION: 5,
  REACTION: 7,
  
  // Obscur-specific kinds (placeholder values - use actual assigned numbers)
  COMMUNITY_MEMBERSHIP: 30000,
  COMMUNITY_MEMBERSHIP_REMOVE: 30001,
  PRESENCE_HEARTBEAT: 30002,
  CALL_STATE: 30003,
  TYPING_INDICATOR: 30004,
} as const;

/**
 * Create a Nostr event from a CRDT operation.
 * This serializes the CRDT metadata into event tags.
 * 
 * @param kind Nostr event kind
 * @param content Event content
 * @param vectorClock Vector clock for causality
 * @param deviceId Device that created the operation
 * @param tags Additional Nostr tags
 */
export const crdtOperationToNostrEvent = (
  kind: number,
  content: string,
  vectorClock: VectorClock,
  deviceId: DeviceId,
  tags: string[][] = []
): Omit<NostrEventLike, 'id' | 'pubkey' | 'sig'> => {
  const now = Math.floor(Date.now() / 1000);
  
  // Serialize vector clock into tags
  const clockTags = Object.entries(vectorClock).map(
    ([device, count]) => ['c', device, String(count)]
  );
  
  // Add device tag
  const deviceTag: string[] = ['d', deviceId];
  
  return {
    kind,
    content,
    created_at: now,
    tags: [...tags, deviceTag, ...clockTags],
  };
};

/**
 * Extract vector clock from Nostr event tags.
 * Looks for tags with prefix 'c' (clock).
 */
export const extractClockFromNostrTags = (
  tags: string[][]
): VectorClock => {
  const clock: Record<string, number> = {};
  
  for (const tag of tags) {
    if (tag[0] === 'c' && tag.length >= 3) {
      const device = tag[1];
      const count = tag[2];
      if (device && count) {
        clock[device] = parseInt(count, 10);
      }
    }
  }
  
  return clock;
};

/**
 * Extract device ID from Nostr event tags.
 * Looks for tag with prefix 'd' (device).
 */
export const extractDeviceFromNostrTags = (
  tags: string[][]
): DeviceId | undefined => {
  for (const tag of tags) {
    if (tag[0] === 'd' && tag.length >= 2) {
      return tag[1];
    }
  }
  return undefined;
};

/**
 * Build a CRDT container from real-time Nostr subscription.
 * 
 * This helper manages the subscription lifecycle and applies
 * incoming events to a CRDT container as they arrive.
 * 
 * @param subscribe Function to start Nostr subscription
 * @param createEmpty Function to create empty CRDT container
 * @param applyEvent Function to apply a Nostr event to the container
 * @param deviceId Local device identifier
 */
export const buildCRDTFromNostrSubscription = <T>(
  subscribe: (onEvent: (event: NostrEventLike) => void) => () => void,
  createEmpty: () => T,
  applyEvent: (container: T, event: NostrEventLike, deviceId: DeviceId) => T,
  deviceId: DeviceId,
  onUpdate?: (container: T) => void
): {
  container: () => T;
  unsubscribe: () => void;
} => {
  let container = createEmpty();
  
  const handleEvent = (event: NostrEventLike) => {
    container = applyEvent(container, event, deviceId);
    onUpdate?.(container);
  };
  
  const unsubscribe = subscribe(handleEvent);
  
  return {
    container: () => container,
    unsubscribe,
  };
};

/**
 * Determine if a Nostr event is a CRDT operation based on kind.
 */
export const isCRDTOperation = (kind: number): boolean =>
  kind >= 30000 && kind < 40000;

/**
 * Sync strategy recommendations based on event volume.
 */
export const getRecommendedSyncStrategy = (
  eventCount: number
): 'full' | 'delta' | 'gossip' => {
  if (eventCount < 100) {
    return 'full'; // Send full state
  } else if (eventCount < 1000) {
    return 'delta'; // Send deltas since last sync
  } else {
    return 'gossip'; // Use gossip protocol for large sets
  }
};
