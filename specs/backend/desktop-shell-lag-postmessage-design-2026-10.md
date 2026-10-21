# Design — Desktop lag: PostMessage queue saturation (relay emit)

**Date (UTC):** 2026-10-12  
**Status:** **GATED** — L2 soak / Slice 3i+ code wait on N0 accept of [obscur-native-performance-standards.md](../../docs/program/obscur-native-performance-standards.md). Slices 3b–3i coded; resume from E18.  
**Investigation:** [desktop-shell-lag-investigation-2026-10.md](./desktop-shell-lag-investigation-2026-10.md)  
**Research (broader):** [native-shell-performance-research-2026-10.md](./native-shell-performance-research-2026-10.md)  
**Handoff:** [docs/handoffs/current-session.md](../../docs/handoffs/current-session.md)

---

```text
HANDOFF ATOMIC STEP:  PAUSED — shell-lag band parked; await feature unit
PAUSED / CANCELLED:   shell-lag/Track L (operator) · M1–M3 · dialects · ASE-2 · SF-B
CANONICAL OWNER:      n/a while paused
PROOF BEFORE DONE:    n/a until band re-opened
SURFACE:              operator manual client launch for verify
```

---

## Goal

Stop the **3530× `0x80070718` PostMessage flood** that starts right after public relay dials, so the shell stays interactive for S2 / P5 — and stop the follow-on **`STATUS_HEAP_CORRUPTION`**.

## Invariants

1. **Correctness first:** Relays must still deliver EVENT / OK / EOSE to JS; coalescing must not drop distinct EVENT ids silently without a merge strategy.  
2. **Subtraction over cache:** Reduce emit rate / duplicate dials before adding buffers.  
3. **No dialect / SFU work** under this cover.  
4. **Honesty:** If CDP-off is required for dogfood, document it — do not pretend debug CDP is free.  
5. **Quiet cap is process-wide:** Multi-mount React pools must not each open NativeRelay to nos/primal/damus.

## Slice 1 (implemented · L2 conditional)

| Piece | Behavior | Proof |
|-------|----------|-------|
| Native `relay-event` coalesce | EVENT coalesce 50 ms / max 24 / hard cap 72; OK/EOSE prompt | L1 `lag_slice1` · L2 storm 3530→22 |
| Dial serialize | `relay_dial_gate` one dial at a time | in `relay.rs` |
| CDP-off dogfood | `OBSCUR_CDP_MAIN=0` | used on L2 soaks |

**Result:** Storm reduced; **heap still** after ~5–10 min → Slice 2 required.

## Slice 2 (in progress)

### Intent

- Cap simultaneous **public-default (Quiet)** relay dials during unlock warm-up to **1** process-wide.  
- When any private/local/custom relay is in the pool, **omit Quiet entirely**.  
- Serialize / share pools so multi-mount cannot ×N the cap.

### Implemented (JS)

| Piece | Location |
|-------|----------|
| `partitionWarmupDialUrls` (cap=1 / private-prefer omit) | `apps/pwa/app/features/relays/services/relay-warmup-dial-cap.ts` |
| Process-wide `tryClaimProcessPublicWarmupDial` | same |
| Local Quiet host Set (no community-mode-contract import) | same — avoids turbopack mis-bind |
| Shared product nostr client | `use-conduit-mesh-relay-pool.ts` |
| Factory gate + `QuietDialRejectedSocket` (`quiet_dial_cap`) | `create-relay-websocket.ts` |
| No browser fallback on `quiet_dial_cap` | `native-relay.ts` |

**L1:** vitest dial-cap + nostr-ws-client + create-relay-websocket — **24 passed**.

### Implemented (Rust — pending L2)

