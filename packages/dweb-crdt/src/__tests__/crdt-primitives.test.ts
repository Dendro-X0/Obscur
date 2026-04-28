/**
 * CRDT Primitives Test Suite
 * 
 * Tests the fundamental CRDT properties:
 * - Associativity: merge(merge(a, b), c) === merge(a, merge(b, c))
 * - Commutativity: merge(a, b) === merge(b, a)
 * - Idempotence: merge(a, a) === a
 * 
 * These properties must hold for all CRDT operations.
 */

import { describe, it, expect } from 'vitest';
import {
  createVectorClock,
  incrementClock,
  mergeClocks,
  vectorCompare,
  areConcurrent,
} from '../vector-clock.js';
import {
  createORSet,
  addToORSet,
  removeFromORSet,
  queryORSet,
  mergeORSets,
  hasInORSet,
  compactORSet,
} from '../or-set.js';
import {
  createLWWRegister,
  mergeLWWRegisters,
  compareLWWRegisters,
  hasRegisterExpired,
} from '../lww-register.js';
import {
  createGCounter,
  incrementGCounter,
  queryGCounter,
  mergeGCounters,
  createPresenceState,
  recordPresence,
  getPresenceStatus,
  mergePresenceStates,
} from '../g-counter.js';

describe('Vector Clock', () => {
  it('should correctly compare causal relationships', () => {
    const a = createVectorClock('device1', 1);
    const b = incrementClock(a, 'device1'); // device1: 2
    const c = { ...b, device2: 1 }; // device1: 2, device2: 1
    
    expect(vectorCompare(a, b)).toBe(-1); // a < b
    expect(vectorCompare(b, a)).toBe(1);  // b > a
    expect(vectorCompare(b, c)).toBe(-1); // b < c
    expect(vectorCompare(a, c)).toBe(-1); // a < c
  });

  it('should detect concurrent events', () => {
    const a = createVectorClock('device1', 1); // device1: 1
    const b = createVectorClock('device2', 1); // device2: 1
    
    expect(vectorCompare(a, b)).toBe(0); // Concurrent
    expect(areConcurrent(a, b)).toBe(true);
  });

  it('should merge clocks by taking maximums', () => {
    const a = { device1: 1, device2: 2 };
    const b = { device1: 3, device2: 1, device3: 5 };
    
    const merged = mergeClocks(a, b);
    
    expect(merged.device1).toBe(3); // max(1, 3)
    expect(merged.device2).toBe(2); // max(2, 1)
    expect(merged.device3).toBe(5); // from b
  });

  it('should be associative', () => {
    const a = { device1: 1 };
    const b = { device2: 2 };
    const c = { device3: 3 };
    
    const left = mergeClocks(mergeClocks(a, b), c);
    const right = mergeClocks(a, mergeClocks(b, c));
    
    expect(left).toEqual(right);
  });

  it('should be commutative', () => {
    const a = { device1: 1, device2: 2 };
    const b = { device2: 1, device3: 3 };
    
    expect(mergeClocks(a, b)).toEqual(mergeClocks(b, a));
  });

  it('should be idempotent', () => {
    const a = { device1: 1, device2: 2 };
    
    expect(mergeClocks(a, a)).toEqual(a);
  });
});

