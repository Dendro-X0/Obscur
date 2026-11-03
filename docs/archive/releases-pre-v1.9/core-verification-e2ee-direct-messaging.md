# Core Verification: E2EE Direct Messaging

_Last reviewed: 2026-04-17 (baseline commit a3f16b10)._

This packet covers Lane 2 from:

1. `docs/trust/20-core-function-verification-matrix.md`

The goal is to prove that direct messaging remains privacy-preserving,
evidence-backed, and deterministic across sender/receiver/runtime-catch-up
states.

Important verification limit:
observable DM functionality can be replayed manually, but confidentiality
against public relay operators cannot be established by manual runtime replay
alone in the current environment. That privacy claim must later be supported by
protocol/crypto owner review, explicit specs, and tests.

## Scope

This lane verifies:

1. outbound DM publish behavior,
2. inbound DM verification, decrypt, and routing behavior,
3. accepted-peer vs stranger/request-path separation,
4. restore/bootstrap catch-up behavior for receive paths,
5. delivery state handling without optimistic false truth.

## Canonical Owners

1. `apps/pwa/app/features/messaging/controllers/enhanced-dm-controller.ts`
2. `apps/pwa/app/features/messaging/controllers/outgoing-dm-publisher.ts`
3. `apps/pwa/app/features/messaging/controllers/incoming-dm-event-handler.ts`
4. `apps/pwa/app/features/messaging/providers/runtime-messaging-transport-owner-provider.tsx`

## Required Invariants

1. A valid accepted-peer DM must route to the chat domain, not request limbo.
2. A runtime catch-up window must not drop real inbound DMs from historically
   known accepted peers just because projection readiness lags.
3. Incoming relay events must pass recipient verification, signature checks, and
   decrypt checks before state mutation.
4. Outgoing transport status must not claim recipient truth from sender-local UI
   state alone.
5. Unsupported publish/runtime paths must fail deterministically rather than
   silently claiming success.
6. Sender and receiver states must be reasoned about separately in tests and
   manual replay.

## Automated Verification Set

Run:

```bash
pnpm -C apps/pwa exec vitest run app/features/messaging/controllers/incoming-dm-event-handler.test.ts app/features/messaging/controllers/outgoing-dm-publisher.test.ts app/features/messaging/services/dm-delivery-deterministic.integration.test.ts app/features/messaging/providers/runtime-messaging-transport-owner-provider.test.tsx
pnpm -C apps/pwa exec tsc --noEmit --pretty false
pnpm docs:check
```

Expected focus:

1. `incoming-dm-event-handler.test.ts`
   - recipient/stranger/request routing,
   - delete suppression,
   - projection-catch-up accepted-peer fallback,
   - protocol envelope verification and replay suppression.
2. `outgoing-dm-publisher.test.ts`
   - protocol vs legacy publish owner behavior,
   - quorum/degraded outcomes,
   - unsupported runtime failure truth.
3. `dm-delivery-deterministic.integration.test.ts`
   - sender/receiver continuity under queued/retry/restart/recovery conditions.
4. `runtime-messaging-transport-owner-provider.test.tsx`
   - transport enablement during bootstrapping, activation, replay, and ready
     phases.

## Manual Replay Set

Run with two accounts (`A`, `B`) on desktop and/or PWA:

1. accepted-peer `A -> B` send,
2. accepted-peer `B -> A` send,
3. send while receiver is still restoring/catching up,
4. send under degraded relay coverage,
5. verify accepted-peer messages do not route to requests or disappear,
6. verify sender-side pending/queued states do not overclaim recipient truth.

## Evidence To Capture

Primary probes:

1. `window.obscurAppEvents.findByName("messaging.transport.incoming_event_seen", 30)`
2. `window.obscurAppEvents.findByName("messaging.transport.publish_result", 30)`
3. `window.obscurAppEvents.findByName("messaging.incoming.accepted_via_history_fallback", 30)`
4. `window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.selfAuthoredDmContinuity`

Capture:

1. sender publish result,
2. receiver event seen/ignored/routed state,
3. whether message appeared in chat,
4. whether request inbox was incorrectly used,
5. whether catch-up fallback was invoked.

## Pass Criteria

This lane passes only if:

1. automated suites are green,
2. `A -> B` and `B -> A` both converge in runtime replay,
3. accepted-peer DMs do not drop during restore catch-up,
4. receive-path failures, if any, are diagnosable from captured transport and
   routing events,
5. sender-local pending/queued states are never described as durable recipient
   truth.

Confidentiality note:
manual replay of this lane does not by itself prove that public relays cannot
observe ciphertext envelopes or metadata. Treat confidentiality/privacy claims
as a later spec-and-test obligation, not as a runtime checkmark from manual
usage.
