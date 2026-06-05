# Radical Architecture Overhaul: Obscur v2.0

> **Reference only (2026-06-01).** v1.9.x implements **incrementally** via [design-goals-and-constraints.md](../program/design-goals-and-constraints.md) §5 and [obscur-product-shell-architecture-2026-05.md](../program/obscur-product-shell-architecture-2026-05.md). Not a parallel daily queue. Archived alternate: [v2.0-resumption-charter.md](../program/v2.0-resumption-charter.md).

## Current State: The Problems

### 1. Implicit Profile Scope (60+ violations)
```typescript
// VIOLATION: Hidden global state
const profileId = getActiveProfileIdSafe(); // Who knows what this returns?
```
**Why it's broken**: Single-process A/B testing fails because this returns different values unpredictably. Tests mock it, but production has race conditions.

### 2. Bidirectional Feature Coupling
```
groups/ → messaging/chat-state-store (line 5 in group-provider.tsx)
messaging/ → groups/group-conversation-id (line 22 in messaging-provider.tsx)
```
**Why it's broken**: You can't test groups without messaging, or messaging without groups. Circular dependency death spiral.

### 3. Global State via `globalThis`
```typescript
// VIOLATION: Process-wide mutable state
const root = globalThis as Record<string, unknown>;
root[GLOBAL_STATE_KEY] = created; // Any profile can overwrite this
```
**Why it's broken**: Single-process A/B testing - Profile A's state leaks into Profile B.

### 4. Browser-Global Events
```typescript
// VIOLATION: All profiles receive all events
window.dispatchEvent(new CustomEvent("obscur:chat-state-replaced", ...));
```
**Why it's broken**: In single-process testing, Profile B receives Profile A's events. Chaos ensues.

### 5. Monolithic PWA (1104 files)
**Why it's broken**: Can't test, can't reason about, can't refactor safely.

---

## The Radical Solution: Explicit Everything

### Core Principle: **No Hidden Context**

Every function must receive its dependencies explicitly. No globals. No ambient authority. No implicit profile scope.

---

## Phase 1: Eliminate `getActiveProfileIdSafe()` (Week 1)

### The Rule
```typescript
// BEFORE (FORBIDDEN)
function doSomething() {
  const profileId = getActiveProfileIdSafe();
  return db.get(`key-${profileId}`);
}

// AFTER (REQUIRED)
function doSomething(params: { profileId: ProfileId }) {
  return db.get(`key-${params.profileId}`);
}
```

### Enforcement
ESLint rule: `no-implicit-profile-scope`
```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-restricted-imports': ['error', {
      paths: [{
        name: '@/app/features/profiles/services/profile-scope',
        importNames: ['getActiveProfileIdSafe'],
        message: 'Explicit profileId parameter required. No implicit scope.'
      }]
    }]
  }
};
```

### Migration Strategy
1. Add `profileId` parameter to every function that calls `getActiveProfileIdSafe()`
2. Update call sites to pass `profileId` from React context or explicit parameter
3. Delete `getActiveProfileIdSafe()` export
4. Tests now pass `profileId` explicitly - no more mocks needed

---

## Phase 2: Replace Global Events with Profile-Scoped Bus (Week 2)

### The Problem
```typescript
// BROKEN: All profiles receive this
window.dispatchEvent(new CustomEvent("obscur:group-invite-response-accepted", {
  detail: { groupId, memberPubkey }
}));
```

### The Solution
```typescript
// NEW: Profile-scoped message bus
interface ProfileMessageBus {
  publish(event: DomainEvent): void;
  subscribe(handler: EventHandler): Unsubscribe;
}

// Each profile has its own bus
const busA = createProfileMessageBus({ profileId: "profile-a" });
const busB = createProfileMessageBus({ profileId: "profile-b" });

// Events are isolated
busA.publish({ type: "group-invite-accepted", ... }); // Only A receives
busB.publish({ type: "group-invite-accepted", ... }); // Only B receives
```

### Implementation
```typescript
// packages/runtime/src/profile-bus.ts
export function createProfileMessageBus(params: {
  profileId: ProfileId;
}): ProfileMessageBus {
  const handlers = new Set<EventHandler>();
  
  return {
    publish: (event) => {
      // Only handlers for this profileId receive events
      handlers.forEach(h => h(event));
    },
    subscribe: (handler) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    }
  };
}

// React integration
function useProfileBus(): ProfileMessageBus {
  const profileId = useProfileContext(); // From Provider
  return useMemo(() => createProfileMessageBus({ profileId }), [profileId]);
}
```

