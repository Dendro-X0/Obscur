# WP-2: EnhancedDMController Decomposition — Progress

## Objective
Decompose `EnhancedDMController` into focused, testable service modules and shrink the controller hook to <300 lines as part of **Phase 1: Stabilization & Decoupling**.

## Progress (2026-02-25)
The controller has been reduced by extracting major pipelines into standalone modules under:
`apps/pwa/app/features/messaging/controllers/`

### Extracted modules
- `dm-event-builder.ts`
  - Builds/signed DM events (NIP-04 + NIP-17) and supports NIP-17 -> NIP-04 fallback when needed.

- `dm-controller-state.ts`
  - State constructors and transition validation (`createInitialState`, `createReadyState`, `createErrorState`, `isValidStatusTransition`) and shared controller types.

- `relay-utils.ts`
  - Relay parsing + helper utilities (`parseRelayEventMessage`, `parseRelayOkMessage`, `generateSubscriptionId`, and relay failure aggregation utilities).

- `incoming-dm-event-handler.ts`
  - Incoming DM pipeline: signature verification, decrypt, privacy filtering, persistence, UI update scheduling, and request-inbox routing.

- `outgoing-dm-publisher.ts`
  - Outgoing publish pipeline:
    - publish via `publishToAll` with NIP-17 -> NIP-04 fallback (`publishOutgoingDm`)
    - queue send retry when no open relays (`queueOutgoingDmForRetry`)
    - fire-and-forget publish when `publishToAll` is unavailable (`publishOutgoingDmFireAndForget`)
    - publish queued messages (`publishQueuedOutgoingMessage`)

- `outgoing-dm-send-preparer.ts`
  - Outgoing message preparation:
    - create message object
    - best-effort persist to `MessageQueue`
    - optimistic UI insertion + memory manager update
    - pending tracking (`pendingMessages`, `relayRequestTimes`)

- `relay-ok-message-handler.ts`
  - Relay `OK` handling pipeline:
    - latency calculation and per-relay result accumulation
    - status advancement
    - queueing retry decisions
    - persistence update + UI update

- `recipient-relay-hints.ts`
  - Applies recipient relay hints from:
    - `nprofile` embedded relay list
    - NIP-65 write relays via `nip65Service.getWriteRelays`

## Known follow-ups / next steps
- Shrink `enhanced-dm-controller.ts` further:
  - Extract subscription management / REQ/CLOSE orchestration.
  - Extract sync pipeline (`syncMissedMessages`) orchestration.
  - Consider consolidating `sendDm` remaining glue into a higher-level send service.

- Tighten types for extracted services:
  - Some modules accept `any` for React state interop (intentional during extraction).

- Address hook dependency warnings (WP-5):
  - After extraction stabilizes, perform a focused dependency + memoization audit.

## Notes
This work is intentionally behavior-preserving refactoring to improve testability and portability (eventual Rust core extraction).
