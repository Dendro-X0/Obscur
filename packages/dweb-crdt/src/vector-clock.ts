/**
 * Vector Clock - Causality Tracking for Distributed Systems
 * 
 * Vector clocks track the "happens-before" relationship between events
 * in a distributed system. Unlike timestamps, they provide true causality
 * information without requiring clock synchronization.
 * 
 * Used for:
 * - Determining concurrent events (conflicts)
 * - Ordering messages in chat history
 * - Building delta states for efficient sync
 * - Last-Write-Wins resolution with causality awareness
 * 
 * @example
 * ```typescript
 * const vc1: VectorClock = { deviceA: 1, deviceB: 0 };
 * const vc2: VectorClock = { deviceA: 1, deviceB: 1 };
 * 
 * vectorCompare(vc1, vc2); // -1 (vc1 happens-before vc2)
 * vectorCompare(vc2, vc1); // 1 (vc2 happens-after vc1)
 * ```
 */

export type DeviceId = string;

/**
 * Vector clock mapping device IDs to event counters.
 * Each device increments its own counter when generating events.
 */
export type VectorClock = Readonly<Record<DeviceId, number>>;

/**
 * Create a new vector clock with a single entry.
 */
export const createVectorClock = (
  deviceId: DeviceId,
  counter: number = 0
): VectorClock => ({
  [deviceId]: counter,
});

/**
 * Increment a device's counter in the vector clock.
 */
export const incrementClock = (
  clock: VectorClock,
  deviceId: DeviceId
): VectorClock => ({
  ...clock,
  [deviceId]: (clock[deviceId] ?? 0) + 1,
});

/**
 * Merge two vector clocks by taking the maximum of each counter.
 * This represents the combined knowledge of both clocks.
 */
export const mergeClocks = (
  a: VectorClock,
  b: VectorClock
): VectorClock => {
  const result: Record<DeviceId, number> = {};
  const allDevices = new Set([...Object.keys(a), ...Object.keys(b)]);
  
  for (const device of allDevices) {
    result[device] = Math.max(a[device] ?? 0, b[device] ?? 0);
  }
  
  return result;
};

/**
 * Compare two vector clocks to determine their causal relationship.
 * 
 * Returns:
 * - -1: a happens-before b (a < b)
 * - 1: a happens-after b (a > b)
 * - 0: a and b are concurrent (conflict)
 * 
 * @example
 * ```typescript
 * const a = { deviceA: 1 };
 * const b = { deviceA: 1, deviceB: 1 };
 * vectorCompare(a, b); // -1 (a < b)
 * ```
 */
export const vectorCompare = (
  a: VectorClock,
  b: VectorClock
): -1 | 0 | 1 => {
  let aLessThanB = false;
  let bLessThanA = false;
  
  const allDevices = new Set([...Object.keys(a), ...Object.keys(b)]);
  
  for (const device of allDevices) {
    const aVal = a[device] ?? 0;
    const bVal = b[device] ?? 0;
    
    if (aVal < bVal) aLessThanB = true;
    if (aVal > bVal) bLessThanA = true;
  }
  
  if (aLessThanB && !bLessThanA) return -1;
  if (bLessThanA && !aLessThanB) return 1;
  return 0; // Concurrent (conflict) or equal
};

/**
 * Check if clock a happens-before or is equal to clock b.
 * Useful for determining if a delta is applicable.
 */
export const vectorLessThanOrEqual = (
  a: VectorClock,
  b: VectorClock
): boolean => {
  const allDevices = new Set([...Object.keys(a), ...Object.keys(b)]);
  
  for (const device of allDevices) {
    if ((a[device] ?? 0) > (b[device] ?? 0)) {
      return false;
    }
  }
  
  return true;
};

/**
 * Check if two vector clocks represent concurrent events (conflict).
 */
export const areConcurrent = (a: VectorClock, b: VectorClock): boolean =>
  vectorCompare(a, b) === 0 && !vectorEqual(a, b);

/**
 * Check if two vector clocks are equal.
 */
export const vectorEqual = (a: VectorClock, b: VectorClock): boolean => {
  const allDevices = new Set([...Object.keys(a), ...Object.keys(b)]);
  
  for (const device of allDevices) {
    if ((a[device] ?? 0) !== (b[device] ?? 0)) {
      return false;
    }
  }
  
  return true;
};

/**
 * Get the maximum counter value across all devices in the clock.
 * Useful for determining "time" in a distributed sense.
 */
export const getMaxCounter = (clock: VectorClock): number =>
  Math.max(0, ...Object.values(clock));

/**
 * Serialize a vector clock to a compact string format.
 * Format: "deviceA:5,deviceB:3"
 */
export const serializeVectorClock = (clock: VectorClock): string =>
  Object.entries(clock)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([device, count]) => `${device}:${count}`)
    .join(',');

/**
 * Deserialize a vector clock from string format.
 */
export const deserializeVectorClock = (str: string): VectorClock => {
  const result: Record<DeviceId, number> = {};
  
  if (!str) return result;
  
  for (const entry of str.split(',')) {
    const [device, count] = entry.split(':');
    if (device && count) {
      result[device] = parseInt(count, 10);
    }
  }
  
  return result;
};
