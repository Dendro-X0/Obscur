# P2P Architecture Redesign: From Centralized to Convergent

**Status:** Research Phase  
**Date:** 2026-04-25  
**Context:** Month-long debugging cycle has revealed fundamental architectural mismatch

---

## The Core Realization

We've been building a **decentralized** system using **centralized** patterns. This is why debugging never ends.

### Centralized vs P2P Mental Models

| Centralized | P2P/Obscur |
|-------------|------------|
| Single source of truth | Every device is a truth source |
| "Current state" | "Converging state" |
| "User is Online" | "User was seen 3s ago" |
| Immediate consistency | Eventual consistency |
| Server resolves conflicts | Clients merge conflicts |
| Drift = bug | Drift = normal, must merge |

---

## Current Architecture Analysis

### What We Have (Good Foundation!)

```
Nostr Events → Event Reducer → Projections → UI
```

This is **almost** a CRDT system! The pieces are there:
- ✅ Immutable events (operation log)
- ✅ Reducers (state transformations)
- ✅ Signed events (causality tracking)
- ✅ Timestamps (for LWW)

### What's Broken (Wrong Mindset)

1. **"Projection Authority"** - Trying to pick ONE truth
   - Files: `account-projection-read-authority.ts`, `dm-read-authority-contract.ts`
   - Problem: "Which source wins?" is the wrong question
   - Fix: "How do we merge all sources?"

2. **"Drift Detection"** - Treating divergence as error
   - Files: `dm-authority-drift-detector.ts`, `account-sync-drift-detector.ts`
   - Problem: Drift is inevitable in P2P
   - Fix: Embrace divergence, design merge strategies

3. **"Ghost Calls"** - Events treated as commands
   - Problem: Old call events re-triggering
   - Root cause: No separation of "event log" from "derived state"
   - Fix: State is a CRDT, not a replay of events

4. **"Member List Thinning"** - Overwriting instead of merging
   - Problem: Snapshot replaces instead of merges
   - Fix: OR-Set for membership

---

## The Solution: CRDT-Native Architecture

### Phase 1: CRDT State Containers (Week 1-2)

#### 1.1 Member Lists → OR-Set CRDT

**Current (Broken):**
```typescript
// Snapshot replaces all members
setMembers(snapshot.members) // ❌ Loses concurrent additions
```

**Proposed (Fixed):**
```typescript
// OR-Set: Add wins over remove
interface MembershipSet {
  adds: Set<Pubkey>;     // All "join" events
  removes: Set<Pubkey>;  // All "leave" events
}

const merge = (a: MembershipSet, b: MembershipSet): MembershipSet => ({
  adds: union(a.adds, b.adds),
  removes: union(a.removes, b.removes)
});

const getMembers = (set: MembershipSet): Pubkey[] =>
  [...set.adds].filter(m => !set.removes.has(m));
```

**Why this fixes thinning:**
- Device A sees members {Alice, Bob}
- Device B sees members {Alice, Bob, Charlie}
- Merge result: {Alice, Bob, Charlie} (all adds preserved)
- No "winner," just union of all evidence

#### 1.2 Presence → G-Counter + Heartbeat

**Current (Broken):**
```typescript
// Binary online/offline with race conditions
setPresence({ userId: 'online' }) // ❌ Stale on network issues
```

**Proposed (Fixed):**
```typescript
// G-Counter: Last-seen timestamp with decay
interface Presence {
  lastSeenAt: Map<Pubkey, number>; // Device's view
  receivedAt: Map<Pubkey, number>; // When we got the update
}

// UI shows: "Online (seen 2s ago)" or "Away (seen 5m ago)"
const getPresenceStatus = (p: Presence, pubkey: Pubkey): Status => {
  const lastSeen = p.lastSeenAt.get(pubkey);
  const age = Date.now() - lastSeen;
  if (age < 30000) return { label: 'Online', sublabel: `seen ${Math.floor(age/1000)}s ago` };
  if (age < 300000) return { label: 'Away', sublabel: `seen ${Math.floor(age/60000)}m ago` };
  return { label: 'Offline', sublabel: null };
};
```

#### 1.3 Chat History → LWW-Element-Set

**Current (Broken):**
```typescript
// Messages can "disappear" during sync
hydrateMessages(restoredMessages) // ❌ Filters out "unknown" messages
```

**Proposed (Fixed):**
```typescript
// LWW-Element-Set: Keep all messages, last writer wins on conflict
interface ChatSet {
  messages: Map<MessageId, { content: Message; timestamp: number; source: DeviceId }>;
}

const merge = (a: ChatSet, b: ChatSet): ChatSet => {
  const merged = new Map(a.messages);
  for (const [id, msg] of b.messages) {
    const existing = merged.get(id);
    if (!existing || msg.timestamp > existing.timestamp) {
      merged.set(id, msg); // LWW
    }
  }
  return { messages: merged };
};
```

---

## Phase 2: Gossip Protocol for Presence (Week 2-3)