describe('OR-Set', () => {
  it('should add items and query them', () => {
    const set = createORSet<string>();
    const clock = createVectorClock('device1', 1);
    
    const withAlice = addToORSet(set, 'Alice', 'device1', clock);
    
    expect(queryORSet(withAlice).has('Alice')).toBe(true);
    expect(hasInORSet(withAlice, 'Alice')).toBe(true);
    expect(hasInORSet(withAlice, 'Bob')).toBe(false);
  });

  it('should remove items', () => {
    const set = createORSet<string>();
    const clock1 = createVectorClock('device1', 1);
    
    const withAlice = addToORSet(set, 'Alice', 'device1', clock1);
    const withoutAlice = removeFromORSet(withAlice, 'Alice');
    
    expect(queryORSet(withoutAlice).has('Alice')).toBe(false);
  });

  it('should preserve concurrent adds during merge (add wins)', () => {
    // Device A adds Alice
    const clockA = createVectorClock('deviceA', 1);
    const setA = addToORSet(createORSet<string>(), 'Alice', 'deviceA', clockA);
    
    // Device B adds Bob (concurrently)
    const clockB = createVectorClock('deviceB', 1);
    const setB = addToORSet(createORSet<string>(), 'Bob', 'deviceB', clockB);
    
    // Merge: both present (add wins over remove)
    const merged = mergeORSets(setA, setB);
    
    expect(queryORSet(merged).has('Alice')).toBe(true);
    expect(queryORSet(merged).has('Bob')).toBe(true);
  });

  it('should be associative', () => {
    const clock = createVectorClock('device1', 1);
    const a = addToORSet(createORSet<string>(), 'A', 'device1', clock);
    const b = addToORSet(createORSet<string>(), 'B', 'device1', clock);
    const c = addToORSet(createORSet<string>(), 'C', 'device1', clock);
    
    const left = mergeORSets(mergeORSets(a, b), c);
    const right = mergeORSets(a, mergeORSets(b, c));
    
    expect(queryORSet(left)).toEqual(queryORSet(right));
  });

  it('should be commutative', () => {
    const clock = createVectorClock('device1', 1);
    const a = addToORSet(createORSet<string>(), 'A', 'device1', clock);
    const b = addToORSet(createORSet<string>(), 'B', 'device1', clock);
    
    expect(queryORSet(mergeORSets(a, b))).toEqual(queryORSet(mergeORSets(b, a)));
  });

  it('should be idempotent', () => {
    const clock = createVectorClock('device1', 1);
    const a = addToORSet(createORSet<string>(), 'A', 'device1', clock);
    
    const merged = mergeORSets(a, a);
    
    expect(queryORSet(merged)).toEqual(queryORSet(a));
  });

  it('should preserve membership through remove-add-remove cycles', () => {
    const clock1 = createVectorClock('device1', 1);
    const clock2 = createVectorClock('device1', 2);
    
    let set = createORSet<string>();
    set = addToORSet(set, 'Alice', 'device1', clock1);
    set = removeFromORSet(set, 'Alice');
    set = addToORSet(set, 'Alice', 'device1', clock2);
    
    expect(queryORSet(set).has('Alice')).toBe(true);
  });

  it('should compact to remove tombstones', () => {
    const clock = createVectorClock('device1', 1);
    let set = addToORSet(createORSet<string>(), 'Alice', 'device1', clock);
    set = removeFromORSet(set, 'Alice');
    
    expect(set.adds.size).toBe(1); // Still has add
    expect(set.removes.size).toBe(1); // Has tombstone
    
    const compacted = compactORSet(set);
    
    expect(compacted.adds.size).toBe(0); // Removed
    expect(compacted.removes.size).toBe(0); // Tombstones cleared
    expect(queryORSet(compacted).size).toBe(0);
  });

  it('should handle community membership scenario', () => {
    // Simulate: Device A sees {Alice, Bob}, Device B sees {Alice, Bob, Charlie}
    const clock = createVectorClock('device1', 1);
    
    const setA = addToORSet(
      addToORSet(createORSet<string>(), 'Alice', 'device1', clock),
      'Bob', 'device1', clock
    );
    
    const setB = addToORSet(setA, 'Charlie', 'device2', clock);
    
    // B's view has Charlie, A doesn't know yet
    // When they merge, Charlie should appear
    const merged = mergeORSets(setA, setB);
    
    const members = queryORSet(merged);
    expect(members.has('Alice')).toBe(true);
    expect(members.has('Bob')).toBe(true);
    expect(members.has('Charlie')).toBe(true);
  });
});

