/**
 * LWW-Register (Last-Write-Wins Register) Implementation
 * 
 * Semantics: When concurrent writes happen, the one with highest timestamp wins.
 * If timestamps are equal, tie-break by actor ID (lexicographic).
 * 
 * Use case: Simple values like profile metadata, "current call status", 
 * "last seen timestamp" where latest state is authoritative.
 */

import type { LWWRegister } from './types';

/**
 * Create a new LWW-Register with initial value
 */
export const createLWWRegister = <T>(
  value: T,
  actor: string,
  timestamp: number = Date.now()
): LWWRegister<T> => ({
  value,
  timestamp,
  actor
});

/**
 * Set a new value in the LWW-Register
 * Only succeeds if new timestamp is >= current timestamp
 */
export const setLWWRegister = <T>(
  register: LWWRegister<T>,
  value: T,
  actor: string,
  timestamp: number = Date.now()
): LWWRegister<T> => {
  // Last write wins - compare timestamps
  if (timestamp > register.timestamp) {
    return { value, timestamp, actor };
  }
  
  // Tie-breaker: if timestamps equal, lower actor ID wins (deterministic)
  if (timestamp === register.timestamp && actor < register.actor) {
    return { value, timestamp, actor };
  }
  
  // Current value wins
  return register;
};

/**
 * Merge two LWW-Registers
 * Returns the one with higher timestamp (or tie-breaker)
 */
export const mergeLWWRegisters = <T>(
  a: LWWRegister<T>,
  b: LWWRegister<T>
): LWWRegister<T> => {
  if (a.timestamp > b.timestamp) return a;
  if (b.timestamp > a.timestamp) return b;
  
  // Timestamps equal - tie-break by actor
  return a.actor <= b.actor ? a : b;
};

/**
 * Get current value from LWW-Register
 */
export const getLWWValue = <T>(register: LWWRegister<T>): T => register.value;

/**
 * Get metadata from LWW-Register
 */
export const getLWWMetadata = <T>(register: LWWRegister<T>) => ({
  timestamp: register.timestamp,
  actor: register.actor
});

/**
 * Check if value was set recently (within threshold ms)
 */
export const isLWWRecent = <T>(
  register: LWWRegister<T>,
  thresholdMs: number = 30000
): boolean => {
  return Date.now() - register.timestamp < thresholdMs;
};

/**
 * Get age of value in milliseconds
 */
export const getLWWAge = <T>(register: LWWRegister<T>): number => {
  return Date.now() - register.timestamp;
};

/**
 * Format age for display (e.g., "2s ago", "5m ago")
 */
export const formatLWWAge = <T>(register: LWWRegister<T>): string => {
  const age = getLWWAge(register);
  
  if (age < 1000) return 'just now';
  if (age < 60000) return `${Math.floor(age / 1000)}s ago`;
  if (age < 3600000) return `${Math.floor(age / 60000)}m ago`;
  if (age < 86400000) return `${Math.floor(age / 3600000)}h ago`;
  return `${Math.floor(age / 86400000)}d ago`;
};

/**
 * Serialize LWW-Register for storage
 */
export const serializeLWWRegister = <T>(register: LWWRegister<T>) => ({
  value: register.value,
  timestamp: register.timestamp,
  actor: register.actor
});

/**
 * Deserialize LWW-Register from storage
 */
export const deserializeLWWRegister = <T>(data: {
  value: T;
  timestamp: number;
  actor: string;
}): LWWRegister<T> => data;
