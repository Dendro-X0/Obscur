/**
 * OR-Set (Observed-Remove Set) - CRDT for Add-Win Semantics
 * 
 * The OR-Set preserves all additions and removals as separate sets.
 * An item is "in" the set if it was added and never removed.
 * Add operations win over remove operations (if both happen concurrently).
 * 
 * Perfect for:
 * - Community membership (members join/leave)
 * - Group participants (add wins over remove)
 * - Any set where additions are authoritative
 * 
 * @example
 * ```typescript
 * // Device A adds Alice
 * const setA = pipe(
 *   createORSet<string>(),
 *   s => addToORSet(s, 'Alice')
 * );
 * 
 * // Device B adds Bob (concurrently)
 * const setB = pipe(
 *   createORSet<string>(),
 *   s => addToORSet(s, 'Bob')
 * );
 * 
 * // Merge: both Alice and Bob present
 * const merged = mergeORSets(setA, setB);
 * queryORSet(merged); // Set { 'Alice', 'Bob' }
 * ```
 */

import type { DeviceId, VectorClock } from './vector-clock.js';

/**
 * An item in the OR-Set with its associated metadata.
 */
export interface ORSetItem<T> {
  value: T;
  addedAt: VectorClock;
  addedBy: DeviceId;
}

/**
 * Observed-Remove Set structure.
 * 
 * Adds and removes are tracked separately (tombstones for removes).
 * This allows "add wins over remove" semantics during merge.
 */
export interface ORSet<T> {
  /** All items ever added, keyed by unique tag */
  adds: Map<string, ORSetItem<T>>;
  /** All items ever removed, keyed by unique tag */
  removes: Set<string>;
}

/**
 * Create a unique tag for an item addition.
 * Combines device ID and vector clock to ensure uniqueness.
 * 
 * Note: For object values, the caller should provide a stable key function.
 * This implementation works best with string/number values.
 */
const createTag = <T>(value: T, deviceId: DeviceId, clock: VectorClock): string => {
  // Normalize value to string (handles string, number, and simple objects)
  const valueStr = typeof value === 'string' 
    ? value 
    : typeof value === 'number'
      ? String(value)
      : JSON.stringify(value);
  
  // Normalize clock to deterministic string
  const clockStr = Object.entries(clock)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join(',');
  
  return `${deviceId}:${valueStr}:${clockStr}`;
};

/**
 * Create an empty OR-Set.
 */
export const createORSet = <T>(): ORSet<T> => ({
  adds: new Map(),
  removes: new Set(),
});

/**
 * Add an item to the OR-Set.
 * Creates a unique tag so concurrent adds of the same value don't collide.
 */
export const addToORSet = <T>(
  set: ORSet<T>,
  value: T,
  deviceId: DeviceId,
  clock: VectorClock
): ORSet<T> => {
  const tag = createTag(value, deviceId, clock);
  
  // Don't re-add if already removed (tombstone check)
  // This is the "observed remove" part - we respect tombstones
  if (set.removes.has(tag)) {
    return set;
  }
  
  const newAdds = new Map(set.adds);
  newAdds.set(tag, {
    value,
    addedAt: clock,
    addedBy: deviceId,
  });
  
  return {
    adds: newAdds,
    removes: set.removes,
  };
};

/**
 * Remove an item from the OR-Set.
 * Marks all matching add tags as removed (tombstones).
 */
export const removeFromORSet = <T>(
  set: ORSet<T>,
  value: T
): ORSet<T> => {
  const newRemoves = new Set(set.removes);
  
  // Find all tags matching this value and tombstone them
  for (const [tag, item] of set.adds) {
    if (JSON.stringify(item.value) === JSON.stringify(value)) {
      newRemoves.add(tag);
    }
  }
  
  return {
    adds: set.adds,
    removes: newRemoves,
  };
};

/**
 * Remove a specific item by its unique tag.
 * More precise than removeFromORSet when you know the exact tag.
 */
export const removeTagFromORSet = <T>(
  set: ORSet<T>,
  tag: string
): ORSet<T> => {
  const newRemoves = new Set(set.removes);
  newRemoves.add(tag);
  
  return {
    adds: set.adds,
    removes: newRemoves,
  };
};

