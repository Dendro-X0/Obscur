# Design — N2 unlocked hydrate PostMessage cut

**Date (UTC):** 2026-10-13  
**Status:** Implementing — E27 heap (PM0/warmup0) · **N2f coded** · CDP-off soak next (rewrite PAUSED)  
**Investigation:** [desktop-shell-lag-investigation-2026-10.md](./desktop-shell-lag-investigation-2026-10.md) **E23** (+ E9–E17 unlocked path)  
**Standards:** [obscur-native-performance-standards.md](../../docs/program/obscur-native-performance-standards.md) §4.2 · §4.7 · §5  
**Prior:** N1 picker light shell ([desktop-shell-n1-profiles-ipc-design-2026-10.md](./desktop-shell-n1-profiles-ipc-design-2026-10.md)) · Slice 3b–3h PostMessage design  
**Naming:** This **N2** = unlocked chat hydrate IPC. **10k sliding window** stays deferred (do not call it N2 here).

## Problem

N1/N1e keep `/profiles` picker quiet (invoke 27→28, no engine). After Tester1 entry on stamp `17:17:39Z` CDP-off, messaging mounts and **8157× `PostMessage 0x80070718`** fire within seconds of the first `engine_invoke` / tombstone / `listGroupMessages` / `getThread` burst. Soft-lock L3 blocked. Presence `30315` coalesce held (~18 signs / ~35 min) — not the early flood.

## Causal stack (E23)

1. Picker consume → navigate `/` → `AppSessionShell` mounts **full** `UnlockedAppRuntimeShell`.
2. Same tick / first seconds: `DesktopWarmupOwner`, `DmKernelColdStartRepairOwner`, `MessagingProvider`, sidebar preview hydrate, lease touch, presence publish — parallel IPC.
3. Windows HWND queue saturates (invoke request/response PostMessage class per E8–E9); Quiet/NativeRelay dials were **absent** from this log.
4. Host FreeMB collapses; machine-wide lag returns even with CDP off.

## Invariants

1. **P1 before hydrate storm** — Unlocked chrome (sidebar/nav) must be interactive before parallel engine list/tombstone/warmup storms (standards §4.7).
2. **Single warm-up owner** — Do not add a second progressive coordinator; extend `DesktopWarmupOwner` / existing idle gates only.
3. **Subtraction first** — Prefer defer/skip/coalesce over new caches or bridge layers.
4. **N1 lock preserved** — `/profiles*` never mounts this tree; `pnpm verify:native-perf-n1` stays green.
5. **Quiet stays capped** — Keep Quiet public dials at process defense-in-depth until unlocked L2 PostMessage green, then raise under proof.
6. **Budget** — After entry: PostMessage sustained **0**, burst **&lt;10**; idle `engine_invoke` ≤30/min after warm-up (§4.2).

## Slice plan (smallest first)

| Slice | Change | Why |
|-------|--------|-----|
| **N2a** | Defer `DesktopWarmupOwner` `startDesktopWarmup` until after first unlocked paint + short idle (`requestIdleCallback` / ≥1 frame + ~500 ms), cancel on lock | **Coded** · `schedulePostPaintIdleWork` / `desktop-warmup-defer` |
| **N2b** | Gate `DmKernelColdStartRepairOwner` after relay-ready via same post-paint idle (no parallel repair scan with unlock storm) | **Coded** · cold-start owner defers via `schedulePostPaintIdleWork` |
| **N2c** | Stagger sidebar `listGroupMessages` preview hydrate to **sequential** (was `Promise.all`) | **Coded** · `hydrateGroupSidebarPreviewsFromSqlite` |
| **N2d** | Defer first presence online 2.5 s post-paint+idle; **no offline on effect cleanup**; sequential `insertDmTombstone` | **Coded** · E24 follow-up |
| **N2e** | **Kill** unlocked `DesktopWarmupOwner` start until no-heap soak; Rust emit **only** start+terminal (no per-task WebView emit) | **Coded** · E25 · opt-in `OBSCUR_DESKTOP_WARMUP=1` |
| **N2f** | Seed tombstone insert-dedupe from `listDmTombstones`; ensureReady skips native re-insert; presence defer **12s** | **Coded** · E27 heap with insertTombstone=7 |
| **N2g** | Batch `insertTombstones` engine method + replace N× `Promise.all(insertDmTombstone)` / sequential loops in persistence, visibility owner, tombstone-store | **Coded** · E33 tops (`insertTombstone=14`) · L2 soak pending |
| **N3** | Sidebar `ConversationRow`: remove `transition-all`; `content-visibility: auto` | **Coded** · E25 scroll stutter |

Do **not** remount providers per-route (already reverted — useMessaging crashes). Defer **work**, not the provider tree.  
Do **not** stack-rewrite off Tauri (handoff **PAUSED**).

## Non-goals

- Tauri stack rewrite  
- 10k message sliding window  
- Soft-lock SQLite L3 (separate band)  
- Relay diagnostics Slice B (gated on unlocked L2 green)  
- Dual-profile CDP tax matrix  

## Proof

| Layer | Command / check |
|-------|-----------------|
| **L1** | `pnpm verify:native-perf-n1` still Pass; unit/contract for any new defer/idle helpers |
| **L2** | Reboot if FreeMB &lt;2 GB · `OBSCUR_CDP_MAIN=0` static shell · cold picker quiet · enter Tester1 · **PostMessage count &lt;10** in first 5 min · no heap · invoke tops after warm-up lack unbounded climb |
| **L3** | Soft-lock claim: navigate Relays → Chat → one DM; idle ≥10 min PostMessage sustained 0 |

## Claim language

- Design accepted ≠ implemented ≠ verified.  
- “Entry works” (N1e no bounce) ≠ “unlocked perf fixed”.  
- Soft-lock L3 only after L2 PostMessage budget.

_Last updated: 2026-10-15T05:30:00Z_