---

## Phase 3: Split the Monolith (Weeks 3-4)

### Target Architecture

```
packages/
  core/                    # Domain logic, zero dependencies
    src/
      identity/            # Keys, profiles, auth contracts
      messaging/           # Message types, validation, encryption
      community/           # Membership, groups, CRDTs
      protocol/            # Nostr event types, wire format
      
  runtime/                 # Runtime services, depends on core
    src/
      storage/             # IndexedDB, localStorage abstractions
      relay/               # Nostr relay pool, subscriptions
      crypto/              # Key operations, encryption
      
  ui/                      # React components, depends on runtime
    src/
      shell/               # Window management, navigation
      chat/                # Message rendering, input
      communities/         # Group management UI
      
apps/
  shell/                   # Tauri/Next.js shell only
  pwa/                     # Web runtime composition
```

### Dependency Rules
```
core/ → (nothing)
runtime/ → core/
ui/ → runtime/, core/
apps/ → ui/, runtime/, core/
```

### Enforcement
```javascript
// packages/core/.eslintrc.js
module.exports = {
  rules: {
    'import/no-restricted-paths': ['error', {
      zones: [{
        target: './src',
        from: ['../runtime', '../ui', '../../apps'],
        message: 'Core must have zero dependencies'
      }]
    }]
  }
};
```

---

## Phase 4: Explicit Dependency Injection (Week 5)

### The Pattern
```typescript
// BEFORE: Implicit dependencies
class ChatStateStore {
  load(publicKeyHex: PublicKeyHex) {
    const profileId = getActiveProfileIdSafe(); // Implicit
    return db.get(`chat-${profileId}-${publicKeyHex}`);
  }
}

// AFTER: Explicit dependencies
interface ChatStateStoreDeps {
  profileId: ProfileId;
  db: Database;
  bus: ProfileMessageBus;
}

class ChatStateStore {
  constructor(private deps: ChatStateStoreDeps) {}
  
  load(publicKeyHex: PublicKeyHex) {
    return this.deps.db.get(`chat-${this.deps.profileId}-${publicKeyHex}`);
  }
}
```

### The Container
```typescript
// apps/pwa/app/container.ts
export function createAppContainer(params: {
  profileId: ProfileId;
}): AppContainer {
  const bus = createProfileMessageBus({ profileId: params.profileId });
  const db = createScopedDatabase({ profileId: params.profileId });
  
  return {
    chatStateStore: new ChatStateStore({ 
      profileId: params.profileId, 
      db, 
      bus 
    }),
    groupProvider: new GroupProvider({
      profileId: params.profileId,
      bus,
      chatStateStore: /* from above */
    }),
    // ... all services with explicit dependencies
  };
}

// React Provider
function AppProviders({ children, profileId }: { children: React.ReactNode; profileId: ProfileId }) {
  const container = useMemo(() => createAppContainer({ profileId }), [profileId]);
  
  return (
    <ContainerProvider value={container}>
      <ProfileContext.Provider value={profileId}>
        {children}
      </ProfileContext.Provider>
    </ContainerProvider>
  );
}
```

---

## Phase 5: Relay-First Membership (Week 6)

### The Problem
Membership sync relies on fragile DMs.

### The Solution
```typescript
// packages/core/src/community/membership-sync.ts
export interface MembershipSync {
  // Subscribe to NIP-29 events from relay
  subscribe(params: {
    groupId: string;
    relayUrl: string;
    onJoin: (member: PublicKeyHex, event: NostrEvent) => void;
    onLeave: (member: PublicKeyHex, event: NostrEvent) => void;
  }): Subscription;
  
  // Gossip sync for consistency
  gossipSync(params: {
    groupId: string;
    relayUrl: string;
    since?: number;
  }): Promise<MembershipSnapshot>;
}

// Implementation: No DM dependency
export function createMembershipSync(deps: {
  relayPool: RelayPool;
  bus: ProfileMessageBus;
}): MembershipSync {
  return {
    subscribe: ({ groupId, relayUrl, onJoin, onLeave }) => {
      return deps.relayPool.subscribe({
        kinds: [39001, 39002], // Join/Leave
        "#h": [groupId],
      }, (event) => {
        if (event.kind === 39001) {
          onJoin(event.pubkey as PublicKeyHex, event);
          deps.bus.publish({
            type: "member-joined",
            groupId,
            memberPubkey: event.pubkey
          });
        }
      });
    },
    gossipSync: async ({ groupId, relayUrl, since }) => {
      // Query relay for membership events
      // Reconstruct membership from event log
    }
  };
}
```

