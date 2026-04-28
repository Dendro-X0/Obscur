/**
 * G-Counter (Grow-Only Counter) - CRDT for Monotonic Increments
 * 
 * The G-Counter only increases. Each device tracks its own counter,
 * and the total is the sum of all device counters.
 * 
 * Perfect for:
 * - Presence heartbeats (last-seen timestamps)
 * - Message sequence numbers
 * - Event counts
 * - Any monotonically increasing metric
 * 
 * Note: For decrementing, use PN-Counter (positive-negative counter).
 * This implementation focuses on G-Counter for presence/heartbeat use cases.
 * 
 * @example
 * ```typescript
 * // Device A increments
 * const counterA = incrementGCounter(createGCounter(), 'deviceA');
 * 
 * // Device B increments (concurrently)
 * const counterB = incrementGCounter(createGCounter(), 'deviceB');
 * 
 * // Merge: sum of both
 * const merged = mergeGCounters(counterA, counterB);
 * queryGCounter(merged); // 2 (1 from A + 1 from B)
 * ```
 */

import type { DeviceId, VectorClock } from './vector-clock.js';

/**
 * G-Counter structure mapping devices to their monotonic counters.
 */
export interface GCounter {
  /** Device-specific counters */
  counters: Readonly<Record<DeviceId, number>>;
  /** Vector clock tracking when each device last incremented */
  vectorClock: VectorClock;
}

/**
 * Create an empty G-Counter.
 */
export const createGCounter = (): GCounter => ({
  counters: {},
  vectorClock: {},
});

/**
 * Increment a device's counter in the G-Counter.
 */
export const incrementGCounter = (
  counter: GCounter,
  deviceId: DeviceId,
  amount: number = 1
): GCounter => {
  const newCount = (counter.counters[deviceId] ?? 0) + amount;
  
  return {
    counters: {
      ...counter.counters,
      [deviceId]: newCount,
    },
    vectorClock: {
      ...counter.vectorClock,
      [deviceId]: newCount,
    },
  };
};

/**
 * Get the total value of the G-Counter (sum of all device counters).
 */
export const queryGCounter = (counter: GCounter): number =>
  Object.values(counter.counters).reduce((sum, val) => sum + val, 0);

/**
 * Get a specific device's counter value.
 */
export const getDeviceCounter = (counter: GCounter, deviceId: DeviceId): number =>
  counter.counters[deviceId] ?? 0;

/**
 * Merge two G-Counters by taking the maximum of each device's counter.
 */
export const mergeGCounters = (a: GCounter, b: GCounter): GCounter => {
  const mergedCounters: Record<DeviceId, number> = { ...a.counters };
  
  for (const [device, bVal] of Object.entries(b.counters)) {
    const aVal = a.counters[device] ?? 0;
    mergedCounters[device] = Math.max(aVal, bVal);
  }
  
  return {
    counters: mergedCounters,
    vectorClock: { ...a.vectorClock, ...b.vectorClock },
  };
};

/**
 * Merge multiple G-Counters.
 */
export const mergeMultipleGCounters = (counters: GCounter[]): GCounter =>
  counters.reduce((merged, current) => mergeGCounters(merged, current), createGCounter());

/**
 * Presence-specific G-Counter that tracks last-seen timestamps.
 * 
 * Each device increments with the current timestamp as the value,
 * representing "I was last seen at this time".
 */
export interface PresenceHeartbeat {
  deviceId: DeviceId;
  lastSeenAt: number;
  vectorClock: VectorClock;
}

/**
 * Presence state using G-Counter semantics.
 * Maps pubkeys to their last-seen heartbeat.
 */
export interface PresenceState {
  heartbeats: Map<string, PresenceHeartbeat>;
}

/**
 * Create empty presence state.
 */
export const createPresenceState = (): PresenceState => ({
  heartbeats: new Map(),
});

/**
 * Record a presence heartbeat.
 */
export const recordPresence = (
  state: PresenceState,
  pubkey: string,
  deviceId: DeviceId,
  lastSeenAt: number = Date.now(),
  vectorClock: VectorClock = {}
): PresenceState => {
  const newHeartbeats = new Map(state.heartbeats);
  const existing = newHeartbeats.get(pubkey);
  
  // Only update if this heartbeat is newer
  if (!existing || lastSeenAt > existing.lastSeenAt) {
    newHeartbeats.set(pubkey, {
      deviceId,
      lastSeenAt,
      vectorClock,
    });
  }
  
  return { heartbeats: newHeartbeats };
};

/**
 * Get presence status for a pubkey.
 * Returns the last-seen timestamp and derived status label.
 */
export const getPresenceStatus = (
  state: PresenceState,
  pubkey: string,
  now: number = Date.now()
): {
  lastSeenAt: number | null;
  status: 'online' | 'recent' | 'away' | 'offline';
  sublabel: string | null;
} => {
  const heartbeat = state.heartbeats.get(pubkey);
  
  if (!heartbeat) {
    return {
      lastSeenAt: null,
      status: 'offline',
      sublabel: null,
    };
  }
  
  const age = now - heartbeat.lastSeenAt;
  
  if (age < 30000) {
    return {
      lastSeenAt: heartbeat.lastSeenAt,
      status: 'online',
      sublabel: `seen ${Math.floor(age / 1000)}s ago`,
    };
  }
  
  if (age < 300000) {
    return {
      lastSeenAt: heartbeat.lastSeenAt,
      status: 'recent',
      sublabel: `seen ${Math.floor(age / 60000)}m ago`,
    };
  }
  
  if (age < 600000) {
    return {
      lastSeenAt: heartbeat.lastSeenAt,
      status: 'away',
      sublabel: `seen ${Math.floor(age / 60000)}m ago`,
    };
  }

  return {
    lastSeenAt: heartbeat.lastSeenAt,
    status: 'offline',
    sublabel: null,
  };
};

/**
 * Merge two presence states.
 */
export const mergePresenceStates = (
  a: PresenceState,
  b: PresenceState
): PresenceState => {
  const merged = new Map(a.heartbeats);
  
  for (const [pubkey, heartbeat] of b.heartbeats) {
    const existing = merged.get(pubkey);
    if (!existing || heartbeat.lastSeenAt > existing.lastSeenAt) {
      merged.set(pubkey, heartbeat);
    }
  }
  
  return { heartbeats: merged };
};

/**
 * Get all online/recent pubkeys.
 */
export const getActivePresence = (
  state: PresenceState,
  maxAgeMs: number = 300000,
  now: number = Date.now()
): string[] => {
  const active: string[] = [];
  
  for (const [pubkey, heartbeat] of state.heartbeats) {
    if (now - heartbeat.lastSeenAt < maxAgeMs) {
      active.push(pubkey);
    }
  }
  
  return active;
};

/**
 * Serialize G-Counter to JSON.
 */
export const serializeGCounter = (counter: GCounter): object => ({
  counters: counter.counters,
  vectorClock: counter.vectorClock,
});

/**
 * Deserialize G-Counter from JSON.
 */
export const deserializeGCounter = (data: {
  counters: Record<DeviceId, number>;
  vectorClock: VectorClock;
}): GCounter => ({
  counters: data.counters,
  vectorClock: data.vectorClock,
});
