# CRDT Primitives API Review

**Date:** 2026-04-26  
**Package:** `@dweb/crdt`  
**Status:** ✅ Ready for Phase 1

---

## Overview

The CRDT primitives package provides foundational data structures for building distributed, eventually consistent applications. These CRDTs will replace centralized state patterns in Obscur v1.4.0.

---

## API Design Decisions

### 1. Immutability by Default

**Decision:** All operations return new objects.

```typescript
// Immutable pattern
const set1 = createORSet<string>();
const set2 = addToORSet(set1, 'Alice', deviceId, clock); // New object
// set1 is unchanged
```

**Rationale:**
- Prevents accidental mutations
- Enables time-travel debugging
- Compatible with React's immutability expectations
- Easier to reason about in concurrent environments

**Trade-off:** Performance cost from object creation. For large sets (1000+ elements), consider batching operations or using structural sharing in future optimizations.

### 2. Vector Clocks for Causality

**Decision:** Use vector clocks instead of wall-clock timestamps for primary ordering.

```typescript
const clock: VectorClock = { deviceA: 1, deviceB: 3 };
const result = vectorCompare(clockA, clockB); // -1 | 0 | 1
```

**Rationale:**
- True causality tracking (happens-before relationships)
- No dependency on clock synchronization
- Can detect concurrent events (conflicts)

**Fallback:** Wall-clock timestamps used for tie-breaking when vector clocks are concurrent.

### 3. OR-Set: Add-Wins Semantics

**Decision:** Observed-Remove Set with add-wins semantics for membership.

```typescript
// Alice added by A
const setA = addToORSet(createORSet(), 'Alice', 'deviceA', clock1);
// Alice removed by B (concurrently)
const setB = removeFromORSet(setA, 'Alice');

// If A adds Alice again after seeing removal
const setC = addToORSet(setB, 'Alice', 'deviceA', clock2);
// Alice is present (add wins over observed remove)
```

**Use Case:** Community membership where re-joining should work even after leaving.

### 4. LWW-Element-Set: Last-Write-Wins Per Element

**Decision:** Separate LWW-Element-Set for message history (different from OR-Set).

```typescript
// Messages have IDs, edits resolve by LWW
const msgSet = addToLWWSet(
  createLWWElementSet<Message>(),
  'msg-1',
  { text: 'Hello' },
  deviceId,
  clock
);

// Later edit (later clock wins)
const edited = addToLWWSet(msgSet, 'msg-1', { text: 'Hello edited' }, deviceId, laterClock);
```

**Distinction from OR-Set:**
- OR-Set: Set semantics (element is present or not)
- LWW-Set: Map semantics (element has a value that can be updated)

### 5. TypeScript Generics

**Decision:** Full generic support for type safety.

```typescript
// String pubkeys for membership
const memberSet = createORSet<string>();

// Complex objects for messages
const msgSet = createLWWElementSet<{ id: string; text: string; attachments: string[] }>();
```

### 6. Nostr Event Integration

**Decision:** Adapter module bridges Nostr events and CRDTs.

```typescript
// Extract vector clock from Nostr event
const clock = eventToVectorClock(nostrEvent, deviceId);

// Replay events into CRDT
const memberSet = replayEventsToORSet(
  communityEvents,
  (event) => event.pubkey,
  (event) => event.kind === 30000 ? 'add' : 'remove',
  deviceId
);
```

**Rationale:** Obscur uses Nostr as transport; CRDTs are application-layer state.

---

## CRDT Properties Verified

All implementations satisfy the three required CRDT properties:

### Associativity
```typescript
merge(merge(a, b), c) === merge(a, merge(b, c))
```
Verified in tests for all CRDT types.

### Commutativity
```typescript
merge(a, b) === merge(b, a)
```
Verified in tests for all CRDT types.

### Idempotence
```typescript
merge(a, a) === a
```
Verified in tests for all CRDT types.

---

## Module Reference

| Module | Exports | Purpose |
|--------|---------|---------|
| `vector-clock` | `createVectorClock`, `mergeClocks`, `vectorCompare`, `areConcurrent` | Causality tracking |
| `or-set` | `createORSet`, `addToORSet`, `removeFromORSet`, `mergeORSets`, `queryORSet` | Membership (add-wins) |
| `lww-register` | `createLWWRegister`, `setLWWRegister`, `mergeLWWRegisters`, `hasRegisterExpired` | Single values with TTL |
| `lww-element-set` | `createLWWElementSet`, `addToLWWSet`, `mergeLWWSets`, `queryLWWSet` | Message collections |
| `g-counter` | `createGCounter`, `incrementGCounter`, `mergeGCounters`, `queryGCounter` | Monotonic counters |
| `delta-state` | `createDeltaState`, `applyDeltaState`, `createDeltaBuffer` | Efficient sync |
| `nostr-event-adapter` | `eventToVectorClock`, `replayEventsToORSet`, `replayEventsToLWWSet` | Nostr integration |

---

## Usage Patterns

### Pattern 1: Community Membership

