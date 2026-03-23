# 21 Post-v1 Value Roadmap

_Last reviewed: 2026-03-22 (baseline commit a70ea91)._

This roadmap defines the long-term value track after the `v1.0.0` release.

Primary goals:
1. make Obscur communities substantially more useful for niche ecosystems (music, art, encryption, technology),
2. deliver secure and stable real-time voice communication,
3. protect legitimate users with privacy-preserving anti-fraud/anti-spam controls.

## Scope Lock

1. No new parallel owners for runtime, sync, identity, or transport lifecycles.
2. No plaintext-content moderation or centralized censorship controls.
3. No release claims without runtime evidence (tests + manual replay).
4. Anti-abuse controls must remain local-first, explainable, and user-configurable.

## Pillars

## P1 - Community Platform Expansion

Target outcomes:
1. richer community structure and governance UX,
2. better operator tools without central admin dependency,
3. stronger discoverability and engagement primitives.

Planned capability set:
1. structured community spaces (channels/topics),
2. richer member profile cards and participation signals,
3. governance history/audit surfaces (vote/result trace),
4. shared knowledge surfaces (pinned resources, media collections, event cards),
5. reliability-first invite/join/recovery UX.

## P2 - Voice Communication (Secure + Stable)

Target outcomes:
1. low-friction voice interaction for communities and trusted contacts,
2. deterministic fallback under relay/network degradation,
3. explicit runtime capability detection across desktop/web/mobile.

Planned capability set:
1. Stage A: async voice notes + playback/transcript/search affordances,
2. Stage B: small-room real-time voice beta with strict E2EE path,
3. adaptive quality and relay-failure handling,
4. explicit unsupported-path errors (never silent optimistic success).

## P3 - Privacy-Preserving Anti-Abuse (Anti-Fraud + Anti-Spam)

Target outcomes:
1. protect legitimate users without content censorship,
2. reduce spam/fraud pressure on identity-isolated accounts,
3. keep decisions transparent and reversible by users.

Planned capability set:
1. behavior/rate abuse scoring (invite bursts, DM bursts, join-leave churn),
2. suspicious-first-contact quarantine inbox,
3. optional signed shared blocklists and relay risk scoring,
4. attack-mode safety profile ("strict mode", emergency hardening),
5. reason-coded block/deny outcomes with local audit trail.

Hard constraints:
1. no plaintext message scanning,
2. no centralized universal-ban operator.

## P4 - Identity and Cross-Device Resilience

Target outcomes:
1. prevent account/session drift after device switches,
2. improve deterministic restore confidence for DM/group/media history,
3. preserve membership/sendability convergence.

Planned capability set:
1. stronger restore diagnostics and mismatch reason codes,
2. profile/account scope verification during startup binding,
3. backup/restore evidence gates for identity and room-key portability,
4. recoverability playbook updates for maintainers/operators.

## P5 - Performance and UX Reliability

Target outcomes:
1. eliminate route-freeze and blank-page class regressions,
2. smooth large-timeline scrolling and media-heavy sessions,
3. predictable startup behavior across relay quality bands.

Planned capability set:
1. route transition and startup budget instrumentation,
2. fail-open navigation behavior when relay transport is degraded,
3. continued virtualized timeline + media rendering optimization,
4. UI responsiveness guardrails for desktop and mobile.

## Milestones

## M0 - Post-v1 Baseline and Instrumentation Lock

Scope:
1. freeze post-v1 pillars and acceptance contracts,
2. add roadmap-linked diagnostics checklist into maintainer runbooks,
3. confirm current green baseline before feature expansion.

Acceptance:
1. `pnpm version:check`
2. `pnpm docs:check`
3. `pnpm release:test-pack -- --skip-preflight`

Current execution status (completed 2026-03-22):
1. Pillars and milestone acceptance contracts are frozen in this document.
2. Maintainer runbook includes a dedicated post-v1 M0 diagnostics checklist:
: `docs/08-maintainer-playbook.md`.
3. M0 baseline gate replay is green on `main`:
: `pnpm version:check`
: `pnpm docs:check`
: `pnpm release:test-pack -- --skip-preflight`

## M1 - Community Platform Foundation + Anti-Abuse Foundation

Scope:
1. deliver first community expansion slice (structure + governance visibility),
2. ship anti-abuse foundation (rate controls + quarantine + reason codes),
3. keep all moderation and state outcomes evidence-backed.

