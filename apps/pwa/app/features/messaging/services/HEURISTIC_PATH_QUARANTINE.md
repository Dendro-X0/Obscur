# Heuristic Path Quarantine Registry

This document tracks:
1. Competing truth paths that violate AGENTS.md Rule 1 (One owner per lifecycle/state/transport path)
2. Bug fixes that required relaxing strict guards due to relay timing realities

## Status: Active Quarantine (v1.4.0 M1)

---

## Bug Fix Entry: Member List Refresh Reverts to Single Member

**Status**: **FIXED & INTEGRATED** ✅ (2026-04-24)

**Bug Report**: Community page member list reverts to displaying only the first member (creator) after page refresh. Related to relay connection latency.

**Root Cause**: The `resolveCommunityMemberSnapshotApplication` thinner-snapshot guard was rejecting valid incoming member lists during relay warm-up. When the page refreshed, the relay returned partial evidence first (often just creator), and the guard interpreted missing members as "removed without evidence".

**Fix Applied**:
- Created `community-relay-evidence-policy.ts` - Tracks relay subscription state and evidence confidence levels (`seed_only` → `warming_up` → `partial_eose` → `steady_state`)
- Created `community-member-snapshot-policy.ts` - Enhanced snapshot application that relaxes the thinner-snapshot guard when confidence is low (seed_only or warming_up with ≤2 members)
- Guard now allows thinner snapshots to replace seed data during warm-up, but enforces strict evidence requirements once relay reaches steady state

**Files Created**:
- `community-relay-evidence-policy.ts` + `.test.ts`
- `community-member-snapshot-policy.ts`

**Integration Complete** ✅:
- `group-provider.tsx` now uses `resolveEnhancedSnapshotApplication` with relay evidence tracking
- `relayEvidenceByGroupIdRef` tracks subscription timing and event counts
- Enhanced diagnostics include `confidence`, `guardRelaxed`, and `policyReasonCode` fields
- When confidence is `seed_only` or `warming_up` with ≤2 current members, thinner snapshots are allowed to replace seed data

**How It Works**:
1. On page refresh, relay evidence starts as `seed_only` (no subscription established)
2. When first snapshot arrives from relay, evidence transitions to `warming_up`
3. If current members ≤ 2 (typical seed state), the thinner-snapshot guard is relaxed
4. Incoming member list (even if partial) replaces the seed-only data
5. As more events arrive, confidence moves to `partial_eose` or `steady_state`
6. Once steady state is reached, strict evidence requirements are enforced again

---

## Bug Fix Entry: Online Status Not Syncing (Presence Subscription Race)

**Status**: **DIAGNOSED** 🔍 (2026-04-24)

**Bug Report**: User A's interface fails to update User B's online status in real time; User B (who logged in later) correctly shows User A as online.

**Root Cause**: The `useRealtimePresence` hook has a **stale closure race condition** in its subscription effect dependency array. Both `subscribedAuthorsKey` AND `subscribedAuthorsFromKey` are in the dependency array (lines 208-209 of `use-realtime-presence.ts`). When `subscribedAuthorsKey` changes due to peer list updates, `subscribedAuthorsFromKey` still holds the OLD value because `useMemo` hasn't updated yet during that render cycle.

This causes:
1. User A loads app with no peers → `subscribedAuthorsFromKey = []`
2. User B added to accepted peers → `subscribedAuthorsKey` changes
3. Effect runs BUT `subscribedAuthorsFromKey` is still `[]` (stale value)
4. Line 153 early return: `if (subscribedAuthorsFromKey.length === 0) return;` → subscription not created
5. User A never subscribes to User B's presence events → User B shows as offline

**Fix Applied**:
- Created `presence-subscription-race-fix.ts` - Pure function `computePresenceSubscriptionState` that derives subscription state directly from params, avoiding stale closure issues
- `computePresenceFilter` creates the Nostr filter with proper authors list
- `logPresenceSubscriptionEvent` adds diagnostics to browser console

**Files Created**:
- `presence-subscription-race-fix.ts`

**Integration Required**:
- `use-realtime-presence.ts` should use `computePresenceSubscriptionState` instead of the memo chain
- Remove the stale dependency array issue by computing state fresh in the effect
- Add `logPresenceSubscriptionEvent` calls to track subscription lifecycle

