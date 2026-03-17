# 10 Community and Groups Overhaul Roadmap

_Last reviewed: 2026-03-17 (baseline commit 0e19909)._

This roadmap restores the missing community plan with a strict v0.9.1+ focus:
- no tag churn for CI-only patch loops,
- one major user-facing upgrade before v1,
- security and UX upgraded together.

## Product Direction

Primary major-upgrade lane before v1:
- **Community/Groups overhaul** as the default flagship.

Secondary/stretch lane:
- Voice communication pilot only after community ownership and moderation flows are stable.

Reason:
- group/community surface already exists and is closer to production than voice stack,
- several community actions are still partially implemented and can unlock large UX gains quickly.

## Canonical Owners (Community Path)

1. Network identity/trust/request owner
: `apps/pwa/app/features/network/providers/network-provider.tsx`

2. Group lifecycle/persistence owner
: `apps/pwa/app/features/groups/providers/group-provider.tsx`

3. Community runtime owner (sealed event ingest/publish)
: `apps/pwa/app/features/groups/hooks/use-sealed-community.ts`

4. Membership truth reducer
: `apps/pwa/app/features/groups/services/community-ledger-reducer.ts`

5. Group event constructor/signing service
: `apps/pwa/app/features/groups/services/group-service.ts`

No parallel owner should be introduced for the same lifecycle.

## Current State (Reality Snapshot)

What is already strong:
- relay-scoped group publish path exists,
- sealed community message flow exists (`kind 10105`),
- room-key rotation and distribution exist,
- membership ledger reducer exists,
- group tombstone and migration guardrails exist.

Gaps blocking “excellent” community UX:
- moderation/admin action handlers are still placeholders in `use-sealed-community.ts`,
- membership/admin role semantics are too minimal (`member`/`guest`),
- group discovery, join queue, and moderation queue UX are fragmented,
- diagnostics are present but not yet exposed as operator-friendly community health views.

## Competitive Bar (Telegram/Discord-Inspired, Not Cloned)

We should match the outcome quality of mainstream community products in these areas:
- fast onboarding into a niche community,
- predictable moderation outcomes,
- trustworthy role/permission boundaries,
- clear delivery/readiness status under weak network conditions,
- polished interaction flows (join, invite, leave, recover).

Must remain Obscur-specific:
- evidence-based state transitions,
- strict E2EE-by-default for group content,
- deterministic fallback behavior (no silent optimistic success).

## Phase Plan

### Phase C1: Security and Ownership Completion

Objective:
- eliminate placeholder actions and complete canonical group owner behavior.

Scope:
- implement non-noop versions of:
  - `updateMetadata`
  - `setGroupStatus`
  - `approveJoin` / `denyJoin`
  - `putUser` / `removeUser`
  - `promoteUser` / `demoteUser`
- make all moderation outcomes evidence-backed and relay-scoped,
- ensure membership reducer remains the single truth for effective status.

Exit criteria:
- no placeholder moderation/admin paths in community runtime,
- deterministic tests for success/failure classes (denied, cooldown, scoped relay mismatch, timeout).

### Phase C2: Community UX Rebuild

Objective:
- improve “small community operator” workflow quality.

Scope:
- unified community dashboard:
  - members, pending joins, moderation actions, relay scope health,
- better create/join/invite flows:
  - less modal churn, clearer state explanations, safer defaults,
- structured group metadata UX:
  - purpose/about/access clearly visible and editable with audit-friendly hints.

Exit criteria:
- first-time join/create flow is understandable in one pass,
- operator can approve/deny/remove members without ambiguous outcomes.

### Phase C3: Trust, Safety, and Abuse Resistance

Objective:
- protect niche communities without destroying usability.

Scope:
- expand role model and policy checks (owner/mod/member/guest as needed),
- stronger anti-spam/join-request throttling and abuse telemetry surfaces,
- clear user-facing reason codes for blocked or denied actions.

Exit criteria:
- moderation behavior is transparent and reproducible,
- abuse events surface meaningful diagnostics for maintainers.

### Phase C4 (Optional Stretch): Voice Pilot

Objective:
- evaluate one major synchronous feature after community core stability.

Scope:
- small-group encrypted voice room pilot (invite-only communities first),
- strict capability detection and explicit unsupported paths for web/native parity.

Exit criteria:
- prototype quality acceptable for staged rollout decision (ship/hold).

## v0.9.1 Execution Rules

1. No release-tag churn while fixing CI.
2. Use workflow dispatch / rehearsal runs before release tags.
3. Keep community feature lane and CI hardening lane separate in commits/changelogs.
4. Mark version tags only when product-value milestones (not just build fixes) are complete.

## Testing and Gate Strategy (Community Lane)

Minimum per increment:
- unit tests for community reducer and policy logic,
- focused integration tests for sealed event ingest/publish and moderation outcomes,
- docs update for owner/path changes.

Required gates before merge to release branch:
- `pnpm -C apps/pwa exec vitest run` (targeted + touched suites),
- `pnpm ci:scan:pwa:head`,
- `pnpm release:test-pack -- --skip-preflight`,
- `pnpm docs:check`,
- Android fast-fail Kotlin compile gate in CI must pass.

## First Concrete Sprint (Recommended Next)

1. Replace all moderation/admin `noop` handlers in `use-sealed-community.ts`.
2. Add explicit role and join-policy contract tests.
3. Add a compact moderation queue panel in the community UI.
4. Add user-visible result states for moderation actions (accepted/denied/retryable).
5. Update docs and ship as the first v0.9.1 community milestone.

