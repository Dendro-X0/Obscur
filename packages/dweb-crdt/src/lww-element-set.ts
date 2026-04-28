/**
 * LWW-Element-Set (Last-Write-Wins Element Set) - CRDT for Message Collections
 * 
 * Each element has its own LWW-Register. When merging, elements are preserved
 * and concurrent updates to the same element are resolved by LWW semantics.
 * 
 * Perfect for:
 * - Chat message history (each message is an element)
 * - Edit-enabled message collections
 * - Any set where elements can be updated and latest wins
 * 
 * @example
 * ```typescript
 * // Device A sends message 1
 * const setA = addToLWWSet(
 *   createLWWElementSet<Message>(),
 *   'msg-1',
 *   { text: 'Hello', id: 'msg-1' },
 *   'deviceA',
 *   clockA
 * );
 * 
 * // Device B sends message 2 (concurrently)
 * const setB = addToLWWSet(
 *   createLWWElementSet<Message>(),
 *   'msg-2',
 *   { text: 'World', id: 'msg-2' },
 *   'deviceB',
 *   clockB
 * );
 * 
 * // Merge: both messages present
 * const merged = mergeLWWSets(setA, setB);
 * queryLWWSet(merged); // [msg-1, msg-2]
 * 
 * // Later, Device A edits msg-1
 * const edited = addToLWWSet(
 *   setA,
 *   'msg-1',
 *   { text: 'Hello edited', id: 'msg-1' },
 *   'deviceA',
 *   clockA2  // Later clock
 * );
 * 
 * // Merge preserves edit (later clock wins)
 * const final = mergeLWWSets(edited, setB);
 * final.elements.get('msg-1')?.value.text; // 'Hello edited'
 * ```
 */

import {
  type DeviceId,
  type VectorClock,
  vectorCompare,
  mergeClocks,
} from './vector-clock.js';
import type { LWWRegister } from './lww-register.js';

/**
 * LWW-Element-Set structure.
 * 
 * Each element is stored with its LWW metadata for independent conflict resolution.
 */
export interface LWWElementSet<T> {
  /** Elements keyed by unique ID */
  elements: Map<string, LWWSetEntry<T>>;
}

/**
 * Entry in an LWW-Element-Set.
 */
export interface LWWSetEntry<T> {
  id: string;
  value: T;
  timestamp: number;
  vectorClock: VectorClock;
  writerId: DeviceId;
}

/**
 * Create an empty LWW-Element-Set.
 */
export const createLWWElementSet = <T>(): LWWElementSet<T> => ({
  elements: new Map(),
});

/**
 * Add or update an element in the LWW-Element-Set.
 * 
 * If an element with the same ID exists, the one with the later
 * vector clock (or timestamp) wins.
 */
export const addToLWWSet = <T>(
  set: LWWElementSet<T>,
  id: string,
  value: T,
  writerId: DeviceId,
  vectorClock: VectorClock,
  timestamp: number = Date.now()
): LWWElementSet<T> => {
  const existing = set.elements.get(id);
  
  // If existing, check if new value wins
  if (existing) {
    const vcCmp = vectorCompare(vectorClock, existing.vectorClock);
    
    // Existing wins (new is earlier or concurrent but lower timestamp)
    if (vcCmp === -1) return set;
    if (vcCmp === 0 && timestamp <= existing.timestamp) return set;
  }
  
  // New value wins
  const newElements = new Map(set.elements);
  newElements.set(id, {
    id,
    value,
    timestamp,
    vectorClock,
    writerId,
  });
  
  return { elements: newElements };
};

/**
 * Remove an element from the LWW-Element-Set.
 * 
 * In LWW-Set, removal is implemented as a tombstone with LWW semantics.
 * The tombstone can win or lose based on its vector clock.
 */
export const removeFromLWWSet = <T>(
  set: LWWElementSet<T>,
  id: string,
  writerId: DeviceId,
  vectorClock: VectorClock,
  timestamp: number = Date.now()
): LWWElementSet<T> => {
  // Add tombstone as special value
  return addToLWWSet(
    set,
    id,
    null as unknown as T, // Tombstone marker
    writerId,
    vectorClock,
    timestamp
  );
};

/**
 * Check if an entry is a tombstone (removed).
 */
const isTombstone = <T>(entry: LWWSetEntry<T>): boolean =>
  entry.value === null;

/**
 * Query current (non-removed) elements from the LWW-Element-Set.
 * 
 * Returns elements sorted by vector clock for deterministic ordering.
 */
export const queryLWWSet = <T>(set: LWWElementSet<T>): T[] => {
  const active: Array<{ entry: LWWSetEntry<T>; sortKey: string }> = [];
  
  for (const entry of set.elements.values()) {
    if (!isTombstone(entry)) {
      // Create sortable key from vector clock
      const sortKey = Object.entries(entry.vectorClock)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join(',');
      active.push({ entry, sortKey });
    }
  }
  
  // Sort by vector clock for deterministic order
  active.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  
  return active.map(({ entry }) => entry.value);
};

