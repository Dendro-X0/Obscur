# Mobile preview — clicks do not change page (investigation)

**Date:** 2026-10-24  
**Surface:** `pnpm dev:mobile-preview` (Tauri phone window + Next :3340)  
**Symptom:** Network tab chips / bottom nav feel dead — “clicking does not trigger a page change.”

## Evidence

1. Screenshot: Network · All People · Groups badge `1` · empty connections. Filter chips are the likely first click target.
2. Terminal: Soft routes eventually work (`GET /search`, `GET /network`) but `○ Compiling /search` took ~7.9s — clicks during stall look dead.
3. `shouldArmRouteStallWatchdog()` returns **false** whenever `hasNativeRuntime()` — mobile preview is Tauri, so the tab-bar hard fallback never arms.
4. Network compact category scroller: `setPointerCapture` on every mouse `pointerdown` when overflow; any move >4px sets `categoryDragMovedRef` and **suppresses** the following click. Also `[&_*]:pointer-events-none` while `categoryDragging` — stuck drag freezes chips.

## Root causes (ranked)

| Rank | Cause | Owner |
|------|--------|--------|
| 1 | Compact category drag vs click (capture + 4px threshold + click suppress) | `network-dashboard.tsx` |
| 2 | Mobile tab bar relies on Next `<Link>` soft nav with **no** stall watchdog on native | `mobile-tab-bar.tsx` + `route-stall-recovery.client.ts` |

## Fix plan (smallest)

1. Delay `setPointerCapture` until drag threshold; raise threshold; clear on `lostpointercapture`.
2. Tab bar: `preventDefault` + soft `router.push` (same as stall recovery on native); arm watchdog for mobile-preview builds.

## Proof

- L1: vitest `network-dashboard.test.tsx` (compact tab switch) + `mobile-tab-bar` / route-stall tests if present  
- L3: manual — click Groups chip; click Chats / Settings in tab bar during idle and during compile
