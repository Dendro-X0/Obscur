# 10 Community and Groups Operating Model

_Last reviewed: 2026-03-29 (baseline commit cad5779e)._

This document is the canonical, version-agnostic operating contract for Obscur communities/groups.

Historical version-by-version milestone details are maintained in:
- `docs/11-program-milestones-and-stability-history.md`
- `docs/history/version-context.md`

## Current Health Snapshot

- Community create/join/leave/recover flows are stable in current baseline.
- Membership visibility uses deterministic recovery precedence and is no longer driven by optimistic local snapshots.
- Group messaging send permission remains evidence-gated by membership plus room-key availability.
- No severe open community blocker is currently recorded; monitor with diagnostics listed below.

## Canonical Owners (Locked)

1. Network identity and trust owner
: `apps/pwa/app/features/network/providers/network-provider.tsx`

2. Group lifecycle and persistence owner
: `apps/pwa/app/features/groups/providers/group-provider.tsx`

3. Community runtime owner (sealed event ingest/publish)
: `apps/pwa/app/features/groups/hooks/use-sealed-community.ts`

4. Membership truth reducer owner
: `apps/pwa/app/features/groups/services/community-ledger-reducer.ts`

5. Group event construction/signing owner
: `apps/pwa/app/features/groups/services/group-service.ts`

Rule: do not introduce a second mutation owner for any lifecycle above.

## Governance Contract

- Communities are decentralized and adminless.
- Moderation actions are member-governed and evidence-backed.
- Removal decisions and metadata-sensitive actions must resolve from signed governance events and reducer outcomes, never from optimistic UI state.
- Local safety actions (mute/hide) remain local-only and do not redefine global membership truth.

## Data Truth and Recovery Model

Community state recovery precedence is fixed:
1. Tombstones
2. Membership ledger
3. Persisted chat-state fallback

Additional invariants:
- Explicit non-joined ledger states (`left`, `expelled`) suppress fallback visibility.
- Missing ledger coverage can be supplemented by reconstruction evidence (chat/invite history) without overriding explicit ledger status.
- Room keys and membership are separate domains; both must converge for send-capable state.

## Startup and Restore Contract

- Profile/account scope is resolved before group-scoped state services mount.
- Membership and room-key restore are applied as evidence domains; timeout-only signals cannot mark convergence complete.
- Restore paths must emit diagnostics at merge and apply boundaries.

## Send Eligibility Contract

A community send is allowed only when all are true:
1. Membership evidence resolves to joined.
2. Target group record is present in canonical group state.
3. Room key for target group is available on the active device.

When blocked, runtime must emit deterministic diagnostics (not implicit "kicked" inference).

## UX and Product Expectations

Core UX outcomes to preserve:
- predictable join/invite/leave behavior across device changes,
- stable group identity (name/avatar/membership) under replay and restore,
- explicit user-facing states for pending, accepted, denied, timed out, and blocked actions,
- no silent downgrade from group-intent navigation into DM routing.

## Required Diagnostics

Monitor these events for regression triage:
- `groups.membership_recovery_hydrate`
- `messaging.chat_state_groups_update`
- `groups.room_key_missing_send_blocked`
- `account_sync.backup_restore_merge_diagnostics`
- `account_sync.backup_restore_apply_diagnostics`

## Validation Gates

Minimum per community change set:
1. Targeted unit tests for reducer/policy changes.
2. Focused integration coverage for two-user and cross-device membership/recovery behavior.
3. `pnpm docs:check` after architectural or contract changes.
4. Typecheck/test packs required by CI lane for touched modules.

## Active Workstreams (General)

1. Governance completion and moderation ergonomics.
2. Cross-device recovery hardening under relay lag and partial snapshots.
3. Community UX quality for creation, operation, and diagnostics visibility.
4. Trust and abuse-resistance capabilities that remain privacy-preserving.

Use `docs/roadmap/current-roadmap.md` for current slices and release sequencing.
