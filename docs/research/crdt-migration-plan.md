# CRDT Migration Plan: Immediate Actions

**Goal:** Stop the bleeding and fix the most critical UX issues within 2 weeks.

---

## Week 1: Fix Member List Thinning (CRITICAL)

### The Problem
Member lists "thin" because we're using "snapshots" that overwrite instead of CRDT sets that merge.

### The Fix
Convert `community-ledger-reducer.ts` to use OR-Set semantics.

**Files to Modify:**
1. `apps/pwa/app/features/groups/services/community-ledger-reducer.ts`
2. `apps/pwa/app/features/groups/hooks/use-sealed-community.ts`
3. `apps/pwa/app/features/groups/services/community-visible-members.ts`

### Implementation Steps

#### Step 1: Add CRDT Utilities (Day 1)
```typescript
// apps/pwa/app/shared/crdt/or-set.ts
export interface ORSet<T> {
  adds: Set<T>;      // All items ever added
  removes: Set<T>;   // All items ever removed
}

export const createORSet = <T>(): ORSet<T> => ({
  adds: new Set(),
  removes: new Set()
});

export const addToORSet = <T>(set: ORSet<T>, item: T): ORSet<T> => ({
  adds: new Set([...set.adds, item]),
  removes: set.removes
});

export const removeFromORSet = <T>(set: ORSet<T>, item: T): ORSet<T> => ({
  adds: set.adds,
  removes: new Set([...set.removes, item])
});

export const mergeORSets = <T>(a: ORSet<T>, b: ORSet<T>): ORSet<T> => ({
  adds: new Set([...a.adds, ...b.adds]),
  removes: new Set([...a.removes, ...b.removes])
});

export const queryORSet = <T>(set: ORSet<T>): Set<T> => {
  const result = new Set<T>();
  for (const item of set.adds) {
    if (!set.removes.has(item)) {
      result.add(item);
    }
  }
  return result;
};
```

#### Step 2: Refactor Community Ledger (Days 2-3)

Current state shape:
```typescript
interface CommunityState {
  members: Member[];  // ❌ This gets replaced
  invites: Invite[];
}
```

New state shape:
```typescript
interface CommunityState {
  memberSet: ORSet<Pubkey>;  // ✅ This merges
  invites: ORSet<InviteId>;
  metadata: LWWRegister<CommunityMetadata>;
}
```

#### Step 3: Update the Reducer (Days 3-4)

Change from:
```typescript
// Current: Replace all members
onMemberSnapshot: (state, { members }) => {
  state.members = members;  // ❌ Loses concurrent changes
}
```

To:
```typescript
// New: Merge member events
onMemberJoined: (state, { pubkey, timestamp }) => {
  state.memberSet = addToORSet(state.memberSet, pubkey);
},

onMemberLeft: (state, { pubkey, timestamp }) => {
  state.memberSet = removeFromORSet(state.memberSet, pubkey);
},

onSnapshotReceived: (state, { snapshot }) => {
  // Convert snapshot to operations and merge
  const snapshotSet = createORSet<Pubkey>();
  for (const member of snapshot.members) {
    snapshotSet.adds.add(member.pubkey);
  }
  state.memberSet = mergeORSets(state.memberSet, snapshotSet);
}
```

#### Step 4: Update UI Components (Days 4-5)

Add loading state:
```typescript
// apps/pwa/app/features/groups/components/community-participants.tsx
export const CommunityParticipants: React.FC = () => {
  const { memberSet, syncStatus } = useCommunity();
  const members = queryORSet(memberSet);
  
  if (syncStatus === 'syncing') {
    return (
      <div className="syncing-indicator">
        <Spinner />
        <p>Synchronizing with network...</p>
        <small>Found {members.size} members so far</small>
      </div>
    );
  }
  
  return <MemberList members={[...members]} />;
};
```

---

## Week 2: Fix Ghost Calls & Media Sync

### Part A: Ghost Call Fix (Days 1-3)

**Root Cause:** Voice call state is being derived from event replay instead of maintained as CRDT state.

**Files:**
- `apps/pwa/app/features/messaging/components/message-list-render-meta.ts`
- `apps/pwa/app/features/messaging/services/realtime-voice-signaling.ts`

**Fix:**
```typescript
// New: Call state as CRDT
interface CallState {
  callId: string;
  participants: ORSet<Pubkey>;
  status: LWWRegister<'inviting' | 'connected' | 'ended'>;
  startedAt: LWWRegister<number>;
  endedAt: LWWRegister<number | null>;
}

// Staleness check: Treat old calls as ended
const isCallActive = (call: CallState): boolean => {
  const status = call.status.value;
  const startedAt = call.startedAt.value;
  const endedAt = call.endedAt.value;
  
  if (status === 'ended') return false;
  if (endedAt !== null) return false;
  
  // Auto-end stale calls
  const maxCallDuration = 2 * 60 * 60 * 1000; // 2 hours
  if (Date.now() - startedAt > maxCallDuration) {
    return false;
  }
  
  return true;
};
```

### Part B: Media Sync Fix (Days 3-5)

**Root Cause:** Media is tied to messages. When message sync is uncertain, media references break.

**Fix:** Separate media sync with content addressing.

