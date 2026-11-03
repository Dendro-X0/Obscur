# Design — DM send thin refactor (Rust retained)

**Date (UTC):** 2026-08-05  
**Status:** Phase 1 L1+L3 Pass (maintainer DM/media 2026-08-05) — release via v1.9.15  
**Pairs with:** [dm-send-thin-refactor-investigation-2026-08.md](./dm-send-thin-refactor-investigation-2026-08.md) · CodaCtrl RWR mode=`refactor` · MRI=`remediate`

```text
HANDOFF ATOMIC STEP: DM thin refactor — restore send without full-tree restore
PAUSED / CANCELLED:   Dev Lab · COM-RUN-* · O-2/O-4 · RIW-8 · AUTH-SESSION · groups/**
CANONICAL OWNER:      dm-send-pipeline (+ dm-relay-transport); transport dial owner = nostr WS client via mesh pool; ACK owner = Rust relay.rs
PROOF BEFORE DONE:    L1 + L2 + L3 parity-desktop A↔B
OUT OF SCOPE:         Greenfield DM stack · rewrite Rust OK path · groups/** · AUTH-SESSION · video · Soft L3 Docker SLA
```

## Goals

1. Restore reliable DM send on public Nostr via existing Rust NativeRelay.
2. Preserve unrelated working-tree UI/feature work (no wholesale `git restore`).
3. One user action → one EVENT → one OK waiter → one confirmation UI.
4. Stop reconnect storms that cancel pending ACKs.

## Non-goals

- Big-bang rewrite of messaging UI, persistence, or voice.
- Replacing Rust `relay.rs` ACK ownership with a new TS-only stack.
- Touching PAUSED `groups/**` publish writers.
- Claiming “fixed” from L1 alone.

## Architecture (strangler / subtract)

```text
                    ┌─────────────────────────┐
  Send click ──────►│ dm-send-pipeline        │  sole DM send entry
                    │  (no warm force-dial)   │
                    └───────────┬─────────────┘
                                │ publishToRelays
                    ┌───────────▼─────────────┐
                    │ dm-relay-transport      │  URL scope only
                    └───────────┬─────────────┘
                                │ publishToUrls
                    ┌───────────▼─────────────┐
                    │ use-conduit-mesh-       │  pool facade
                    │ relay-pool              │  reconnectAll = setRelayUrls only
                    │                         │  (no forceReconnectAll on send)
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │ conduit-mesh-nostr-     │  open sockets; wait OK
                    │ ws-client               │
                    └───────────┬─────────────┘
                                │ NativeRelay
                    ┌───────────▼─────────────┐
                    │ relay.rs (Rust)         │  connect + send + pending_acks
                    └─────────────────────────┘
```

## Phases

### Phase 1 — Subtract storm (restore send) — **implement next**

1. Remove `warmRelayNetworkForSend` from `dm-send-pipeline` / retry path (delete or quarantine untracked warmup module).
2. Mesh `reconnectAll`: dial via `setRelayUrls` for closed/error only — **do not** tear down open sockets on every send.
3. Keep `onConfirmed` ⇒ skip Phase-1 `sendToOpen` (single EVENT+OK).
4. Keep call-record ghost honesty if already landed (orthogonal).
5. Proof: L1 green · rebuild shell · L3 A→B send.

### Phase 2 — Dial policy owner (only if Phase 1 L3 fails)

Single `ensureOpenSocketsForPublish(urls)` at pool boundary:

- If `openCount > 0` for targets → proceed.
- Else one `setRelayUrls` + wait ≤8s.
- Never call from Relays settings probe loop and send path with different semantics.

### Phase 3 — Optional extract (not required for restore)

Move send orchestration into `dm-send-owner.ts` with the same contracts; delete dead warm/dual paths. Still call Rust ACK.

## Invariants

- ACK truth = Rust `parse_ok_payload` / `resolve_pending_ack` (or explicit fail message).
- UI “confirmed” only after `onConfirmed` success evidence.
- No new `relay-publish` writer under `groups/**`.
- Frozen packages: do not churn `@obscur/conduit-mesh` APIs for this slice.

## Proof matrix

| Layer | Command / surface |
|-------|-------------------|
| L1 | vitest: dm-send-pipeline, dm-relay-transport, conduit-mesh-nostr-ws-client |
| L2 | `cargo check -p obscur_desktop_lib` |
| L3 | `parity-desktop`: send text A→B; no dial storm; toast absent on success |
| Truth surface | CodaCtrl: `parity-desktop` (already evaluated) |

## Rollback

If Phase 1 regresses further: surgical restore **only** the Phase-1 file set to `HEAD` (not whole tree) — listed in feasibility doc outcome A minimum set.