/**
 * Query with full metadata for each element.
 */
export const queryLWWSetWithMetadata = <T>(
  set: LWWElementSet<T>
): LWWSetEntry<T>[] => {
  const result: LWWSetEntry<T>[] = [];
  
  for (const entry of set.elements.values()) {
    if (!isTombstone(entry)) {
      result.push(entry);
    }
  }
  
  // Sort by vector clock
  return result.sort((a, b) => {
    const cmp = vectorCompare(a.vectorClock, b.vectorClock);
    if (cmp !== 0) return cmp;
    return a.timestamp - b.timestamp;
  });
};

/**
 * Get a specific element by ID.
 * Returns undefined if not found or removed.
 */
export const getLWWSetElement = <T>(
  set: LWWElementSet<T>,
  id: string
): T | undefined => {
  const entry = set.elements.get(id);
  if (!entry || isTombstone(entry)) return undefined;
  return entry.value;
};

/**
 * Check if an element exists and is not removed.
 */
export const hasInLWWSet = <T>(set: LWWElementSet<T>, id: string): boolean =>
  getLWWSetElement(set, id) !== undefined;

/**
 * Merge two LWW-Element-Sets.
 * 
 * For each element ID, the entry with the later vector clock wins.
 * This preserves all elements and resolves conflicts per-element.
 */
export const mergeLWWSets = <T>(
  a: LWWElementSet<T>,
  b: LWWElementSet<T>
): LWWElementSet<T> => {
  const merged = new Map(a.elements);
  
  for (const [id, entryB] of b.elements) {
    const entryA = merged.get(id);
    
    if (!entryA) {
      // Only in B
      merged.set(id, entryB);
    } else {
      // In both - LWW resolution
      const vcCmp = vectorCompare(entryB.vectorClock, entryA.vectorClock);
      
      if (vcCmp === 1) {
        // B is strictly later
        merged.set(id, entryB);
      } else if (vcCmp === 0) {
        // Concurrent - use timestamp, then writerId for determinism
        if (entryB.timestamp > entryA.timestamp) {
          merged.set(id, entryB);
        } else if (entryB.timestamp === entryA.timestamp && 
                   entryB.writerId > entryA.writerId) {
          merged.set(id, entryB);
        }
        // else A wins
      }
      // else A wins (vcCmp === -1 or 0 with A winning on tie-break)
    }
  }
  
  return { elements: merged };
};

/**
 * Get the number of active (non-removed) elements.
 */
export const getLWWSetSize = <T>(set: LWWElementSet<T>): number =>
  queryLWWSet(set).length;

/**
 * Check if the LWW-Element-Set is empty.
 */
export const isLWWSetEmpty = <T>(set: LWWElementSet<T>): boolean =>
  getLWWSetSize(set) === 0;

/**
 * Create a delta for efficient sync.
 * Only includes elements newer than the basis clock.
 */
export const createLWWSetDelta = <T>(
  set: LWWElementSet<T>,
  basisClock: VectorClock
): Array<LWWSetEntry<T>> => {
  const delta: LWWSetEntry<T>[] = [];
  
  for (const entry of set.elements.values()) {
    // Include if entry is not dominated by basis
    const dominated = Object.entries(entry.vectorClock).every(
      ([device, count]) => (basisClock[device] ?? 0) >= count
    );
    
    if (!dominated) {
      delta.push(entry);
    }
  }
  
  return delta;
};

/**
 * Apply a delta to an LWW-Element-Set.
 */
export const applyLWWSetDelta = <T>(
  set: LWWElementSet<T>,
  delta: LWWSetEntry<T>[]
): LWWElementSet<T> => {
  let result = set;
  
  for (const entry of delta) {
    result = addToLWWSet(
      result,
      entry.id,
      entry.value,
      entry.writerId,
      entry.vectorClock,
      entry.timestamp
    );
  }
  
  return result;
};

/**
 * Serialize LWW-Element-Set to JSON-serializable format.
 */
export const serializeLWWSet = <T>(set: LWWElementSet<T>): object => ({
  elements: Array.from(set.elements.entries()).map(([id, entry]) => ({
    id,
    value: entry.value,
    timestamp: entry.timestamp,
    vectorClock: entry.vectorClock,
    writerId: entry.writerId,
  })),
});

/**
 * Deserialize LWW-Element-Set from JSON.
 */
export const deserializeLWWSet = <T>(data: {
  elements: Array<LWWSetEntry<T>>;
}): LWWElementSet<T> => ({
  elements: new Map(data.elements.map((e) => [e.id, e])),
});
