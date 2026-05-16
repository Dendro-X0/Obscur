# Community Membership Synchronization Architecture

## Problem Statement

In a decentralized relay-based system, **real-time membership updates are not possible**. However, the current implementation attempts to achieve this through fragile DM-based updates, which fails when:

1. **DMs are lost**: Relay transport is unreliable; messages can be dropped
2. **Recipient is offline**: A must be online when B accepts to receive the update
3. **Multi-device scenarios**: A's other devices never learn about B's membership
4. **Restart data loss**: After dev server restart, membership state is inconsistent

## Current (Broken) Architecture

```
A creates group ──> B receives invite ──> B accepts
     │                                      │
     │                                      ▼
     │                              [B sends DM to A]
     │                                      │
     ▼                                      ▼
[A's member list] <────────────── [A receives DM]
     │
     ▼
[If DM lost: A never learns B joined]
```

**Flaws:**
- Single point of failure (DM delivery)
- No eventual consistency mechanism
- No way for A to query "who is a member"
- Profile isolation issues in single-process testing

## Proposed Solution: Relay-Based Membership Gossip

```
A creates group ──> B receives invite ──> B accepts
     │                                      │
     │                              [B publishes NIP-29 JOIN to relay]
     │                              [B sends DM to A (notification only)]
     │                                      │
     ▼                                      ▼
[A subscribes to relay] <────────── [Relay stores JOIN event]
     │
     ▼
[A processes JOIN event]
     │
     ▼
[A's member list updated]
```

**Benefits:**
- **Eventually consistent**: All members see the same membership roster over time
- **No single point of failure**: Relay stores events; members can query anytime
- **Multi-device friendly**: A's other devices can subscribe and sync
- **Survives restarts**: Membership state can be recovered from relay

## Implementation Strategy

### Phase 1: Event Subscription (Immediate Fix)

A must subscribe to NIP-29 membership events on the community relay:

```typescript
// In group-provider.tsx or community-membership-coordinator.ts
function subscribeToMembershipEvents(groupId: string, relayUrl: string) {
  const filter = {
    kinds: [39001, 39002], // Join and Leave events
    "#h": [groupId],       // Tag for group ID
  };
  
  relayPool.subscribe(filter, (event) => {
    if (event.kind === 39001) {
      processMemberJoined(event.pubkey, groupId);
    } else if (event.kind === 39002) {
      processMemberLeft(event.pubkey, groupId);
    }
  });
}
```

### Phase 2: Gossip Sync (Robustness)

Periodic sync to ensure consistency:

```typescript
// Periodic membership gossip
async function gossipSyncMembership(groupId: string, relayUrl: string) {
  // Query relay for recent join/leave events
  const since = lastSyncTimestamp;
  const events = await queryRelay(relayUrl, {
    kinds: [39001, 39002],
    "#h": [groupId],
    since,
  });
  
  // Apply events in chronological order
  for (const event of sortByTimestamp(events)) {
    await applyMembershipEvent(event);
  }
  
  lastSyncTimestamp = Date.now();
}
```

### Phase 3: Conflict Resolution (Edge Cases)

Handle concurrent membership changes:

```typescript
function resolveMembershipConflict(operations: MembershipOperation[]) {
  // Sort by timestamp
  const sorted = operations.sort((a, b) => a.timestamp - b.timestamp);
  
  // Apply in order, with special handling for:
  // - Join after leave (rejoin)
  // - Leave after join (normal leave)
  // - Expulsion (admin override)
  // - Concurrent conflicting operations (timestamp wins)
}
```

## Architectural Changes Required

### 1. Group Provider Enhancement

`group-provider.tsx` must:
- Subscribe to NIP-29 events when opening a community
- Process join/leave events and update roster
- Integrate with existing DM-based flow (for optimistic updates)
- Use gossip sync on mount for consistency after restart

### 2. Community Invite Card Update

`community-invite-card.tsx` already publishes NIP-29 join events (line 185-194). This is correct and should be preserved.

### 3. Incoming DM Handler

`incoming-dm-event-handler.ts` should:
- Continue processing accept responses (for immediate feedback)
- But NOT rely on them as the sole source of truth
- Log warnings if accept received but no matching NIP-29 event seen

### 4. New Service: Community Membership Sync

Create `community-membership-sync.ts` to:
- Manage relay subscriptions
- Process NIP-29 events
- Handle gossip sync
- Resolve conflicts
- Provide diagnostics

## Trade-offs and Considerations

### Eventual Consistency

**Problem**: Members won't see immediate updates when someone joins.

**Solution**: 
- Keep DM-based notification for immediate feedback (optimistic)
- Use relay-based sync for durable truth
- Show "sync pending" indicators when views differ

### Relay Dependency

**Problem**: If community relay is down, membership sync stops.

**Solution**:
- Use multiple relays (relay pool already supports this)
- Cache membership state locally
- Show "membership may be stale" warning

### Privacy

**Problem**: NIP-29 join events are public; this reveals membership.

**Solution**:
- For private communities, use sealed events (kind 10105 with membership type)
- Or use invite-only with no public membership list
- Accept that public communities have public membership

## Migration Path

1. **Immediate**: Implement subscription to NIP-29 events in Group Provider
2. **Short-term**: Add gossip sync on community open
3. **Medium-term**: Add conflict resolution for edge cases
4. **Long-term**: Deprecate DM-based membership updates (keep only for notifications)

## Testing Strategy

### Single-Process A/B Test

1. A creates group
2. A invites B
3. B accepts (publishes NIP-29 join)
4. **Wait for relay gossip** (may need delay in tests)
5. Verify A sees B in member list

### Restart Test

1. A creates group, invites B
2. B accepts
3. **Restart dev server**
4. A opens community
5. A's gossip sync should recover B's membership
6. Verify B is in member list

## Success Criteria

- [ ] B's join is visible to A within 30 seconds of relay sync
- [ ] Membership survives dev server restart
- [ ] Multi-device: A's other devices see B after sync
- [ ] Single-process A/B test passes without DM dependency
