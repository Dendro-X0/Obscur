/**
 * Delta-State CRDT - Efficient Incremental Sync
 * 
 * Delta-state CRDTs exchange only the changes (deltas) since the last sync,
 * rather than the full state. This dramatically reduces bandwidth for
 * large sets and frequent updates.
 * 
 * Perfect for:
 * - Large community member lists (only send new members, not full roster)
 * - Chat history sync (only send recent messages)
 * - Presence updates (only send changed heartbeats)
 * - Mobile/bandwidth-constrained environments
 * 
 * @example
 * ```typescript
 * // Device A has full OR-Set
 * const fullSet = createORSet<string>();
 * const setWithAlice = addToORSet(fullSet, 'Alice', 'deviceA', clock);
 * 
 * // Create delta from empty to current
 * const delta = createDeltaState(createORSet(), setWithAlice);
 * 
 * // Device B receives delta and applies
 * const merged = applyDeltaState(createORSet(), delta);
 * queryORSet(merged); // Set { 'Alice' }
 * ```
 */

import type { DeviceId, VectorClock } from './vector-clock.js';
import { mergeClocks, vectorLessThanOrEqual } from './vector-clock.js';

/**
 * Delta state containing only changes since a baseline vector clock.
 */
export interface DeltaState<T> {
  /** Vector clock of the delta basis (what state this delta builds on) */
  basisClock: VectorClock;
  /** Vector clock after applying this delta */
  resultingClock: VectorClock;
  /** Items added in this delta */
  adds: T[];
  /** Items removed in this delta */
  removes: T[];
  /** Device that generated this delta */
  sourceDevice: DeviceId;
  /** Timestamp of delta generation */
  generatedAt: number;
}

/**
 * Create a delta state representing changes between two vector clocks.
 * 
 * @param baseline The earlier state vector clock
 * @param current The current state vector clock  
 * @param added Items added between baseline and current
 * @param removed Items removed between baseline and current
 * @param sourceDevice Device generating the delta
 */
export const createDeltaState = <T>(
  baseline: VectorClock,
  current: VectorClock,
  added: T[],
  removed: T[],
  sourceDevice: DeviceId,
  generatedAt: number = Date.now()
): DeltaState<T> => ({
  basisClock: baseline,
  resultingClock: current,
  adds: added,
  removes: removed,
  sourceDevice,
  generatedAt,
});

/**
 * Check if a delta can be applied to a given state.
 * A delta is applicable if the state's clock is at or before the delta's basis.
 */
export const isDeltaApplicable = (
  stateClock: VectorClock,
  delta: DeltaState<unknown>
): boolean => {
  return vectorLessThanOrEqual(stateClock, delta.basisClock);
};

/**
 * Apply a delta state to a base state.
 * Returns the merged state and new clock.
 * 
 * Note: This is a generic delta application pattern. Specific CRDTs
 * (OR-Set, LWW-Register) have specialized delta application below.
 */
export const applyDeltaState = <T>(
  baseState: T[],
  delta: DeltaState<T>
): { state: T[]; clock: VectorClock } => {
  const state = new Set(baseState);
  
  // Apply removals first
  for (const item of delta.removes) {
    state.delete(item);
  }
  
  // Apply additions
  for (const item of delta.adds) {
    state.add(item);
  }
  
  return {
    state: Array.from(state),
    clock: delta.resultingClock,
  };
};

/**
 * OR-Set specific delta for efficient membership sync.
 */
export interface ORSetDelta<T> {
  basisClock: VectorClock;
  resultingClock: VectorClock;
  adds: Array<{ value: T; tag: string; addedAt: VectorClock; addedBy: DeviceId }>;
  removes: string[]; // Tags of removed items
  sourceDevice: DeviceId;
  generatedAt: number;
}

/**
 * Create an OR-Set specific delta from two OR-Sets.
 * Only includes items added/removed since the basis state.
 */
export const createORSetDelta = <T>(
  basisClock: VectorClock,
  currentSet: {
    adds: Map<string, { value: T; addedAt: VectorClock; addedBy: DeviceId }>;
    removes: Set<string>;
  },
  sourceDevice: DeviceId,
  generatedAt: number = Date.now()
): ORSetDelta<T> => {
  const adds: ORSetDelta<T>['adds'] = [];
  const removes: string[] = [];
  
  // Include adds that happened after basis clock
  for (const [tag, item] of currentSet.adds) {
    // If this add is not dominated by basis, include it
    if (!vectorLessThanOrEqual(item.addedAt, basisClock)) {
      adds.push({ value: item.value, tag, addedAt: item.addedAt, addedBy: item.addedBy });
    }
  }
  
  // Include all removes (they're idempotent)
  for (const tag of currentSet.removes) {
    removes.push(tag);
  }
  
  return {
    basisClock,
    resultingClock: mergeClocks(basisClock, { [sourceDevice]: adds.length }),
    adds,
    removes,
    sourceDevice,
    generatedAt,
  };
};