```typescript
import { createORSet, addToORSet, removeFromORSet, mergeORSets, queryORSet } from '@dweb/crdt/or-set';
import { createVectorClock, incrementClock } from '@dweb/crdt/vector-clock';

class CommunityMembership {
  private members: ORSet<string>;
  private clock: VectorClock;
  private deviceId: string;

  constructor(deviceId: string) {
    this.members = createORSet<string>();
    this.clock = createVectorClock(deviceId, 0);
    this.deviceId = deviceId;
  }

  join(pubkey: string) {
    this.clock = incrementClock(this.clock, this.deviceId);
    this.members = addToORSet(this.members, pubkey, this.deviceId, this.clock);
  }

  leave(pubkey: string) {
    this.members = removeFromORSet(this.members, pubkey);
  }

  merge(other: ORSet<string>) {
    this.members = mergeORSets(this.members, other);
    // Update clock to reflect merge
    this.clock = mergeClocks(this.clock, extractClockFromORSet(other));
  }

  getMembers(): Set<string> {
    return queryORSet(this.members);
  }
}
```

### Pattern 2: DM History

```typescript
import { createLWWElementSet, addToLWWSet, queryLWWSet } from '@dweb/crdt/lww-element-set';

class DMHistory {
  private messages: LWWElementSet<Message>;

  constructor() {
    this.messages = createLWWElementSet<Message>();
  }

  addMessage(msg: Message, deviceId: string, clock: VectorClock) {
    this.messages = addToLWWSet(
      this.messages,
      msg.id,
      msg,
      deviceId,
      clock,
      Date.now()
    );
  }

  getMessages(): Message[] {
    return queryLWWSet(this.messages);
  }
}
```

### Pattern 3: Presence

```typescript
import { createPresenceState, recordPresence, getPresenceStatus } from '@dweb/crdt/g-counter';

class PresenceTracker {
  private state = createPresenceState();

  heartbeat(pubkey: string, deviceId: string) {
    this.state = recordPresence(this.state, pubkey, deviceId, Date.now());
  }

  getStatus(pubkey: string) {
    return getPresenceStatus(this.state, pubkey);
    // Returns: { status: 'online' | 'recent' | 'away' | 'offline', sublabel: string }
  }
}
```

---

## Performance Considerations

### Current Limitations

1. **OR-Set copies entire Map on add**: O(n) for n elements
   - Mitigation: Batched updates, compaction for tombstones
   - Future: Structural sharing (persistent data structures)

2. **Vector clocks grow unbounded**: One entry per device
   - Mitigation: Clock pruning for inactive devices
   - Future: Periodic synchronization points

3. **JSON serialization**: Verbose for large sets
   - Mitigation: Delta states for sync
   - Future: Binary serialization for wire format

### Recommended Limits

| Metric | Recommended | Mitigation |
|--------|-------------|------------|
| Community members | < 10,000 | Sharding, delta sync |
| Message history | < 100,000 | Pagination, archived segments |
| Tombstones | < 50% of adds | Periodic compaction |
| Vector clock size | < 100 devices | Pruning inactive devices |

---

## Migration Path from Current Code

### Step 1: Add CRDT Package Dependency
```json
"@dweb/crdt": "workspace:*"
```

### Step 2: Create CRDT Container Wrappers
- Wrap CRDTs in React hooks for state management
- Provide persistence layer (IndexedDB serialization)

### Step 3: Gradual Migration
- New features use CRDTs
- Legacy code continues with existing patterns
- Compatibility bridge during transition

### Step 4: Remove Legacy Code
- Once CRDT paths are validated
- Feature flags control rollout

---

## Review Fixes Applied

### Fix 1: OR-Set Tag Generation (Line 64-79)

**Issue:** `JSON.stringify` produces unstable keys for objects.

**Fix:** Added explicit handling for strings/numbers, deterministic key sorting for clocks.

```typescript
// Before
const createTag = <T>(value: T, deviceId: DeviceId, clock: VectorClock): string =>
  `${deviceId}:${JSON.stringify(value)}:${JSON.stringify(clock)}`;

// After
const createTag = <T>(value: T, deviceId: DeviceId, clock: VectorClock): string => {
  const valueStr = typeof value === 'string' ? value 
    : typeof value === 'number' ? String(value)
    : JSON.stringify(value);
  
  const clockStr = Object.entries(clock)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join(',');
  
  return `${deviceId}:${valueStr}:${clockStr}`;
};
```

### Fix 2: Added LWW-Element-Set Module

**Issue:** Roadmap specified LWW-Element-Set for message history, but only OR-Set and LWW-Register were implemented.

**Fix:** Created `lww-element-set.ts` with per-element LWW semantics.

### Fix 3: Added Nostr Event Adapter

**Issue:** No bridge between Nostr events (transport) and CRDTs (application state).

**Fix:** Created `nostr-event-adapter.ts` with event replay utilities.

### Fix 4: TypeScript Safety

**Issue:** Potential `undefined` access in tag parsing.

**Fix:** Added explicit undefined checks in `extractClockFromNostrTags`.

---

## Conclusion

The CRDT primitives package is **ready for Phase 1 implementation**.

### Strengths
- Mathematically correct (verified properties)
- Well-documented with examples
- Type-safe with full generics
- Nostr integration ready
- Immutable by default

### Known Limitations
- Performance for very large sets (10k+ elements)
- Memory overhead from immutability
- Tombstone accumulation (mitigated by compaction)

### Recommendations
1. Proceed with Phase 1: Community Membership CRDT
2. Add benchmarks in Phase 2 to measure performance
3. Consider structural sharing if benchmarks show issues
4. Monitor tombstone growth in production

---

**Reviewer:** Cascade  
**Status:** ✅ Approved for implementation