describe('LWW-Register', () => {
  it('should create and retrieve values', () => {
    const clock = createVectorClock('device1', 1);
    const reg = createLWWRegister('active', 'device1', clock, 1000);
    
    expect(reg.value).toBe('active');
    expect(reg.writerId).toBe('device1');
  });

  it('should merge with later vector clock winning', () => {
    const clock1 = createVectorClock('device1', 1);
    const clock2 = createVectorClock('device1', 2);
    
    const reg1 = createLWWRegister('active', 'device1', clock1, 1000);
    const reg2 = createLWWRegister('ended', 'device1', clock2, 2000);
    
    const merged = mergeLWWRegisters(reg1, reg2);
    
    // Later clock wins
    expect(merged.value).toBe('ended');
  });

  it('should use timestamp for concurrent writes', () => {
    const clock = createVectorClock('device1', 1); // Same vector clock
    
    const reg1 = createLWWRegister('value1', 'device1', clock, 1000);
    const reg2 = createLWWRegister('value2', 'device2', clock, 2000);
    
    const merged = mergeLWWRegisters(reg1, reg2);
    
    // Later timestamp wins when clocks equal
    expect(merged.value).toBe('value2');
  });

  it('should be associative', () => {
    const clock1 = createVectorClock('device1', 1);
    const clock2 = createVectorClock('device1', 2);
    const clock3 = createVectorClock('device1', 3);
    
    const a = createLWWRegister('a', 'device1', clock1, 1000);
    const b = createLWWRegister('b', 'device1', clock2, 2000);
    const c = createLWWRegister('c', 'device1', clock3, 3000);
    
    const left = mergeLWWRegisters(mergeLWWRegisters(a, b), c);
    const right = mergeLWWRegisters(a, mergeLWWRegisters(b, c));
    
    expect(left.value).toBe(right.value);
  });

  it('should be commutative', () => {
    const clock1 = createVectorClock('device1', 1);
    const clock2 = createVectorClock('device1', 2);
    
    const a = createLWWRegister('a', 'device1', clock1, 1000);
    const b = createLWWRegister('b', 'device1', clock2, 2000);
    
    expect(mergeLWWRegisters(a, b).value).toBe(mergeLWWRegisters(b, a).value);
  });

  it('should be idempotent', () => {
    const clock = createVectorClock('device1', 1);
    const a = createLWWRegister('value', 'device1', clock, 1000);
    
    expect(mergeLWWRegisters(a, a)).toEqual(a);
  });

  it('should detect register expiration with TTL', () => {
    const clock = createVectorClock('device1', 1);
    const reg = createLWWRegister('active', 'device1', clock, 1000);
    
    expect(hasRegisterExpired(reg, 500, 1500)).toBe(true);  // Expired
    expect(hasRegisterExpired(reg, 500, 1200)).toBe(false); // Not expired
  });

  it('should handle call state scenario', () => {
    // Simulate: Call started, then ended
    const startClock = createVectorClock('device1', 1);
    const endClock = createVectorClock('device1', 2);
    
    const callStarted = createLWWRegister('inviting', 'device1', startClock, 1000);
    const callEnded = createLWWRegister('ended', 'device1', endClock, 5000);
    
    // Device B only knows about the call starting
    const deviceBView = callStarted;
    
    // When B receives the ended event, it should update
    const mergedView = mergeLWWRegisters(deviceBView, callEnded);
    
    expect(mergedView.value).toBe('ended');
    
    // Check if call is still "active"
    const isActive = mergedView.value !== 'ended';
    expect(isActive).toBe(false);
  });
});

