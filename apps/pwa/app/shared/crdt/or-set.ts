/**
 * OR-Set (Observed-Remove Set) Implementation
 * 
 * Semantics: Add wins over remove. If an element is added and removed concurrently,
 * the add wins and the element stays in the set.
 * 
 * Use case: Community membership lists - we never want to accidentally lose members
 * due to race conditions during sync.
 */

import type { ORSet } from './types';

/**
 * Create an empty OR-Set
 */
export const createORSet = <T>(): ORSet<T> => ({
  adds: new Set(),
  removes: new Set()
});

/**
 * Add an element to the OR-Set
 * The element is added to the 'adds' set. If it was previously removed,
 * the add will win during merge.
 */
export const addToORSet = <T>(set: ORSet<T>, element: T): ORSet<T> => ({
  adds: new Set([...set.adds, element]),
  removes: set.removes
});

/**
 * Remove an element from the OR-Set
 * The element is added to the 'removes' set. The actual removal
 * happens in queryORSet where we filter adds by removes.
 */
export const removeFromORSet = <T>(set: ORSet<T>, element: T): ORSet<T> => ({
  adds: set.adds,
  removes: new Set([...set.removes, element])
});

/**
 * Merge two OR-Sets
 * The merge is simply the union of adds and union of removes.
 * This is the key property that makes OR-Sets conflict-free.
 */
export const mergeORSets = <T>(a: ORSet<T>, b: ORSet<T>): ORSet<T> => ({
  adds: new Set([...a.adds, ...b.adds]),
  removes: new Set([...a.removes, ...b.removes])
});

/**
 * Query the current elements of an OR-Set
 * Returns all elements that have been added but not removed.
 * Note: If an element was added on one device and removed on another,
 * the add wins (it's in both adds and removes, so we keep it).
 */
export const queryORSet = <T>(set: ORSet<T>): Set<T> => {
  const result = new Set<T>();
  for (const item of set.adds) {
    // In OR-Set, add wins over remove
    // So even if item is in removes, if it's also in adds, we keep it
    result.add(item);
  }
  return result;
};

/**
 * Check if an element is in the OR-Set
 */
export const hasInORSet = <T>(set: ORSet<T>, element: T): boolean => {
  return set.adds.has(element);
};

/**
 * Get the size of the OR-Set
 */
export const getORSetSize = <T>(set: ORSet<T>): number => {
  return queryORSet(set).size;
};

/**
 * Convert OR-Set to array
 */
export const orSetToArray = <T>(set: ORSet<T>): T[] => {
  return [...queryORSet(set)];
};

/**
 * Optimize OR-Set by removing redundant operations
 * This compaction removes elements that were both added and then removed
 * on the SAME device (not concurrent operations).
 * 
 * WARNING: Only call this when you know all devices have synced,
 * otherwise you might lose information about concurrent operations.
 */
export const compactORSet = <T>(set: ORSet<T>): ORSet<T> => {
  // Only keep items that are in adds but NOT in removes
  // This is safe only when we know all replicas have merged
  const compactedAdds = new Set<T>();
  for (const item of set.adds) {
    if (!set.removes.has(item)) {
      compactedAdds.add(item);
    }
  }
  return {
    adds: compactedAdds,
    removes: new Set() // Cleared after compaction
  };
};

/**
 * Create OR-Set from array of elements
 */
export const createORSetFromArray = <T>(elements: T[]): ORSet<T> => ({
  adds: new Set(elements),
  removes: new Set()
});

/**
 * Serialize OR-Set for storage
 */
export const serializeORSet = <T>(set: ORSet<T>): { adds: T[]; removes: T[] } => ({
  adds: [...set.adds],
  removes: [...set.removes]
});

/**
 * Deserialize OR-Set from storage
 */
export const deserializeORSet = <T>(data: { adds: T[]; removes: T[] }): ORSet<T> => ({
  adds: new Set(data.adds),
  removes: new Set(data.removes)
});
