/**
 * @dweb/crdt - CRDT Primitives for Distributed State Management
 * 
 * This package provides foundational CRDT (Conflict-free Replicated Data Type)
 * implementations for building distributed, eventually consistent applications.
 * 
 * ## Core CRDTs
 * 
 * - **OR-Set**: Add-wins set for membership tracking
 * - **LWW-Register**: Last-write-wins for single values
 * - **G-Counter**: Grow-only counter for monotonic metrics
 * - **VectorClock**: Causality tracking for distributed events
 * - **DeltaState**: Efficient incremental sync
 * 
 * ## Usage
 * 
 * ```typescript
 * import { createORSet, addToORSet, queryORSet, mergeORSets } from '@dweb/crdt/or-set';
 * import { createLWWRegister, setLWWRegister, mergeLWWRegisters } from '@dweb/crdt/lww-register';
 * 
 * // OR-Set for community membership
 * const members = createORSet<string>();
 * const withAlice = addToORSet(members, 'alice', 'device1', clock);
 * const withBob = addToORSet(withAlice, 'bob', 'device1', clock);
 * 
 * // LWW-Register for profile metadata
 * const status = createLWWRegister('active', 'device1', clock);
 * ```
 * 
 * @packageDocumentation
 */

// Re-export all CRDT modules for convenience
export * from './vector-clock.js';
export * from './or-set.js';
export * from './lww-register.js';
export * from './lww-element-set.js';
export * from './g-counter.js';
export * from './delta-state.js';
export * from './nostr-event-adapter.js';

// Version marker for compatibility checks
export const DWEB_CRDT_VERSION = '1.3.16';
