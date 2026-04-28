/**
 * G-Counter (Grow-only Counter) Implementation
 * 
 * Semantics: Can only increase. Each actor increments their own counter.
 * Total value is sum of all actor contributions.
 * 
 * Use case: Presence tracking (last-seen timestamps), message sequence numbers,
          any monotonic value where we need "latest" across devices.
 */

import type { GCounter } from './types';

/**
 * Create an empty G-Counter
 */
export const createGCounter = (): GCounter => ({
  counts: new Map()
});

/**
 * Increment the counter for a specific actor
 */
export const incrementGCounter = (
  counter: GCounter,
  actor: string,
  delta: number = 1
): GCounter => {
  const current = counter.counts.get(actor) ?? 0;
  const newCounts = new Map(counter.counts);
  newCounts.set(actor, current + delta);
  return { counts: newCounts };
};

/**
 * Get the value for a specific actor
 */
export const getGCounterForActor = (
  counter: GCounter,
  actor: string
): number => {
  return counter.counts.get(actor) ?? 0;
};

/**
 * Get the total counter value (sum of all actors)
 */
export const getGCounterTotal = (counter: GCounter): number => {
  let total = 0;
  for (const count of counter.counts.values()) {
    total += count;
  }
  return total;
};

/**
 * Merge two G-Counters
 * Takes the maximum value for each actor
 */
export const mergeGCounters = (a: GCounter, b: GCounter): GCounter => {
  const merged = new Map<string, number>();
  
  // Get all unique actors
  const actors = new Set([...a.counts.keys(), ...b.counts.keys()]);
  
  // Take max for each actor
  for (const actor of actors) {
    const aVal = a.counts.get(actor) ?? 0;
    const bVal = b.counts.get(actor) ?? 0;
    merged.set(actor, Math.max(aVal, bVal));
  }
  
  return { counts: merged };
};

/**
 * Get all actors in the counter
 */
export const getGCounterActors = (counter: GCounter): string[] => {
  return [...counter.counts.keys()];
};

/**
 * Check if counter is empty
 */
export const isGCounterEmpty = (counter: GCounter): boolean => {
  return counter.counts.size === 0;
};

/**
 * Create G-Counter from a single value (single-actor)
 */
export const createGCounterFromValue = (
  actor: string,
  value: number
): GCounter => ({
  counts: new Map([[actor, value]])
});

/**
 * Serialize G-Counter for storage
 */
export const serializeGCounter = (counter: GCounter): Record<string, number> => {
  const obj: Record<string, number> = {};
  for (const [actor, count] of counter.counts) {
    obj[actor] = count;
  }
  return obj;
};

/**
 * Deserialize G-Counter from storage
 */
export const deserializeGCounter = (
  data: Record<string, number>
): GCounter => ({
  counts: new Map(Object.entries(data))
});

/**
 * Presence-specific: Create a G-Counter for tracking last-seen timestamps
 * Each device reports their own last-seen time for each user
 */
export const createPresenceCounter = (
  observerActor: string,
  targetUser: string,
  timestamp: number
): GCounter => {
  // Key format: "observer:target"
  const key = `${observerActor}:${targetUser}`;
  return createGCounterFromValue(key, timestamp);
};

/**
 * Presence-specific: Get the most recent last-seen timestamp for a user
 */
export const getLastSeenTimestamp = (
  counter: GCounter,
  targetUser: string
): number | null => {
  let maxTimestamp: number | null = null;
  
  for (const [key, timestamp] of counter.counts) {
    // Keys are formatted as "observer:target"
    if (key.endsWith(`:${targetUser}`)) {
      if (maxTimestamp === null || timestamp > maxTimestamp) {
        maxTimestamp = timestamp;
      }
    }
  }
  
  return maxTimestamp;
};
