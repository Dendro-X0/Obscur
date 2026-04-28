/**
 * LWW-Register (Last-Write-Wins Register) - CRDT for Single Value
 * 
 * The LWW-Register holds a single value. When merging concurrent writes,
 * the one with the later timestamp (or higher vector clock) wins.
 * 
 * Perfect for:
 * - Profile metadata (display name, avatar)
 * - Call state (status, timestamps)
 * - Read receipts (last read position)
 * - Any single-value state where latest wins
 * 
 * @example
 * ```typescript
 * // Device A sets status
 * const regA = createLWWRegister('active', deviceA, clockA);
 * 
 * // Device B sets status (concurrently, later)
 * const regB = createLWWRegister('ended', deviceB, clockB);
 * 
 * // Merge: later write wins
 * const merged = mergeLWWRegisters(regA, regB);
 * merged.value; // 'ended' (if clockB > clockA)
 * ```
 */

import { type DeviceId, type VectorClock, vectorCompare } from './vector-clock.js';

/**
 * LWW-Register structure holding a single value with metadata.
 */
export interface LWWRegister<T> {
  value: T;
  timestamp: number;      // Wall-clock time (for tie-breaking)
  vectorClock: VectorClock; // Causality vector
  writerId: DeviceId;       // Who wrote this value
}

/**
 * Create a new LWW-Register with an initial value.
 */
export const createLWWRegister = <T>(
  value: T,
  writerId: DeviceId,
  vectorClock: VectorClock,
  timestamp: number = Date.now()
): LWWRegister<T> => ({
  value,
  timestamp,
  vectorClock,
  writerId,
});

/**
 * Set a new value in the register, creating a new register instance.
 */
export const setLWWRegister = <T>(
  register: LWWRegister<T>,
  newValue: T,
  writerId: DeviceId,
  vectorClock: VectorClock,
  timestamp: number = Date.now()
): LWWRegister<T> => ({
  value: newValue,
  timestamp,
  vectorClock,
  writerId,
});

/**
 * Compare two LWW-Registers to determine which write wins.
 * 
 * Comparison order:
 * 1. Vector clock (causality first)
 * 2. Timestamp (wall-clock for tie-breaking)
 * 3. Writer ID (lexicographic for deterministic final tie-break)
 * 
 * Returns:
 * - -1: a wins over b
 * - 1: b wins over a
 * - 0: equal (same register)
 */
export const compareLWWRegisters = <T>(
  a: LWWRegister<T>,
  b: LWWRegister<T>
): -1 | 0 | 1 => {
  // First: vector clock comparison (causality)
  const vcCompare = vectorCompare(a.vectorClock, b.vectorClock);
  if (vcCompare === 1) return -1; // a > b means a is later, a wins
  if (vcCompare === -1) return 1;  // a < b means b is later, b wins
  
  // Concurrent or equal: use timestamp
  if (a.timestamp > b.timestamp) return -1;
  if (a.timestamp < b.timestamp) return 1;
  
  // Same timestamp: deterministic tie-break by writer ID
  if (a.writerId > b.writerId) return -1;
  if (a.writerId < b.writerId) return 1;
  
  return 0; // Truly equal
};

/**
 * Merge two LWW-Registers.
 * Returns the register with the later write (according to LWW semantics).
 */
export const mergeLWWRegisters = <T>(
  a: LWWRegister<T>,
  b: LWWRegister<T>
): LWWRegister<T> => {
  const cmp = compareLWWRegisters(a, b);
  return cmp <= 0 ? a : b; // a wins if equal or greater
};

/**
 * Merge multiple LWW-Registers.
 * Returns the register with the latest write across all inputs.
 */
export const mergeMultipleLWWRegisters = <T>(
  registers: LWWRegister<T>[]
): LWWRegister<T> | null => {
  if (registers.length === 0) return null;
  
  return registers.reduce((winner, current) =>
    compareLWWRegisters(winner, current) <= 0 ? winner : current
  );
};

/**
 * Check if a register has expired based on a TTL.
 * Useful for auto-ending calls, expiring presence, etc.
 */
export const hasRegisterExpired = <T>(
  register: LWWRegister<T>,
  ttlMs: number,
  now: number = Date.now()
): boolean => {
  return now - register.timestamp >= ttlMs;
};

/**
 * Get the effective value from a register, considering TTL.
 * Returns the value if not expired, null otherwise.
 */
export const getLWWRegisterValueWithTTL = <T>(
  register: LWWRegister<T>,
  ttlMs: number,
  now: number = Date.now()
): T | null => {
  return hasRegisterExpired(register, ttlMs, now) ? null : register.value;
};

/**
 * Update a register only if the new value is "later".
 * Returns the winning register (may be the original if no update needed).
 */
export const updateLWWRegisterIfLater = <T>(
  current: LWWRegister<T>,
  candidate: LWWRegister<T>
): LWWRegister<T> => {
  return mergeLWWRegisters(current, candidate);
};

/**
 * Check if two registers have the same value (not necessarily same metadata).
 */
export const registersHaveEqualValues = <T>(
  a: LWWRegister<T>,
  b: LWWRegister<T>
): boolean => {
  return JSON.stringify(a.value) === JSON.stringify(b.value);
};

/**
 * Serialize LWW-Register to JSON-serializable format.
 */
export const serializeLWWRegister = <T>(register: LWWRegister<T>): object => ({
  value: register.value,
  timestamp: register.timestamp,
  vectorClock: register.vectorClock,
  writerId: register.writerId,
});

/**
 * Deserialize LWW-Register from JSON.
 */
export const deserializeLWWRegister = <T>(data: {
  value: T;
  timestamp: number;
  vectorClock: VectorClock;
  writerId: DeviceId;
}): LWWRegister<T> => ({
  value: data.value,
  timestamp: data.timestamp,
  vectorClock: data.vectorClock,
  writerId: data.writerId,
});
