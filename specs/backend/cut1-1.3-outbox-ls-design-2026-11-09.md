# Design — Cut 1.3 Outbox LS subtract (K-OUTBOX-LS)

**Date:** 2026-11-09  
**Status:** **L1 Pass** (kernel prepare→ACK send-face remains Cut 1.4)  
**Parent:** [cut1-replacement-authority-design-2026-11-09.md](./cut1-replacement-authority-design-2026-11-09.md) §1.3

```text
HANDOFF ATOMIC STEP: Cut 1.3 K-OUTBOX-LS
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass
CANONICAL OWNER:     kernel SQLite outbox (+ prepareT3Outbound / home ACK for private-trust)
PROOF BEFORE DONE:   L1 — native never writes/reads dm_message_queue_v1; scrub residual key
SURFACE:             Tauri desktop primary; browser degraded may keep ephemeral LS queue
```

## Goal

Stop persisting outbound DM retries (incl. **plaintext + private keys**) in `localStorage` key `dm_message_queue_v1` on native. Retries belong to kernel `outbox` / T3 prepare→ACK (Cut 0 spine; send-face cutover remains 1.4).

## Deliver

1. `dm-message-queue`: on `requiresSqlitePersistence()`, never `getItem`/`setItem` `QUEUE_KEY`; scrub key; `queueMessage` no-ops (no secret retention).
2. `sendDmWithRetry`: native path does not claim LS-queued delivery.
3. L1 contract: source + runtime ban of product `QUEUE_KEY` writes under native policy.

## Non-goals

- Soft L3 Fixed · full private-trust send-face (1.4) · chat-state demotion (1.5)

## Proof

| Layer | Check |
|-------|--------|
| L1 | vitest Cut 1.3 owner-uniqueness + persistQueue refuse |
| L2 | optional desktop offline send uses kernel outbox (owed with 1.4) |
