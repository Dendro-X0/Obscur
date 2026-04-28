# Core Verification: Contacts, Trust, and Request Flows

_Last reviewed: 2026-04-17 (baseline commit a3f16b10)._

This packet covers Lane 5 from:

1. `docs/trust/20-core-function-verification-matrix.md`

The goal is to prove that contact requests, trust acceptance, and anti-abuse
controls converge on evidence-backed outcomes without drifting into optimistic
or centralized moderation semantics.

## Scope

This lane verifies:

1. outgoing request send state and convergence,
2. incoming request receive and inbox behavior,
3. accepted / declined / canceled transitions,
4. accepted-peer routing into chat rather than request limbo,
5. anti-abuse and quarantine behavior for suspicious incoming request bursts,
6. privacy-preserving local-first trust controls.

## Canonical Owners

1. `apps/pwa/app/features/network/providers/network-provider.tsx`
2. `apps/pwa/app/features/messaging/services/request-transport-service.ts`
3. `apps/pwa/app/features/messaging/services/request-flow-evidence-store.ts`
4. `apps/pwa/app/features/messaging/services/request-status-projection.ts`
5. `apps/pwa/app/features/messaging/services/incoming-request-anti-abuse.ts`
6. `apps/pwa/app/features/messaging/controllers/incoming-dm-event-handler.ts`
7. `apps/pwa/app/features/messaging/hooks/use-requests-inbox.ts`

## Required Invariants

1. Outgoing request state is provisional until relay/recipient evidence exists.
2. Accepted peers route into the canonical chat path instead of staying trapped
   in request UI.
3. Decline/cancel/accept transitions must not commit durable state without
   publish or recipient evidence where required by the owner path.
4. Repeated incoming pending-peer or request events must not inflate unread
   state endlessly for the same peer.
5. Anti-abuse decisions must be local-first, reason-coded, reversible, and
   must not depend on plaintext scanning.
6. Quarantined or blocked request flows must remain diagnosable.

## Automated Verification Set

Run:

```bash
pnpm -C apps/pwa exec vitest run app/features/messaging/services/request-transport-service.test.ts app/features/messaging/services/request-status-projection.test.ts app/features/messaging/services/incoming-request-anti-abuse.test.ts app/features/messaging/hooks/use-requests-inbox.integration.test.ts app/features/messaging/controllers/incoming-dm-event-handler.test.ts
pnpm -C apps/pwa exec tsc --noEmit --pretty false
pnpm docs:check
```

Expected focus:

1. `request-transport-service.test.ts`
   - deterministic state mapping,
   - accept/decline/cancel commit eligibility,
   - canonical contact event dual-write when evidence exists.
2. `request-status-projection.test.ts`
   - resend grace,
   - pending vs recipient_seen,
   - retry eligibility.
3. `incoming-request-anti-abuse.test.ts`
   - peer/global burst thresholds,
   - strict-mode relay/peer intel blocks,
   - local-first reason-coded outcomes.
4. `use-requests-inbox.integration.test.ts`
   - stable accepted records,
   - bounded unread behavior,
   - historical sync unread suppression.
5. `incoming-dm-event-handler.test.ts`
   - accepted-peer routing,
   - unknown-sender/request-path handling,
   - request replay suppression,
   - request burst quarantine diagnostics.

## Manual Replay Set

Run with at least two accounts (`A`, `B`):

1. `A` sends request to `B`,
2. `B` receives and inspects request,
3. `B` accepts, declines, and cancels in separate runs,
4. verify accepted peers route to chat correctly,
5. verify generic DMs from pending peers stay pending when intended,
6. replay bursty incoming requests to confirm quarantine/reason-code behavior,
7. verify blocked or muted trust controls remain local-first and reversible.

## Evidence To Capture

Primary probes:

1. `window.obscurAppEvents.findByName("messaging.request.incoming_quarantined", 30)`
2. `window.obscurAppEvents.findByName("messaging.transport.publish_result", 30)`
3. `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.incomingRequestAntiAbuse`

Capture:

1. sender request status,
2. receiver inbox item state,
3. accepted/declined/canceled transition outcome,
4. reason code for any quarantine/suppression,
5. whether accepted peers route to chat instead of request limbo.

## Pass Criteria

This lane passes only if:

1. automated suites are green,
2. outgoing and incoming request flows converge deterministically,
3. accepted peers route to chat correctly,
4. anti-abuse controls suppress suspicious bursts with reason-coded local
   outcomes,
5. request inbox state remains stable and does not inflate unread noise from
   repeated or historical replay events.