---

## Phase 6: Test-First Architecture (Ongoing)

### Single-Process A/B Test
```typescript
// packages/core/src/community/membership-sync.test.ts
describe("MembershipSync - Single Process A/B", () => {
  it("A creates group, B joins, A sees B without DMs", async () => {
    // Setup: Two profiles in one process
    const profileA = createTestProfile({ id: "a", publicKey: "pk-a" });
    const profileB = createTestProfile({ id: "b", publicKey: "pk-b" });
    
    // A creates community
    const containerA = createAppContainer({ profileId: profileA.id });
    const community = await containerA.communityService.create({
      name: "Test Community"
    });
    
    // B joins via relay (not DM)
    const containerB = createAppContainer({ profileId: profileB.id });
    await containerB.membershipSync.join(community.id);
    
    // A receives join event from relay (not DM)
    await waitForRelayGossip();
    
    // Verify A sees B as member
    const members = await containerA.communityService.getMembers(community.id);
    expect(members).toContain(profileB.publicKey);
  });
});
```

---

## Migration Priority

### Week 1: Kill `getActiveProfileIdSafe()`
- [ ] Add ESLint rule to block import
- [ ] Migrate `chat-state-store.ts` (18 usages)
- [ ] Migrate `group-provider.tsx` (7 usages)
- [ ] Migrate `messaging-provider.tsx` (12 usages)
- [ ] Delete the function

### Week 2: Kill Global Events
- [ ] Create `ProfileMessageBus`
- [ ] Replace `window.dispatchEvent` with bus.publish
- [ ] Replace `window.addEventListener` with bus.subscribe
- [ ] Add regression test: A's events don't reach B

### Week 3: Extract Core Domain
- [ ] Create packages/core package (future split; today use **packages/dweb-core**)
- [ ] Move types, validation, pure functions
- [ ] Zero dependencies verified by ESLint

### Week 4: Extract Runtime
- [ ] Create packages/runtime package (future split; bus lives in **packages/dweb-core** today)
- [ ] Move storage, relay, crypto
- [ ] Depends only on core

### Week 5: Dependency Injection
- [ ] Create `AppContainer`
- [ ] Migrate all services to DI
- [ ] Single-process tests pass

### Week 6: Relay-First Membership
- [ ] Implement `MembershipSync`
- [ ] Subscribe to NIP-29 events
- [ ] Remove DM-based membership updates
- [ ] A/B tests pass without DMs

---

## Success Criteria

- [ ] `grep -r "getActiveProfileIdSafe" apps/pwa` returns 0 results
- [ ] `grep -r "window.dispatchEvent.*obscur:" apps/pwa` returns 0 results
- [ ] `grep -r "globalThis\[" apps/pwa` returns 0 results
- [ ] Single-process A/B tests pass consistently
- [ ] No cyclic imports between packages
- [ ] Community membership syncs via relay in < 5 seconds
- [ ] Restart test: membership survives dev server restart

---

## Why This Will Work

1. **Explicit dependencies** = Testable, no hidden state
2. **Profile-scoped bus** = Single-process A/B works
3. **Package boundaries** = Enforced by ESLint, not convention
4. **Relay-first sync** = Eventually consistent, no DM fragility
5. **Dependency injection** = Swap implementations for testing

## Why Piecemeal Fixes Failed

- Adding more checks to `getActiveProfileIdSafe()` doesn't fix the fundamental problem: **implicit context**
- Adding more event detail fields doesn't fix: **global event namespace**
- Adding more logging doesn't fix: **wrong architectural abstraction**

## The New Abstraction

**Before**: "Get the current profile"
**After**: "Receive profileId as explicit parameter"

**Before**: "Emit global event"
**After**: "Publish to profile-scoped bus"

**Before**: "DM for membership updates"
**After**: "NIP-29 gossip for membership truth"

This is radical. This is correct. This will work.
