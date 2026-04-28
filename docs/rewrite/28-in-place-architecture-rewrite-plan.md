# 28 In-Place Architecture Rewrite Plan

_Last reviewed: 2026-04-19 (baseline commit a3f16b10)._

_Status: active recovery direction_
_Scope: rewrite architecture in place without restarting the MVP or disabling core features_

## Why This Exists

User-visible progress is currently unacceptable even when narrow fixes land.

The same failure class keeps resurfacing in different forms:

1. fresh-window or fresh-device login restores only part of DM history,
2. community membership/status converges incompletely or late,
3. local restore, relay replay, provider hydration, and UI fallbacks each try to "help",
4. those overlapping owners thin or overwrite each other instead of converging.

The project is not a mainstream centralized social app. It is:

1. decentralized,
2. local-first,
3. multi-layer encrypted,
4. relay-mediated but not relay-authoritative.

That means patching symptoms in the UI layer is structurally insufficient.

## Non-Negotiables

This rewrite direction does **not** mean:

1. restarting the MVP,
2. disabling core features,
3. abandoning communities, DM restore, or multi-device behavior,
4. replacing the product with a smaller "safe" demo.

This rewrite direction **does** mean:

1. preserving the existing product surfaces while replacing fragile owners underneath,
2. migrating lane by lane behind compatibility adapters,
3. deleting compatibility paths only after canonical owners are proven,
4. using runtime truth and two-user replay as the acceptance bar.

## Escalation Rule

If a fragile lane has spent repeated iterations reintroducing the same failure
class, treat that lane as unsalvageable at the module level.

In that case, the correct action is not another local patch.

It is:

1. freeze new feature work in that lane,
2. mark the current owner as replacement-only,
3. delete the failing owner module once a bounded replacement shell exists,
4. rebuild the owner from contracts upward,
5. keep only the minimum compatibility adapter needed to preserve the product
   surface during migration.

This is a destructive-overhaul allowance, not an implementation accident.

It is required because repeated patching in overlapping owner lanes has already
proven to be more expensive than replacement.

## Root Problem

Current failure modes come from split ownership across four layers:

1. backup restore writes direct chat-state domains,
2. canonical account-event append tries to reconstruct truth in parallel,
3. provider hydration reconstructs local projections again,
4. page-level/community-level hooks add more fallback assembly.

This creates drift in exactly the most fragile paths:

1. DM history restore,
2. community membership roster recovery,
3. new-window/new-device login convergence,
4. live membership/status updates.

## Canonical End State

### A. One Restore Import Owner

Encrypted backup restore and relay replay must feed one canonical import pipeline.

That owner should:

1. parse incoming restore payloads,
2. materialize canonical account events and community membership evidence,
3. update projection stores,
4. emit diagnostics when imported state becomes thinner later.

Direct chat-state restore remains compatibility-only and temporary.

### B. One DM Read Authority

DM UI should converge on one canonical read model.

That owner should:

1. expose conversation list truth,
2. expose timeline truth,
3. preserve restore history before live relay replay finishes,
4. prevent canonical append or provider hydration from thinning restored history.

### C. One Community Membership Projection

Community UI must read from one projection owner, not mixed provider/page heuristics.

That owner should derive:

1. joined/left/expelled/disbanded state,
2. active member roster,
3. known member evidence,
4. sendability state,
5. restore diagnostics.

Inputs may include:

1. explicit community control events,
2. ledger entries,
3. DM invite/accept evidence,
4. scoped relay roster events,
5. room-key evidence.

But the UI should consume one projection result.

### D. Transport Is Evidence, Not UI Truth

Relay and DM/community transport should publish evidence into canonical owners.

UI components and route pages should not rebuild truth from raw transport data.

## Migration Strategy

### Phase 1: Stop Cross-Owner Drift

1. Remove page-level and provider-level duplicate writes where canonical owners already exist.
2. Keep diagnostics on every remaining compatibility bridge.
3. Preserve features and routes as-is.

### Phase 2: Promote Canonical Import/Projection

1. Route backup restore into canonical account-event + community-membership import first.
2. Build projection stores that are rich enough for DM and community UI.
3. Let existing UI read from those projections through adapters.

### Phase 3: Flip Read Owners

1. Move messaging-provider to canonical conversation/timeline authority.
2. Move group-provider/community pages to canonical membership projection authority.
3. Keep compatibility fallbacks only for explicitly named gaps.

### Phase 4: Remove Compatibility Paths

1. Delete direct restore bridges that are no longer needed.
2. Delete page-level fallback reconstruction.
3. Keep only diagnostics surfaces and narrow migration shims.

## Destructive Replacement Policy

The rewrite should no longer assume every failing owner can be incrementally
salvaged.

For the highest-risk planes:

1. restore/import,
2. DM read authority,
3. community membership projection,
4. startup/session ownership,

the project may replace owner modules wholesale when all of the following are
true:

1. the same regression class has reappeared across multiple iterations,
2. compatibility bridges are now masking rather than solving the issue,
3. runtime truth remains thinner than the previous known-good behavior,
4. a future owner contract is already documented.

When that threshold is crossed, success means:

1. preserving the user-facing route or workflow,
2. deleting or quarantining the old owner,
3. rebuilding one owner path from scratch,
4. refusing to reintroduce fallback truth in the new owner.

## Immediate Rewrite Slice

The next structural slice should target the shared root of the current failures:

1. User B new-window restore loses DM history,
2. User B community roster degrades to self-only,
3. accepted invite cards remain as the only visible membership evidence.

Immediate implementation target:

1. make restore import produce one canonical packet for:
   DM conversation history,
   DM conversation list/sidebar state,
   community membership ledger/projection evidence,
   room-key evidence.
2. make group-provider recovery consume canonical reconstructed community evidence instead of page-local heuristics,
3. make messaging-provider preserve canonical restored DM history until projection/live replay reaches parity.

## Acceptance Criteria

The rewrite is only helping if the following become true in runtime:

1. User B logs in on a new window/device and sees the same DM history immediately, not a thinner thread.
2. User B opens a joined community and sees the other member without reopening or waiting for a later event.
3. Join/leave status changes propagate in real time and survive restore.
4. Invite response cards are not the only surviving proof of community state after restore.

## Guardrails

Do not:

1. restart the product surface,
2. disable communities or restore features to reduce complexity,
3. add another UI-layer compatibility bridge for missing canonical state,
4. claim progress from green tests alone if runtime UX is still thinner.

Do:

1. preserve routes, flows, and MVP scope,
2. rewrite underneath the live product,
3. leave behind diagnostics, typed contracts, and owner boundaries,
4. measure success by restored user-visible continuity.