| Piece | Location |
|-------|----------|
| `QuietPublicDialClaim` / `QUIET_PUBLIC_DIAL_CAP=1` | `apps/desktop/src-tauri/src/relay.rs` |
| Refuse duplicate / over-cap Quiet `connect_relay` | before dial; log `[NativeRelay] quiet_dial_cap …` |
| Release on disconnect / read-loop exit | `release_quiet_public_dial_url` |
| Unit: host detection + cap=1 | `lag_slice1_tests` (re-run after interrupt) |

### Runtime finding (why Rust is required)

L2 `184854` rebuilt shell stamp `shell-2026-10-12T12:06:59Z` with `quiet_dial_cap` **present in `out/`**, yet still logged three Quiet hosts. JS claim alone did not stop NativeRelay → Rust sticky/cap gate.

### Slice 2b result (Quiet cap=0)

- L1 green; L2 `986505`: **zero** Quiet dials, still **154 PostMessage** + heap ~7.8 min.  
- Quiet=0 retained as defense-in-depth; **not sufficient alone**.

## Slice 3 (in progress)

| Piece | Behavior |
|-------|----------|
| Emit instrumentation | `[emit-pressure]` on relay/mesh/warmup + tor/tray/profiles/deep-link — **E8: zero during 957 PM flood** |
| Invoke instrumentation | Wrap desktop `invoke_handler`: `[invoke-pressure]` top-N every 2s (Rust println) |
| JS side meter | `noteInvokePressure` in `invokeNativeCommand` (console; secondary) |
| Hot channel (E9–E11) | Was workspace list/tombstone; **now `sign_event_native`** (E11) |
| Method meter | `eng:<engine>:<method>` + `sign_kind:<n>` |
| Hot-channel subtraction (3b) | Empty-preview negative cache · 1.5s debounce · group tombstone dedupe — **L2 proven** |
| Hot-channel subtraction (3c) | Presence heartbeat effect ref-stable + online coalesce · DM tombstone session dedupe — **E13: 30315 flat** |
| Hot-channel subtraction (3d) | Lease: list persist only on prune · touch disk throttle 5s · release persist iff removed · DM: deleteMessages/session dedupe · listTombstones 2s cache — **E14: PM=0** |
| Hot-channel subtraction (3e) | Sidebar `listConversations` 1.5s debounce on index-rebuilt · 2s list cache · lease heartbeat 4s→8s — **E15: ≥21 min no heap** |
| Hot-channel subtraction (3f) | Pre-reserve delete dedupe · no N× deleteMessage fallback · `listGroupMessages` cache — **E16: PM=0** |
| Hot-channel subtraction (3g) | `ensureReady` once-per-profile · prepare drops re-hydrate/re-list · list caches 30s — **E17: list tops gone** |
| Hot-channel subtraction (3h) | Session-cache `get_session_nsec` · lease TTL 24s / heartbeat 12s |
| Keep Quiet=0 | Until L2 green with Quiet allowed again under a later raise |

## Out of scope

- Full navigation remount rewrite (historical S0/S4).  
- Soft-lock SQLite (separate band; not evidenced in flood log).  
- Webpack HMR (session was static-dev).  
- M1–M3 / dialects / ASE-2 / SF-B.

## Proof

| Layer | Command / check | Status |
|-------|-----------------|--------|
| **L1 JS** | vitest dial-cap + create-relay-websocket + nostr-ws-client | **green** |
| **L1 Rust** | `cargo test -p obscur_desktop_lib -- lag_slice1` | **re-run pending** |
| **L2** | `OBSCUR_CDP_MAIN=0 pnpm dev:desktop:no-coord` · idle ≥10 min · **≤1** Quiet `connect_relay` host · no `0xc0000374` · PostMessage &lt; 10 | **not green** |
| **L3** | Navigate Relays → Chat → send one DM; optional dual-profile after L2 | blocked on L2 |

## Claim language

- Design accepted ≠ implemented ≠ verified.  
- “Lag fixed” only after L2 + L3.  
- “Dial cap landed in out/” ≠ “≤1 Quiet at runtime”.

_Last updated: 2026-10-13T08:20:00Z_
