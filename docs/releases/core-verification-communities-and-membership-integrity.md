# Core Verification: Communities and Membership Integrity

_Last reviewed: 2026-04-18 (baseline commit a3f16b10)._

This packet covers Lane 6 from:

1. `docs/trust/20-core-function-verification-matrix.md`

The goal is to prove that community membership, roster visibility, join/leave
truth, and cross-device restore all converge on signed evidence rather than
weak local drift.

## Scope

This lane verifies:

1. community create / invite / join visibility,
2. joined membership recovery after restore and replay,
3. sealed-community roster and leave/disband convergence,
4. provider hydration and profile/account scope isolation for communities,
5. canonical recovery from membership ledger, tombstones, and persisted group
   evidence,
6. avoidance of phantom communities created from weak or stale local data.

## Canonical Owners

1. `apps/pwa/app/features/groups/providers/group-provider.tsx`
2. `apps/pwa/app/features/groups/services/community-membership-recovery.ts`
3. `apps/pwa/app/features/groups/services/community-membership-reconstruction.ts`
4. `apps/pwa/app/features/groups/services/community-ledger-reducer.ts`
5. `apps/pwa/app/features/groups/hooks/use-sealed-community.ts`
6. `apps/pwa/app/features/groups/services/community-membership-ledger.ts`
7. `apps/pwa/app/features/groups/services/group-tombstone-store.ts`

Reference incidents and guardrails:

1. `docs/16-cross-device-group-visibility-incident.md`
2. `docs/18-account-scope-and-discovery-guardrails.md`

## Required Invariants

1. Joined communities must restore on the correct account/profile scope and
   must not disappear simply because ledger hydration arrives later than local
   persisted group state.
2. Membership recovery precedence must remain:
   - tombstone,
   - membership ledger,
   - persisted chat/group fallback.
3. A left or tombstoned community must not remain visible from stale persisted
   rows alone.
4. A community must not be fabricated from weak local evidence that lacks a
   legitimate recovery path or canonical identity.
5. Relay-scoped leave/disband/member-roster evidence must converge to the same
   membership truth even when replay order differs between devices.
6. UI recovery must route through the canonical preview/join/community owner
   path and must remain diagnosable when restore or roster replay is delayed.

## Automated Verification Set

Run:

```bash
pnpm -C apps/pwa exec vitest run app/features/groups/services/community-membership-recovery.test.ts app/features/groups/services/community-membership-ledger.test.ts app/features/groups/services/community-ledger-reducer.test.ts app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx app/features/groups/hooks/use-sealed-community.integration.test.ts app/features/groups/hooks/use-sealed-community.merge.test.ts app/features/groups/hooks/use-sealed-community.security.test.ts
pnpm -C apps/pwa exec tsc --noEmit --pretty false
pnpm docs:check
```

Expected focus:

1. `community-membership-recovery.test.ts`
   - precedence lock,
   - tombstone suppression,
   - joined-ledger hydration,
   - placeholder metadata recovery,
   - duplicate persisted-row merge behavior.
2. `group-provider.cross-device-membership.integration.test.tsx`
   - fresh-device membership reconstruction,
   - delayed restore refresh,
   - history-only reconstruction,
   - profile-scope isolation before rebind.
3. `use-sealed-community.integration.test.ts`
   - leave/disband/member-roster replay convergence,
   - scoped relay filtering,
   - delete replay suppression,
   - terminal-state behavior after disband.
4. `community-ledger-reducer.test.ts` and
   `community-membership-ledger.test.ts`
   - signed membership status transitions,
   - local joined/left durability,
   - replay ordering resilience.

## Manual Replay Set

Run with at least two accounts (`A`, `B`) and a fresh device/window:

1. `A` creates a community and confirms canonical visibility.
2. `A` invites `B`; `B` joins through the intended join/recovery path.
3. Exchange community messages so membership and roster evidence are not
   message-empty.
4. Log `B` into a fresh device/window and allow restore plus relay catch-up.
5. Verify:
   - the joined community reappears,
   - it does not flicker from present to absent,
   - the member list includes expected members,
   - the canonical community route still opens correctly.
6. Perform a member leave flow and verify roster convergence across both
   windows.
7. If disband/removal is supported in the scenario, verify a disbanded
   community is removed once and does not resurrect through stale replay.

## Evidence To Capture

Primary probes:

1. `window.obscurAppEvents.findByName("groups.membership_recovery_hydrate", 30)`
2. `window.obscurAppEvents.findByName("messaging.chat_state_groups_update", 30)`
3. `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.membershipSendability`

Supplement with:

```js
window.obscurWindowRuntime?.getSnapshot?.()
```

Capture:

1. community id / group id / relay scope,
2. whether the group list hydrated from ledger, persisted fallback, or delayed
   restore,
3. whether any community disappeared after initially appearing,
4. member roster before and after leave/disband replay,
5. whether a phantom or stale group was shown without real joined evidence.

## Pass Criteria

This lane passes only if:

1. automated suites are green,
2. joined communities restore on a fresh device without phantom loss,
3. leave/disband/member-roster truth converges across replay order differences,
4. profile/account scope isolation prevents cross-scope community leakage,
5. runtime replay confirms that visibility comes from canonical recovery owners
   rather than stale local drift.
