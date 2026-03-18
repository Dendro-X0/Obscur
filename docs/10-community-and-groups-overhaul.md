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

## Governance Model Lock (v0.9.1)

- Communities are decentralized and adminless: there is no privileged administrator role.
- All participants are members under the same governance contract.
- User-level safety remains local-first: members can mute each other in their own client.
- Removal of a member is vote-based and must reach configured quorum before expulsion is applied.
- Community avatar changes are also vote-based and should resolve through signed governance events.
- Governance truth must come from sealed event ingest + ledger reduction, not local optimistic state.

## Current State (Reality Snapshot)

Current functional coverage:
- create/join/leave community flows,
- invite members via room-key distribution,
- sealed community timeline ingest/publish (`kind 10105` path),
- local mute controls,
- vote-to-kick flow scaffolding,
- metadata updates with relay-scoped publish.

Current technology map:
- community runtime/state owner: `use-sealed-community.ts`,
- persistence/projection owner: `group-provider.tsx`,
- canonical membership/governance reducer: `community-ledger-reducer.ts`,
- event construction/signing: `group-service.ts`,
- relay transport layer: enhanced relay pool and scoped publish paths.

What is already strong:
- relay-scoped group publish path exists,
- sealed community message flow exists (`kind 10105`),
- room-key rotation and distribution exist,
- membership ledger reducer exists,
- group tombstone and migration guardrails exist.

Gaps blocking "excellent" community UX:
- several governance handlers are still placeholders in `use-sealed-community.ts`,
- vote lifecycle UX (propose, tally, resolve) is fragmented across surfaces,
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

### Phase A: Cross-Device Membership Sync Foundation (Landed)

Objective:
- keep community presence durable across logout/login and new-device restore.

Scope landed:
- added profile-scoped durable membership ledger:
  - `apps/pwa/app/features/groups/services/community-membership-ledger.ts`
- wired group lifecycle owner (`group-provider`) to:
  - persist `joined` on add/revive/update paths,
  - persist `left` on leave/remove paths,
  - hydrate groups from `chatState + joined-ledger` with tombstone filtering,
  - react to scoped ledger-update events so mounted views refresh immediately after restore.
- extended encrypted account backup payload to include optional community membership ledger snapshots and deterministic merge-on-restore behavior:
  - `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`
- hardened community navigation token resolution so explicit group tokens do not silently downgrade into DM routing:
  - `apps/pwa/app/features/messaging/utils/conversation-target.ts`
  - `apps/pwa/app/features/groups/utils/group-route-token.ts`
- hardened account-sync mutation signaling for cross-device durability:
  - startup flow now attempts encrypted backup restore before first startup backup publish, even on identity-only rehydrate status,
  - late account-sync subscribers now replay the latest private-state mutation signal,
  - membership-ledger writes emit `community_membership_changed` mutation signals,
  - `community_membership_changed` backup publishes bypass normal mutation cooldown to reduce logout-before-publish loss windows.

Behavior contract:
- community membership persistence is explicit and scoped per profile/account.
- backup payload remains `version: 1`; ledger field is optional for backward compatibility.
- ledger-only hydration keeps communities visible even when room keys are not yet present on that device.
- explicit group navigation tokens (`community:*`, `group:*`, or canonical encoded group ids) resolve group-only; unresolved group tokens do not fallback to DM.
- private-state mutation evidence should not be dropped due to account-sync subscription timing.
- community membership mutations should trigger immediate encrypted backup publish attempts.

### Phase B: Presence and Session Exclusivity Baseline (Landed)

Objective:
- add evidence-based contact presence and enforce one active account session per identity.

Scope landed:
- added relay-backed realtime presence contract:
  - `apps/pwa/app/features/network/services/realtime-presence.ts`
  - replaceable presence event (`kind 30315`, `d=obscur.presence.v1`) with heartbeat + stale timeout semantics.
- added runtime presence owner hook:
  - `apps/pwa/app/features/network/hooks/use-realtime-presence.ts`
  - subscribes to accepted peers + self, publishes online heartbeat, emits offline best-effort on teardown.
- wired canonical network owner to presence state + duplicate-session guard:
  - `apps/pwa/app/features/network/providers/network-provider.tsx`
  - when an older active self-session is observed, current runtime is deterministically locked.
- wired Network contact cards to actual online/offline status:
  - `apps/pwa/app/features/network/components/network-dashboard.tsx`
  - `apps/pwa/app/features/network/components/network-connection-card.tsx`
- added focused contract tests:
  - `apps/pwa/app/features/network/services/realtime-presence.test.ts`

Behavior contract:
- contact status is derived from relay evidence, not local optimistic UI state.
- online requires a fresh heartbeat; stale/missing heartbeat resolves to offline.
- single-login guard is deterministic:
  - if another active session for the same pubkey is older, current session locks,
  - tie timestamps are resolved by stable session-id ordering.

### Phase C1: Security and Ownership Completion

Objective:
- eliminate placeholder actions and complete canonical group owner behavior.

Scope:
- implement non-noop versions of:
  - `updateMetadata`
  - `setGroupStatus`
  - `approveJoin` / `denyJoin`
  - `putUser` / `removeUser`
  - vote-tally and resolution paths for `sendVoteKick`
  - vote-tally and resolution paths for community avatar updates
- make all moderation outcomes evidence-backed and relay-scoped,
- ensure membership reducer remains the single truth for effective status.

Exit criteria:
- no placeholder governance paths in community runtime,
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
- harden vote/policy checks for member-driven governance actions (kick + avatar updates),
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

## v0.9.2 Sync Continuation

After v0.9.1 push, continue with account data synchronization as top priority:
- cross-device community membership durability,
- canonical projection replay for DM + community surfaces,
- unread and navigation target consistency between DM and group conversations.

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

1. Replace all governance `noop` handlers in `use-sealed-community.ts`.
2. Add explicit vote contract tests (kick quorum + avatar-change quorum) and join-policy tests.
3. Add a compact governance queue panel in the community UI.
4. Add user-visible result states for governance actions (accepted/denied/retryable).
5. Update docs and ship as the first v0.9.1 community milestone.
