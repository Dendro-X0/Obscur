# Design — Soft disconnect grace (R2)

**Date (UTC):** 2026-10-19  
**Status:** Implemented (L1) · 4s grace on `disconnected`; `failed` still ends immediately  
**Parent:** [realtime-call-perf-stability-ux-investigation-2026-10.md](./realtime-call-perf-stability-ux-investigation-2026-10.md)

```text
HANDOFF ATOMIC STEP: R1 quality stats L1 done · next R2 soft disconnect
PAUSED / CANCELLED: Claim video usable · ICE restart / TURN in this slice · Soft L3 Fixed
CANONICAL OWNER:     main-shell RTC connectionstatechange · realtime-call-disconnect-grace
PROOF BEFORE DONE:   L1 action mapper · wiring uses the mapper. L3 voice soak not claimed.
SURFACE:             1:1 call already connected
```

## Problem (code fact)

`connectionState === "disconnected"` and `"failed"` both immediately set UI `interrupted` / `network_interrupted`. WebRTC `disconnected` is often a short ICE flap; `failed` means the ICE agent gave up.

## Contract

| State | Action |
|-------|--------|
| `disconnected`, no grace pending | Start **4s** grace. Dock stays on the previous phase (typically `connected`). |
| `disconnected` again while grace pending | Ignore (one timer). |
| `connected` or `connecting` while grace pending | Cancel grace. `connected` keeps the existing connected UI path. |
| Grace expires and PC is still `disconnected` or `failed` | Then `interrupted` + `network_interrupted` + `transportDegraded`. |
| `failed` | End immediately (no grace). ICE restart is a later slice. |
| `closed` | Existing close path; cancel any grace timer. |

## Non-goals

- `restartIce` / `requestRecovery` wire (lifecycle method exists; not this slice)
- TURN
- Claiming calls are more stable without a dual-profile voice soak

## Proof

L1: `resolveRealtimeCallConnectionStateAction` cases above.  
Runtime Pass of “fewer dropped calls”: **not** this slice.

_Last updated: 2026-10-19T07:35:00Z_