/**
 * Query the current members of the OR-Set.
 * Returns items that have been added but not removed.
 */
export const queryORSet = <T>(set: ORSet<T>): Set<T> => {
  const result = new Set<T>();

  for (const [tag, item] of set.adds) {
    if (!set.removes.has(tag)) {
      result.add(item.value);
    }
  }

  return result;
};

/**
 * Query with full metadata for each member.
 * Useful for debugging and UI "joined at" timestamps.
 */
export const queryORSetWithMetadata = <T>(set: ORSet<T>): ORSetItem<T>[] => {
  const result: ORSetItem<T>[] = [];

  for (const [tag, item] of set.adds) {
    if (!set.removes.has(tag)) {
      result.push(item);
    }
  }

  return result;
};

/**
 * Check if a value is in the OR-Set.
 */
export const hasInORSet = <T>(set: ORSet<T>, value: T): boolean => {
  for (const [tag, item] of set.adds) {
    if (!set.removes.has(tag) &&
        JSON.stringify(item.value) === JSON.stringify(value)) {
      return true;
    }
  }
  return false;
};

/**
 * Merge two OR-Sets.
 * 
 * Semantics:
 * - Union of all adds (preserves all concurrent additions)
 * - Union of all removes (preserves all tombstones)
 * - Result: item is present if added by any source AND not removed by all
 * 
 * This gives "add wins over remove" semantics for concurrent operations.
 */
export const mergeORSets = <T>(a: ORSet<T>, b: ORSet<T>): ORSet<T> => {
  const mergedAdds = new Map(a.adds);
  
  // Add all items from b (preserving concurrent adds)
  for (const [tag, item] of b.adds) {
    if (!mergedAdds.has(tag)) {
      mergedAdds.set(tag, item);
    }
  }
  
  // Union of removes (preserve all tombstones)
  const mergedRemoves = new Set(a.removes);
  for (const tag of b.removes) {
    mergedRemoves.add(tag);
  }
  
  return {
    adds: mergedAdds,
    removes: mergedRemoves,
  };
};

/**
 * Get the number of active (non-removed) items in the set.
 */
export const getORSetSize = <T>(set: ORSet<T>): number =>
  queryORSet(set).size;

/**
 * Check if the OR-Set is empty.
 */
export const isORSetEmpty = <T>(set: ORSet<T>): boolean =>
  getORSetSize(set) === 0;

/**
 * Compact the OR-Set by removing tombstoned entries.
 * 
 * WARNING: This loses the ability to merge with older replicas that
 * might reference the removed tags. Only compact after ensuring
 * all replicas have merged.
 * 
 * Use for local storage optimization only, not for sync.
 */
export const compactORSet = <T>(set: ORSet<T>): ORSet<T> => {
  const newAdds = new Map<string, ORSetItem<T>>();
  
  for (const [tag, item] of set.adds) {
    if (!set.removes.has(tag)) {
      newAdds.set(tag, item);
    }
  }
  
  return {
    adds: newAdds,
    removes: new Set(),
  };
};

/**
 * Serialized OR-Set structure for JSON serialization.
 */
export interface SerializedORSet<T> {
  adds: Array<{
    tag: string;
    value: T;
    addedAt: import('./vector-clock.js').VectorClock;
    addedBy: DeviceId;
  }>;
  removes: string[];
}

/**
 * Serialize OR-Set to a JSON-serializable format.
 */
export const serializeORSet = <T>(set: ORSet<T>): SerializedORSet<T> => ({
  adds: Array.from(set.adds.entries()).map(([tag, item]) => ({
    tag,
    value: item.value,
    addedAt: item.addedAt,
    addedBy: item.addedBy,
  })),
  removes: Array.from(set.removes),
});

/**
 * Deserialize OR-Set from serialized format.
 */
export const deserializeORSet = <T>(data: SerializedORSet<T>): ORSet<T> => ({
  adds: new Map(
    data.adds.map((entry) => [
      entry.tag,
      { value: entry.value, addedAt: entry.addedAt, addedBy: entry.addedBy },
    ])
  ),
  removes: new Set(data.removes),
});
