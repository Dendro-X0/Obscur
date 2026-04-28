/**
 * CRDT (Conflict-free Replicated Data Types) Utilities
 * 
 * These utilities enable decentralized state that converges without conflicts.
 * Use these for any state that needs to be synchronized across multiple devices
 * in a P2P network.
 * 
 * @example
 * ```typescript
 * import { 
 *   createORSet, addToORSet, removeFromORSet, mergeORSets, queryORSet 
 * } from '@/app/shared/crdt';
 * 
 * // Member list that won't thin during sync
 * const members = createORSet<string>();
 * const withAlice = addToORSet(members, 'alice');
 * const withBob = addToORSet(withAlice, 'bob');
 * 
 * // On another device
 * const otherDevice = createORSet<string>();
 * const withCharlie = addToORSet(otherDevice, 'charlie');
 * 
 * // Merge - all members preserved!
 * const merged = mergeORSets(withBob, withCharlie);
 * // Result: {alice, bob, charlie}
 * ```
 */

// Types
export type { 
  ORSet, 
  LWWEElementSet, 
  LWWRegister, 
  GCounter, 
  PNCounter,
  CrdtOperation,
  CrdtContainer 
} from './types';

// OR-Set (for membership lists)
export {
  createORSet,
  addToORSet,
  removeFromORSet,
  mergeORSets,
  queryORSet,
  hasInORSet,
  getORSetSize,
  orSetToArray,
  compactORSet,
  createORSetFromArray,
  serializeORSet,
  deserializeORSet
} from './or-set';

// LWW-Register (for simple values)
export {
  createLWWRegister,
  setLWWRegister,
  mergeLWWRegisters,
  getLWWValue,
  getLWWMetadata,
  isLWWRecent,
  getLWWAge,
  formatLWWAge,
  serializeLWWRegister,
  deserializeLWWRegister
} from './lww-register';

// G-Counter (for presence, sequence numbers)
export {
  createGCounter,
  incrementGCounter,
  getGCounterForActor,
  getGCounterTotal,
  mergeGCounters,
  getGCounterActors,
  isGCounterEmpty,
  createGCounterFromValue,
  serializeGCounter,
  deserializeGCounter,
  createPresenceCounter,
  getLastSeenTimestamp
} from './g-counter';
