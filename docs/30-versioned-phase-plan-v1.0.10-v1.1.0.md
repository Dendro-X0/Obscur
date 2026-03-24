# 30 Versioned Phase Plan (v1.0.10-v1.1.0)

_Last reviewed: 2026-03-23 (baseline commit 4c869a7)._

This document starts the `M8` execution lane after `v1.0.9`:
1. `v1.0.10` carries `M8` `CP1` implementation slices,
2. `v1.0.11` carries `M8` `CP2` diagnostics and replay-helper slices,
3. `v1.1.0` closes `M8` with `CP3` evidence + `CP4` release gates.

Follow-on major-phase sequencing is defined in:
1. `docs/29-versioned-major-phase-plan-v1.0.10-v1.3.0.md`.

## Version-Milestone Mapping

1. `v1.0.10` -> `M8` `CP1`:
: community identity and membership/sendability convergence hardening.
2. `v1.0.11` -> `M8` `CP2`:
: diagnostics and replay tooling for lifecycle anomalies.
3. `v1.1.0` -> `M8` `CP3/CP4`:
: manual matrix evidence + strict release closeout.

## Checkpoint Policy

For each tag in this lane:
1. `CP1` implementation checkpoint:
: owner-safe, bounded feature slice with focused tests.
2. `CP2` diagnostics checkpoint:
: reason-coded app-event + digest/triage visibility.
3. `CP3` runtime evidence checkpoint:
: manual two-device replay evidence capture and attachment.
4. `CP4` release checkpoint:
: strict clean-tree preflight + tag publication.

## v1.0.10 - M8 CP1 (Current Start)

Goal:
1. begin community lifecycle completion work without introducing new owner overlap.

Scope:
1. harden canonical community identity convergence (name/member/admin/operator coverage),
2. improve deterministic membership/sendability reconciliation when room-key and ledger evidence diverge,
3. keep community info/manage flows on canonical owner contracts only.

Planned implementation boundaries:
1. canonical membership recovery owner:
: `apps/pwa/app/features/groups/services/community-membership-recovery.ts`.
2. canonical group sendability owner:
: `apps/pwa/app/features/groups/services/group-service.ts`.
3. provider-level reconciliation owner:
: `apps/pwa/app/features/groups/providers/group-provider.tsx`.

Required validation before closing `v1.0.10`:
1. focused `vitest` suites for touched group owners,
2. `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`,
3. docs consistency:
: `pnpm docs:check`.