**How It Should Work**:
1. User A loads app
2. User B joins (via request/invite/community membership)
3. `acceptedPeers` updates to include User B
4. Subscription effect re-runs with fresh `computePresenceSubscriptionState()` call
5. New subscription created with User B's pubkey in authors filter
6. User A receives User B's presence heartbeat events
7. User B shows as ONLINE on User A's interface

---

## Quarantine Entry 1: conversation-history-authority.ts

**Location**: `apps/pwa/app/features/messaging/services/conversation-history-authority.ts`

**Status**: Migration Bridge Created ✅

**Violation**: Competing authority resolution between projection, indexed, and persisted sources.

**Current Behavior**:
- Returns `"projection" | "indexed" | "persisted"` as authority sources
- Complex fallback logic for "persisted recovery" scenarios
- `isPersistedCompatibilityRestorePhaseIncomingRepairCandidate()` function provides heuristic repair paths

**Canonical Owner**: Account Projection (via `dm-read-authority-contract.ts`)

**Remediation Plan**:
1. [x] Mark `conversation-history-authority.ts` as deprecated in JSDoc ✅
2. [x] Add deprecation warning emission on first use ✅
3. [x] Create `dm-read-authority-migration-bridge.ts` for gradual migration ✅
4. [ ] Migrate `use-conversation-messages.ts` to use `dm-read-authority-contract.ts`
5. [ ] Remove `isPersistedCompatibilityRestorePhaseIncomingRepairCandidate()` logic
6. [ ] Delete file after all call sites migrated (v1.5.0+)

**Call Sites to Migrate**:
- `use-conversation-messages.ts` (line 28-30 imports)
- `use-conversation-messages.ts` (line 869-881 usage)

---

## Quarantine Entry 2: Legacy Chat State Heuristics in use-conversation-messages.ts

**Location**: `apps/pwa/app/features/messaging/hooks/use-conversation-messages.ts`

**Violation**: Multiple competing message resolution paths in single hook.

**Current Behavior**:
- Lines 28-30: Imports from `conversation-history-authority`
- Lines 1100+: `resolveConversationHistoryAuthority()` usage with complex fallback logic
- `legacyChatStateHasRicherDmContent` heuristic bypasses projection

**Remediation Plan**:
1. [ ] Extract legacy fallback logic to dedicated compatibility hook
2. [ ] Add explicit `useDmReadAuthority()` hook using new contract
3. [ ] Emit diagnostics whenever legacy path is activated
4. [ ] Remove after projection cutover complete

---

## Quarantine Entry 3: messaging-provider.tsx Legacy Persistence

**Location**: `apps/pwa/app/features/messaging/providers/messaging-provider.tsx`

**Violation**: Competing persistence layer that can override projection state.

**Current Behavior**:
- Lines 47-58: `hasMeaningfulMessagingState()` heuristic
- Lines 300-400: LocalStorage persistence competing with projection
- `chatStateStoreService` local updates without projection coordination

**Remediation Plan**:
1. [ ] Mark localStorage persistence as "read-only compatibility" mode
2. [ ] Block writes to `chatStateStoreService` when projection is active
3. [ ] Emit diagnostics on every localStorage write attempt
4. [ ] Remove write paths after cutover (v1.5.0+)

---

## Migration Priority

| Entry | Risk Level | Effort | Target Completion |
|-------|------------|--------|-------------------|
| conversation-history-authority.ts | High | Medium | v1.4.0 M3 |
| use-conversation-messages.ts heuristics | High | High | v1.4.0 M3 |
| messaging-provider.tsx persistence | Medium | Medium | v1.5.0 |

---

## Diagnostics Requirements

Whenever a quarantined path is activated, the following must be emitted:

```typescript
logAppEvent({
  category: "messaging",
  event: "quarantined_path_activated",
  level: "warn",
  details: {
    quarantineEntry: "conversation-history-authority",
    reason: "fallback_to_indexed",
    conversationId,
    canonicalMessageCount: projectionMessages.length,
    fallbackMessageCount: indexedMessages.length,
  },
});
```

---

## Definition of Done

- [ ] All quarantined paths emit diagnostics on activation
- [ ] No silent fallbacks from projection to legacy
- [ ] `dm-read-authority-contract.ts` is sole authority resolver
- [ ] Heuristic files marked with `@deprecated` JSDoc
- [ ] Migration tracked in CHANGELOG.md

---

*Last Updated: 2026-04-24*
*Owner: v1.4.0 Rewrite Team*
*Status: In Progress*