### Problem with Current Polling
```typescript
// Current: Subscribe to all presence, get flooded
subscribeToPresence({ kinds: [PRESENCE], authors: [...everyone] })
```

### Gossip Solution
```typescript
// Epidemic broadcast: Tell 3 peers, they tell 3 more
interface GossipMessage {
  type: 'presence' | 'member_update' | 'history_sync';
  payload: SignedEvent;
  ttl: number; // Decrement to prevent floods
}

// UI: "Synchronizing with 3 peers..." → "Seen by 12 peers"
// Educational: "Privacy requires gossip - no central server knows all"
```

**Benefits:**
- Scales to large groups (unlike broadcast)
- No central point of failure
- Natural partition tolerance
- Users see "sync progress" instead of broken state

---

## Phase 3: Content-Addressed Media (Week 3-4)

### Why Videos Disappear
Current media is linked by message ID. When message sync is uncertain, media references break.

### DAG-Based Media
```typescript
// Media identified by hash, not message
interface MediaRef {
  sha256: string;      // Content address
  size: number;
  mimeType: string;
}

// Sync strategy: Ask peers "Do you have hash X?"
// UI: "Fetching media 3/5..." progress bar
// Educational: "Large files sync separately for reliability"
```

**Sync Protocol:**
1. Messages sync first (small, fast)
2. Media fetches async by hash
3. Cache by hash (deduplication for free!)
4. UI shows placeholder until fetched

---

## Phase 4: Eventual Consistency UX (Week 4-5)

### The UI Shift

**Current (Misleading):**
- "No offline participants detected" (actually: still syncing)
- "Online" (actually: last seen 5 minutes ago)
- Missing videos (actually: still fetching)

**Proposed (Honest):**
- "Synchronizing with network... 3/12 peers contacted"
- "Tester1 was seen 2s ago" (with freshness indicator)
- "Fetching media... 45%" (progress bar)
- "Some messages may be missing - syncing"

### Educational Tooltips
```
"Why is this slow?"
→ "Your data stays on YOUR devices. We're syncing directly
    with your contacts - no central server to speed things up.
    Privacy requires patience."

"Why can't I see all members?"
→ "We're gossiping with the network to find everyone.
    In a decentralized system, discovery takes time."
```

---

## Implementation Roadmap

### Week 1: Foundation
- [ ] Add `crdt/` package with OR-Set, LWW-Set, G-Counter implementations
- [ ] Create CRDT-based member list container
- [ ] Add CRDT merge to `community-ledger-reducer.ts`

### Week 2: Presence
- [ ] Replace binary presence with G-Counter
- [ ] Add gossip broadcast for presence updates
- [ ] Update UI to show "seen X ago" instead of "Online/Offline"

### Week 3: Media
- [ ] Separate media sync from message sync
- [ ] Implement hash-based media fetching
- [ ] Add progress indicators for media

### Week 4: UX Polish
- [ ] Add "Synchronizing..." states throughout app
- [ ] Create educational tooltips
- [ ] Design conflict resolution UI

### Week 5: Testing
- [ ] Multi-device sync tests
- [ ] Network partition recovery tests
- [ ] Large group performance tests

---

## Success Metrics

**Current (Broken) UX:**
- User sees empty member list → confusion
- Ghost calls → frustration
- Missing videos → data loss fear

**Proposed (Fixed) UX:**
- User sees "Syncing..." → understanding
- User sees "was seen 5s ago" → realistic expectations
- User sees "Fetching media..." → trust in process

---

## Technical Decisions

### Which CRDT for What?

| State | CRDT Type | Reason |
|-------|-----------|--------|
| Member lists | OR-Set | Add wins over remove (don't lose members) |
| Message history | LWW-Set | Last edit wins (acceptable for chat) |
| Presence | G-Counter | Monotonic, can calculate "last seen" |
| Read receipts | LWW-Register | Single value, latest wins |
| Profile metadata | LWW-Register | Single value, latest wins |

### Nostr as CRDT Transport

Nostr events are **perfect** CRDT operation logs:
- Immutable (signed, can't change)
- Ordered (created_at + id)
- Causal (pubkey + timestamp)
- Broadcastable (relay network)

We just need to change **how we process them** - merge instead of replace.

---

## Conclusion

The project isn't failing because it's too hard. It's failing because we're using the wrong paradigm.

**Centralized patterns** (single truth, drift detection, projections) are designed for client-server architectures.

**P2P patterns** (CRDTs, gossip, eventual consistency) are designed for distributed trustless systems.

Obscur is the latter. Let's build it that way.

---

## References

- [CRDTs: An Overview](https://crdt.tech/)
- [Gossip Protocols](https://en.wikipedia.org/wiki/Gossip_protocol)
- [Eventual Consistency](https://en.wikipedia.org/wiki/Eventual_consistency)
- [Nostr Protocol](https://github.com/nostr-protocol/nostr)
- [Automerge (CRDT library)](https://automerge.org/)
- [Yjs (CRDT library)](https://github.com/yjs/yjs)