Acceptance:
1. two-device community join/send/recover replay passes,
2. anti-abuse decisions are reason-coded in diagnostics/UI,
3. no regression in existing DM/group delivery contracts.

Current execution status (started 2026-03-22):
1. Anti-abuse foundation slice landed on canonical incoming request path:
: unknown-sender `connection-request` burst guard (per-peer + global window) in
: `apps/pwa/app/features/messaging/services/incoming-request-anti-abuse.ts`.
2. Incoming DM owner now emits reason-coded quarantine diagnostics:
: `messaging.request.incoming_quarantined` app event with explicit `reasonCode` and threshold counters.
3. Focused regression coverage added and passing:
: `apps/pwa/app/features/messaging/services/incoming-request-anti-abuse.test.ts`
: `apps/pwa/app/features/messaging/controllers/incoming-dm-event-handler.test.ts`
: plus `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`.
4. Requests inbox anti-abuse visibility slice landed:
: UI now surfaces quarantined-request summary + per-peer anti-spam signal badges from canonical app-event diagnostics via
: `apps/pwa/app/features/messaging/services/incoming-request-quarantine-summary.ts`
: and `apps/pwa/app/features/messaging/components/requests-inbox-panel.tsx`.
5. Community operator visibility slice landed in management UI:
: members tab now surfaces deterministic operator-health metrics (active/known/online-offline counts, kick-vote pressure, lifecycle drift, disband status) and reasoned governance signals from a typed helper in
: `apps/pwa/app/features/groups/services/community-operator-health.ts`
: and `apps/pwa/app/features/groups/components/group-management-dialog.tsx`.
6. Focused operator-health regression coverage added:
: `apps/pwa/app/features/groups/services/community-operator-health.test.ts`.
7. M1 closeout automation replay is green (2026-03-23):
: `pnpm --dir apps/pwa exec vitest run app/features/messaging/services/incoming-request-anti-abuse.test.ts app/features/messaging/services/incoming-request-quarantine-summary.test.ts app/features/messaging/controllers/incoming-dm-event-handler.test.ts app/features/groups/services/community-operator-health.test.ts`
: `pnpm --dir apps/pwa exec tsc --noEmit --pretty false`
: `pnpm docs:check`
8. Remaining before declaring M1 complete:
: manual two-device replay evidence for anti-abuse quarantine UX + community operator visibility UX, captured using
: `window.obscurAppEvents.findByName("messaging.request.incoming_quarantined", 30)`
: `window.obscurDeliveryDiagnostics?.getSnapshot()?.lastIncoming`
: `copy(window.obscurM0Triage?.captureJson(300))`.

## M2 - Identity/Sync Hardening + Voice Stage A

Scope:
1. strengthen restore and profile-binding resilience surfaces,
2. ship async voice capability (record/send/playback/search-ready metadata),
3. maintain deterministic fallback behavior when voice capabilities are unavailable.

Acceptance:
1. cross-device DM/group/media continuity replay stays green,
2. async voice works on supported runtimes and fails explicitly otherwise,
3. no startup-binding regressions in restart/account-switch flows.

## M3 - Real-Time Voice Beta + Community Operator Tools

Scope:
1. small-room encrypted real-time voice beta,
2. community operator UX upgrades (moderation/policy/health visibility),
3. anti-abuse shared-intel optional path (signed blocklists/relay risk).

Acceptance:
1. stable beta replay under weak-network simulation,
2. operator workflows complete without ambiguous outcomes,
3. release claims backed by tests + manual matrix evidence.

## M4 - Stabilization, Rollout, and Patch Discipline

Scope:
1. harden high-risk findings from beta usage,
2. keep patch slices narrow and owner-consistent,
3. publish updated rollout playbook before broader community expansion.

Acceptance:
1. strict release preflight for target tag is green on clean `main`,
2. no active blocker in `ISSUES.md`,
3. roadmap completion status documented before next major planning cycle.

## Suggested Version Lanes

1. `v1.1.x`: M1 priority (community + anti-abuse foundations).
2. `v1.2.x`: M2 priority (identity/sync hardening + async voice).
3. `v1.3.x`: M3 priority (real-time voice beta + operator tooling).
4. `v1.4.x`: M4 priority (stabilization and rollout confidence).

## Non-Negotiable Validation Contract

Every milestone closeout must include:
1. focused automated tests for touched owners,
2. manual two-device reasoning for identity/messaging/community changes,
3. diagnostics exports for anomalies before any architectural changes,
4. docs updates (`CHANGELOG.md`, `ISSUES.md`, and impacted `/docs` files).
