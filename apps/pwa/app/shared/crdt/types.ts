/**
 * CRDT (Conflict-free Replicated Data Types) Type Definitions
 * 
 * These types enable decentralized state that can be modified independently
 * on multiple devices and merged without conflicts.
 */

/**
 * OR-Set (Observed-Remove Set): Add-wins semantics
 * When concurrent add and remove happen, add wins.
 * Perfect for membership lists where we don't want to lose members.
 */
export interface ORSet<T> {
  /** All items ever added to the set */
  readonly adds: ReadonlySet<T>;
  /** All items ever removed from the set */
  readonly removes: ReadonlySet<T>;
}

/**
 * LWW-Element-Set: Last-write-wins semantics
 * When same element is modified concurrently, highest timestamp wins.
 * Good for simple collections where latest state matters.
 */
export interface LWWEElementSet<T, V> {
  /** Element ID -> { value, timestamp, actor } */
  readonly elements: ReadonlyMap<T, {
    readonly value: V;
    readonly timestamp: number;
    readonly actor: string;
  }>;
}

/**
 * LWW-Register: Single value, last writer wins
 * Simplest CRDT - just keep the value with highest timestamp.
 */
export interface LWWRegister<T> {
  readonly value: T;
  readonly timestamp: number;
  readonly actor: string;
}

/**
 * G-Counter: Monotonic counter (only increases)
 * Can only be incremented. Perfect for presence "last seen" timestamps.
 */
export interface GCounter {
  /** Actor ID -> their contribution to counter */
  readonly counts: ReadonlyMap<string, number>;
}

/**
 * PN-Counter: Counter that can increment and decrement
 * Combination of two G-Counters (increments and decrements).
 */
export interface PNCounter {
  readonly increments: GCounter;
  readonly decrements: GCounter;
}

/**
 * CRDT Operation Types
 * These represent the operations that can be performed on CRDTs.
 */
export type CrdtOperation =
  | { readonly type: 'orSet_add'; readonly element: unknown }
  | { readonly type: 'orSet_remove'; readonly element: unknown }
  | { readonly type: 'lwwRegister_set'; readonly value: unknown; readonly timestamp: number }
  | { readonly type: 'gCounter_increment'; readonly delta: number }
  | { readonly type: 'pnCounter_increment'; readonly delta: number }
  | { readonly type: 'pnCounter_decrement'; readonly delta: number };

/**
 * CRDT Container - wraps any CRDT with metadata
 */
export interface CrdtContainer<T> {
  readonly id: string;
  readonly type: 'orSet' | 'lwwSet' | 'lwwRegister' | 'gCounter' | 'pnCounter';
  readonly state: T;
  readonly version: number;
  readonly modifiedAt: number;
}