/**
 * Merge two deltas for batching.
 * Combines additions and removes from both deltas.
 */
export const mergeDeltas = <T>(
  a: DeltaState<T>,
  b: DeltaState<T>
): DeltaState<T> => ({
  basisClock: a.basisClock,
  resultingClock: mergeClocks(a.resultingClock, b.resultingClock),
  adds: [...a.adds, ...b.adds],
  removes: [...a.removes, ...b.removes],
  sourceDevice: a.sourceDevice, // Keep first source
  generatedAt: b.generatedAt,     // Use later timestamp
});

/**
 * Calculate delta size for bandwidth estimation.
 */
export const estimateDeltaSize = <T>(
  delta: DeltaState<T>,
  itemSerializer: (item: T) => string = (item) => JSON.stringify(item)
): number => {
  const addsSize = delta.adds.reduce(
    (sum, item) => sum + itemSerializer(item).length,
    0
  );
  const removesSize = delta.removes.reduce(
    (sum, item) => sum + JSON.stringify(item).length,
    0
  );
  
  // Overhead for metadata (clocks, timestamps, etc.)
  const overhead = JSON.stringify({
    basisClock: delta.basisClock,
    resultingClock: delta.resultingClock,
    sourceDevice: delta.sourceDevice,
    generatedAt: delta.generatedAt,
  }).length;
  
  return addsSize + removesSize + overhead;
};

/**
 * Delta buffer for accumulating changes before sending.
 * Useful for batching frequent updates.
 */
export interface DeltaBuffer<T> {
  pendingAdds: T[];
  pendingRemoves: T[];
  lastSentClock: VectorClock;
  deviceId: DeviceId;
}

/**
 * Create a delta buffer for batching changes.
 */
export const createDeltaBuffer = <T>(
  deviceId: DeviceId,
  lastSentClock: VectorClock = {}
): DeltaBuffer<T> => ({
  pendingAdds: [],
  pendingRemoves: [],
  lastSentClock,
  deviceId,
});

/**
 * Queue an addition to the delta buffer.
 */
export const bufferAdd = <T>(buffer: DeltaBuffer<T>, item: T): DeltaBuffer<T> => ({
  ...buffer,
  pendingAdds: [...buffer.pendingAdds, item],
});

/**
 * Queue a removal to the delta buffer.
 */
export const bufferRemove = <T>(buffer: DeltaBuffer<T>, item: T): DeltaBuffer<T> => ({
  ...buffer,
  pendingRemoves: [...buffer.pendingRemoves, item],
});

/**
 * Flush the delta buffer into a delta state.
 * Clears pending changes after creating the delta.
 */
export const flushDeltaBuffer = <T>(
  buffer: DeltaBuffer<T>,
  currentClock: VectorClock,
  generatedAt: number = Date.now()
): { delta: DeltaState<T>; clearedBuffer: DeltaBuffer<T> } => {
  const delta: DeltaState<T> = {
    basisClock: buffer.lastSentClock,
    resultingClock: currentClock,
    adds: buffer.pendingAdds,
    removes: buffer.pendingRemoves,
    sourceDevice: buffer.deviceId,
    generatedAt,
  };
  
  const clearedBuffer: DeltaBuffer<T> = {
    ...buffer,
    pendingAdds: [],
    pendingRemoves: [],
    lastSentClock: currentClock,
  };
  
  return { delta, clearedBuffer };
};

/**
 * Check if delta buffer has pending changes.
 */
export const hasPendingDelta = <T>(buffer: DeltaBuffer<T>): boolean =>
  buffer.pendingAdds.length > 0 || buffer.pendingRemoves.length > 0;

/**
 * Serialize delta state to JSON.
 */
export const serializeDeltaState = <T>(delta: DeltaState<T>): object => ({
  basisClock: delta.basisClock,
  resultingClock: delta.resultingClock,
  adds: delta.adds,
  removes: delta.removes,
  sourceDevice: delta.sourceDevice,
  generatedAt: delta.generatedAt,
});