describe('G-Counter', () => {
  it('should increment and query', () => {
    let counter = createGCounter();
    counter = incrementGCounter(counter, 'device1', 5);
    counter = incrementGCounter(counter, 'device2', 3);
    
    expect(queryGCounter(counter)).toBe(8);
  });

  it('should merge by taking maximums', () => {
    let a = createGCounter();
    a = incrementGCounter(a, 'device1', 5);
    
    let b = createGCounter();
    b = incrementGCounter(b, 'device1', 3); // Lower than a
    b = incrementGCounter(b, 'device2', 4);
    
    const merged = mergeGCounters(a, b);
    
    // Max of device1: max(5, 3) = 5
    // device2: 4
    // Total: 5 + 4 = 9
    expect(queryGCounter(merged)).toBe(9);
  });

  it('should be associative', () => {
    const a = incrementGCounter(createGCounter(), 'device1', 1);
    const b = incrementGCounter(createGCounter(), 'device2', 2);
    const c = incrementGCounter(createGCounter(), 'device3', 3);
    
    const left = queryGCounter(mergeGCounters(mergeGCounters(a, b), c));
    const right = queryGCounter(mergeGCounters(a, mergeGCounters(b, c)));
    
    expect(left).toBe(right);
  });

  it('should be commutative', () => {
    const a = incrementGCounter(createGCounter(), 'device1', 5);
    const b = incrementGCounter(createGCounter(), 'device2', 3);
    
    expect(queryGCounter(mergeGCounters(a, b))).toBe(
      queryGCounter(mergeGCounters(b, a))
    );
  });

  it('should be idempotent', () => {
    const a = incrementGCounter(createGCounter(), 'device1', 5);
    
    expect(queryGCounter(mergeGCounters(a, a))).toBe(queryGCounter(a));
  });

  it('should track presence with decay', () => {
    const now = 1000000;
    
    let state = createPresenceState();
    state = recordPresence(state, 'alice', 'device1', now - 10000, {}); // 10s ago
    state = recordPresence(state, 'bob', 'device2', now - 60000, {});  // 60s ago
    state = recordPresence(state, 'carol', 'device3', now - 600000, {}); // 10m ago
    
    const aliceStatus = getPresenceStatus(state, 'alice', now);
    const bobStatus = getPresenceStatus(state, 'bob', now);
    const carolStatus = getPresenceStatus(state, 'carol', now);
    
    expect(aliceStatus.status).toBe('online');
    expect(bobStatus.status).toBe('recent');
    expect(carolStatus.status).toBe('offline');
  });

  it('should merge presence states correctly', () => {
    const now = 1000000;
    
    const stateA = recordPresence(
      createPresenceState(),
      'alice',
      'device1',
      now - 10000,
      {}
    );
    
    const stateB = recordPresence(
      createPresenceState(),
      'bob',
      'device2',
      now - 5000,
      {}
    );
    
    const merged = mergePresenceStates(stateA, stateB);
    
    expect(getPresenceStatus(merged, 'alice', now).status).toBe('online');
    expect(getPresenceStatus(merged, 'bob', now).status).toBe('online');
  });
});

describe('CRDT Properties Summary', () => {
  it('OR-Set: Add wins over remove', () => {
    // Concurrent add and remove of same item
    const clock1 = createVectorClock('device1', 1);
    const clock2 = createVectorClock('device2', 1); // Concurrent
    
    const withAdd = addToORSet(createORSet<string>(), 'Alice', 'device1', clock1);
    const withRemove = removeFromORSet(withAdd, 'Alice');
    
    // Alice was removed
    expect(queryORSet(withRemove).has('Alice')).toBe(false);
    
    // But if we add Alice again (new clock)
    const clock3 = createVectorClock('device1', 2);
    const reAdded = addToORSet(withRemove, 'Alice', 'device1', clock3);
    
    // Add wins over previous remove
    expect(queryORSet(reAdded).has('Alice')).toBe(true);
  });

  it('LWW-Register: Later write wins', () => {
    const clock1 = createVectorClock('device1', 1);
    const clock2 = createVectorClock('device1', 2);
    
    const reg1 = createLWWRegister('first', 'device1', clock1, 1000);
    const reg2 = createLWWRegister('second', 'device1', clock2, 2000);
    
    // Later clock wins regardless of order in merge
    expect(mergeLWWRegisters(reg1, reg2).value).toBe('second');
    expect(mergeLWWRegisters(reg2, reg1).value).toBe('second');
  });

  it('G-Counter: Monotonic growth only', () => {
    let counter = createGCounter();
    
    // Can only increase
    counter = incrementGCounter(counter, 'device1', 5);
    expect(queryGCounter(counter)).toBe(5);
    
    counter = incrementGCounter(counter, 'device1', 3);
    expect(queryGCounter(counter)).toBe(8);
    
    // Other devices also increase
    counter = incrementGCounter(counter, 'device2', 10);
    expect(queryGCounter(counter)).toBe(18);
  });
});