```typescript
// New: Media sync independent of messages
interface MediaStore {
  // Keyed by hash, not message ID
  items: Map<Sha256, MediaItem>;
}

interface MediaItem {
  sha256: string;
  blob: Blob | null;      // null if not fetched yet
  fetchStatus: 'pending' | 'fetching' | 'complete' | 'failed';
  sources: Set<Pubkey>;  // Who has this media
}

// Sync: Ask peers for specific hashes
const syncMedia = async (neededHashes: string[]) => {
  for (const hash of neededHashes) {
    const sources = findPeersWithMedia(hash);
    for (const source of sources) {
      try {
        await fetchMediaFromPeer(source, hash);
        break; // Got it, move to next
      } catch (e) {
        continue; // Try next source
      }
    }
  }
};
```

**UI Changes:**
```typescript
// Show progress for media
const MediaAttachment: React.FC<{ hash: string }> = ({ hash }) => {
  const media = useMedia(hash);
  
  if (media.fetchStatus === 'pending') {
    return <Placeholder>Fetching from network...</Placeholder>;
  }
  
  if (media.fetchStatus === 'fetching') {
    return <ProgressBar progress={media.progress} />;
  }
  
  if (media.fetchStatus === 'failed') {
    return <Error>Failed to load. Tap to retry.</Error>;
  }
  
  return <MediaBlob blob={media.blob} />;
};
```

---

## Immediate Quick Wins (This Week)

Before the full migration, we can add UX improvements immediately:

### 1. Add "Synchronizing" States (Day 1-2)
```typescript
// Add to community participant list
if (members.length === 1 && isCommunitySynced === false) {
  return (
    <div className="p-4 text-center">
      <div className="animate-pulse mb-2">🔄</div>
      <p className="text-sm text-gray-500">
        Synchronizing with network...
      </p>
      <p className="text-xs text-gray-400 mt-1">
        Found 1 member so far
      </p>
      <p className="text-xs text-gray-400 mt-2 max-w-xs mx-auto">
        In a privacy-first system, discovery takes time.
        We're gossiping with peers to find everyone.
      </p>
    </div>
  );
}
```

### 2. Change "Online" to "Seen X ago" (Day 2-3)
```typescript
// Replace boolean online status
const PresenceIndicator: React.FC<{ lastSeenAt: number }> = ({ lastSeenAt }) => {
  const age = Date.now() - lastSeenAt;
  
  if (age < 30000) {
    return <span className="text-green-500">● Online</span>;
  }
  
  if (age < 60000) {
    return <span className="text-yellow-500">● Seen {Math.floor(age/1000)}s ago</span>;
  }
  
  if (age < 300000) {
    return <span className="text-gray-500">● Seen {Math.floor(age/60000)}m ago</span>;
  }
  
  return <span className="text-gray-400">● Offline</span>;
};
```

### 3. Add Media Loading States (Day 3-4)
```typescript
// For video/image attachments
const AttachmentPlaceholder: React.FC = () => (
  <div className="border rounded p-4 bg-gray-50">
    <div className="flex items-center gap-2">
      <Spinner size="sm" />
      <span className="text-sm text-gray-600">
        Fetching media from peers...
      </span>
    </div>
    <div className="mt-2 h-1 bg-gray-200 rounded overflow-hidden">
      <div className="h-full bg-blue-500 w-1/3 animate-pulse" />
    </div>
    <p className="text-xs text-gray-400 mt-2">
      Large files sync separately for reliability
    </p>
  </div>
);
```

---

## Testing Strategy

### Manual Tests
1. **Member List Sync:**
   - Device A: Join community
   - Device B: Join same community
   - Both should show 2 members (not 1)

2. **Ghost Call Prevention:**
   - Start call on Device A
   - End call
   - Login on Device B (restore)
   - Should NOT show active call

3. **Media Persistence:**
   - Send video on Device A
   - Login on Device B
   - Video should appear (with progress indicator)

### Automated Tests
```typescript
// Test OR-Set merge
describe('OR-Set', () => {
  it('should merge concurrent adds', () => {
    const a = createORSet<string>();
    const b = createORSet<string>();
    
    const a2 = addToORSet(a, 'Alice');
    const b2 = addToORSet(b, 'Bob');
    
    const merged = mergeORSets(a2, b2);
    const result = queryORSet(merged);
    
    expect(result).toContain('Alice');
    expect(result).toContain('Bob');
  });
});
```

---

## Risk Mitigation

### What Could Go Wrong?
1. **Performance:** OR-Sets grow unbounded (adds + removes)
   - Mitigation: Periodically compact (remove items that are both added AND removed)

2. **Storage:** Keeping all events forever
   - Mitigation: Snapshot + events since snapshot

3. **Conflicts:** Two users edit same message simultaneously
   - Mitigation: LWW for simple values, user choice for complex conflicts

### Rollback Plan
If CRDT causes issues:
1. Keep old "projection" code as fallback
2. Add feature flag: `useCRDT: boolean`
3. Can switch back to old system

---

## Success Metrics

**Before (Current State):**
- Member list shows 1 member → User confusion
- Ghost calls appear → User frustration
- Videos disappear → User data loss fear
- Debug logs flood console → Developer confusion

**After (Target State):**
- Member list shows "Syncing... 2 members found" → User understanding
- Old calls correctly shown as "Ended" → User trust
- Videos show "Fetching..." → User patience
- Clean CRDT state → Developer confidence

---

## Decision Point

This is a significant architectural change. Before proceeding:

1. **Review this plan** - Does it address the right problems?
2. **Approve the UX changes** - Are we okay with "seen X ago" instead of "Online"?
3. **Set timeline** - Can we commit 2 weeks to this?

If yes, I can start with the Day 1 tasks immediately:
- Add CRDT utilities
- Add "Synchronizing" loading states
- Add "seen X ago" presence indicators

These are safe, backward-compatible changes that improve UX immediately while we work on the deeper CRDT integration.
