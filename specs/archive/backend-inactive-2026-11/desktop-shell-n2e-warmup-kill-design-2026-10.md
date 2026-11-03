# N2e — Desktop warmup WebView emit kill (2026-10)

## Problem

E25: after N2d rebuild, unlock entry showed `desktop-warmup-progress=9` then `STATUS_ACCESS_VIOLATION`. Operator scroll/stutter/freeze on communities list. Stack rewrite is **PAUSED** (handoff).

## Decision (subtraction)

1. **Owner off** — `DesktopWarmupOwner` must not call `startDesktopWarmup` until soft-lock L3 proves no-heap soak. SQLite warm can return later behind an explicit opt-in.
2. **Emit budget** — if warmup is ever re-enabled, Rust emits WebView progress **only** on start + terminal (complete/failed), never per task.
3. **N3 sibling** — cut `ConversationRow` scroll paint (`content-visibility: auto`, drop `transition-all`). No virtualizer until list size exceeds page caps under evidence.

## Proof

| Layer | Gate |
|-------|------|
| L1 | `pnpm verify:native-perf-n1` Pass |
| L2 | CDP-off Tester1 entry · `desktop-warmup-progress` absent or ≤2 · no ACCESS_VIOLATION / heap in first 10 min |
| L3 | Soft-lock only after L2 green |

## Non-goals

- Leaving Tauri / Electron rewrite
- Removing SQLite warmup implementation (keep command; stop calling it)
