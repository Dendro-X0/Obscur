# 05 Data, State, and Sync Flows

_Last reviewed: 2026-03-19 (baseline commit 0a799f5)._

## Core Principle

Local state is provisional. Durable states must be derived from evidence (relay ACK, recipient-side signals, checkpoint evidence).

## Primary Persistence Surfaces

- Messaging queue/state
: `apps/pwa/app/features/messaging/lib/message-queue.ts`

- Chat state projection
: `apps/pwa/app/features/messaging/services/chat-state-store.ts`

- Account sync events/projection
: `apps/pwa/app/features/account-sync/services/account-event-store.ts`

- Identity/session records
: `apps/pwa/app/features/auth/utils/open-identity-db.ts`

- Profile-scoped keys
: `apps/pwa/app/features/profiles/services/profile-scope.ts`

## Outgoing DM Flow (Simplified)

1. Build encrypted event payload.
2. Resolve target relay scope (recipient evidence + sender fallbacks).
3. Publish via relay pool with quorum/evidence tracking.
4. If publish is degraded, queue retry with reason code and diagnostics.

Key files:

- `apps/pwa/app/features/messaging/controllers/outgoing-dm-orchestrator.ts`
- `apps/pwa/app/features/messaging/controllers/outgoing-dm-publisher.ts`
- `apps/pwa/app/features/messaging/controllers/dm-queue-orchestrator.ts`

## Incoming DM Flow (Simplified)

1. Subscription manager receives relay events.
2. Incoming handler verifies recipient, signature, decryptability, trust/routing.
3. Message is persisted and projected into UI state.
4. Diagnostics/evidence stores record routing and status transitions.

Key files:

- `apps/pwa/app/features/messaging/controllers/dm-subscription-manager.ts`
- `apps/pwa/app/features/messaging/controllers/incoming-dm-event-handler.ts`

## Account Sync Flow (Simplified)

1. Local mutations append account events.
2. Encrypted backup publish attempts send account snapshots/events.
3. Projection runtime rehydrates deterministic account state on startup.
4. Drift detector and sync policy control reconciliation behavior.

Key files:

- `apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts`
- `apps/pwa/app/features/account-sync/services/account-projection-runtime.ts`
- `apps/pwa/app/features/account-sync/services/account-sync-drift-detector.ts`

## Discovery Flow (Friend Code, pubkey, QR)

- Search and identity resolution: `apps/pwa/app/features/search/services/discovery-engine.ts`
- Friend code parsing/normalization: `apps/pwa/app/features/search/services/friend-code-v2.ts`
- Outbox/state coupling: `apps/pwa/app/features/search/hooks/use-contact-request-outbox.ts`

## Guardrails

- Do not advance sync/checkpoints on timeout-only signals.
- Do not mark delivery successful from optimistic UI state.
- Keep profile/account scope explicit in every storage access.

## Startup Fail-Open Model (v0.9.2)

Warm-up supervisor ownership is removed in the active runtime path.
Startup now uses bounded fail-open gates:

1. Profile bootstrap gate:
: `apps/pwa/app/features/profiles/components/desktop-profile-bootstrap.tsx`
: native profile refresh is deadline-bounded and retries in background.
2. Identity storage gate:
: `apps/pwa/app/features/auth/utils/open-identity-db.ts`
: IndexedDB open is timeout/blocked guarded.
3. Profile boot stall gate:
: `apps/pwa/app/features/runtime/components/profile-bound-auth-shell.tsx`
: stall path shows deterministic recovery actions instead of infinite loading.
4. Runtime activation gate:
: `apps/pwa/app/features/runtime/components/runtime-activation-manager.tsx`
: activation can degrade fail-open instead of blocking forever.

## v0.9.2 Sync Priorities

1. Preserve joined-community state across logout/login and new-device restore for both inviter and invitee identities.
2. Ensure account projection replay restores canonical DM and community views without identity-target navigation drift.
3. Keep unread state scoped by canonical conversation target so group unread and DM unread cannot cross-trigger.
4. Keep backup publish, mutation signals, and projection replay convergent under startup relay churn.

## Relay Foundation Phase 1 Baseline

Reference:
- `docs/15-relay-foundation-hardening-spec.md`

Baseline scenarios to run before and after relay-runtime changes:

1. startup with healthy relays,
2. startup with mixed healthy/dead relays,
3. startup with zero writable relays (degraded expected),
4. disconnect after `ready`,
5. reconnect + subscription replay.

Capture payload (compact):
- `window.obscurWindowRuntime.getSnapshot()`
- `window.obscurRelayRuntime.getSnapshot()`
- `window.obscurRelayTransportJournal.getSnapshot()`
- `window.obscurAppEvents.getDigest(300)`