Current checkpoint progress (2026-03-23):
1. CP1 convergence hardening landed in canonical group provider owner:
: `apps/pwa/app/features/groups/providers/group-provider.tsx`.
2. Group add/dedupe flows now merge duplicate community rows deterministically instead of first-write-wins:
: preserves richer display metadata/member/admin coverage while keeping canonical conversation identity.
3. Existing-group `addGroup` path now performs convergence merge and writes reconciled state:
: placeholder-name and stale membership regressions are no longer preserved when richer evidence arrives.
4. CP1 room-key sendability diagnostics hardening landed in canonical group send owner:
: `apps/pwa/app/features/groups/services/group-service.ts`.
5. Missing room-key send blocks now emit explicit joined-membership mismatch reason:
: `reasonCode: "target_room_key_missing_after_membership_joined"` when ledger shows joined membership but no matching local room key.
6. CP1 profile-scope convergence hardening landed for group hydration reads:
: `apps/pwa/app/features/messaging/services/chat-state-store.ts` now keys in-memory/pending chat-state entries by `profileId + publicKeyHex` and captures profile scope during debounced saves.
7. Group hydration now preserves fresh in-scope pending state while preventing cross-scope cache bleed:
: `apps/pwa/app/features/groups/providers/group-provider.tsx` stays on canonical store owner (`chatStateStoreService.load`) with scope-aware cache keys.
8. Cross-device profile-scope regression is now enforced as a normal passing test:
: `app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx` (`keeps group visibility isolated by profile scope before profile rebind`).
9. Focused chat-state owner coverage now validates profile-scoped cache/pending isolation:
: `app/features/messaging/services/chat-state-store.replace-event.test.ts`
: (`keeps chat-state cache and pending writes isolated per profile scope for the same public key`).
10. CP2-prep helper landed for one-copy community lifecycle evidence bundles:
: `window.obscurM8CommunityCapture.captureJson(400)` in
: `apps/pwa/app/shared/m8-community-capture.ts`,
: installed at boot in `apps/pwa/app/components/providers.tsx`.
11. Maintainer replay runbook now includes preferred M8 helper + readiness probe:
: `docs/08-maintainer-playbook.md`.
12. Focused CP1/CP2-prep regression coverage is green:
: `pnpm --dir apps/pwa exec vitest run app/shared/m8-community-capture.test.ts app/features/messaging/services/chat-state-store.replace-event.test.ts app/features/groups/services/community-membership-recovery.test.ts app/features/groups/services/group-service.test.ts app/features/groups/providers/group-provider.test.tsx app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
: `pnpm docs:check`.
: 
: CP2 deterministic replay bridge checkpoint progress (2026-03-23):
: 13. deterministic M8 replay bridge landed for account-switch convergence evidence:
: `window.obscurM8CommunityReplay?.runConvergenceReplay({ clearAppEvents: true })`
: and
: `copy(window.obscurM8CommunityReplay?.runConvergenceReplayCaptureJson({ clearAppEvents: true }))`,
: implementation in `apps/pwa/app/shared/m8-community-replay-bridge.ts`.
: 14. replay bridge is installed at boot in canonical providers owner:
: `apps/pwa/app/components/providers.tsx`.
: 15. focused replay-bridge coverage is green:
: `pnpm --dir apps/pwa exec vitest run app/shared/m8-community-replay-bridge.test.ts app/shared/m8-community-capture.test.ts app/features/messaging/services/chat-state-store.replace-event.test.ts app/features/groups/services/community-membership-recovery.test.ts app/features/groups/services/group-service.test.ts app/features/groups/providers/group-provider.test.tsx app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx`.
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
: `pnpm docs:check`.
: 16. deterministic CP3 evidence matrix is now documented:
: `docs/31-v1.0.10-cp3-community-replay-matrix.md`.
: 17. deterministic replay execution evidence was captured in operator run (2026-03-23):
: observed event chain includes
: `groups.membership_ledger_load`,
: `groups.membership_recovery_hydrate`,
: `messaging.chat_state_groups_update`,
: and `groups.room_key_missing_send_blocked`.
: 18. replay sendability anomaly signal matched expected joined-membership mismatch reason code:
: `target_room_key_missing_after_membership_joined`.
: 19. one-copy replay+capture export command executed for artifact handoff:
: `copy(window.obscurM8CommunityReplay?.runConvergenceReplayCaptureJson({ clearAppEvents: true }))`.
: 20. release-gate preflight replay is green in current checkpoint workspace:
: `pnpm version:check`
: `pnpm docs:check`
: `pnpm release:preflight -- --tag v1.0.10 --allow-dirty true`.
: 
: (Existing CP1 validation command remains green:)
: `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/chat-state-store.replace-event.test.ts app/features/groups/services/community-membership-recovery.test.ts app/features/groups/services/group-service.test.ts app/features/groups/providers/group-provider.test.tsx app/features/groups/providers/group-provider.cross-device-membership.integration.test.tsx`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.

## v1.0.11 - M8 CP2 (Planned)

Goal:
1. make lifecycle regressions one-copy diagnosable during two-device replay.

Scope:
1. extend digest summary counters for membership/sendability convergence outcomes,
2. add deterministic capture helper for `M8` two-device account-switch evidence bundles,
3. update maintainer replay instructions and matrix docs for M8 incident classes.

## v1.1.0 - M8 CP3/CP4 (Planned)

Goal:
1. close M8 with reproducible runtime evidence and strict release gates.

Scope:
1. execute and attach manual two-device account-switch/restart/recover matrix evidence,
2. burn down regressions discovered during CP3 replay,
3. run strict release preflight and publish `v1.1.0`.

Mandatory release gates:
1. `pnpm version:check`
2. `pnpm docs:check`
3. focused `vitest` suites for touched owners
4. `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`
5. `pnpm release:test-pack -- --skip-preflight`
6. `pnpm release:preflight -- --tag v1.1.0`

## Working Rules During This Lane

1. no parallel lifecycle owners for community identity, membership, or sendability,
2. no release claim without diagnostics + manual replay evidence attachment,
3. fixes by subtraction when overlap paths are detected,
4. each checkpoint commit remains bounded and reviewable.
