# Design — Do not start call stage until peer accepts

**Date (UTC):** 2026-10-19  
**Status:** Implemented (L1) · stage only after connecting/connected  
**Parents:** [realtime-call-flaky-relay-drop-investigation-2026-10.md](./realtime-call-flaky-relay-drop-investigation-2026-10.md) · R5 stage

```text
HANDOFF ATOMIC STEP: Maintainer — A dials; B offline/never accepts; UI still looks like call started
PAUSED / CANCELLED: Claim video usable · Soft L3 Fixed · defer getUserMedia entirely this slice
CANONICAL OWNER:     resolveVoiceCallPresentation · GlobalVoiceCallOverlay · VoiceCallDock
PROOF BEFORE DONE:   L1 presentation matrix by phase · dock tests
SURFACE:             Outgoing ring chrome
```

## Problem (maintainer + screenshots)

Host video dial opens the **desktop/mobile video stage** with live local camera and a running timer while phase is still **`ringing_outgoing`**. Peer is offline and never accepts. After ~30s the invite card reads **CALL FAILED / session closed**. That feels like “the call began then dropped,” but **no peer session ever existed**.

## Contract

| Phase | Video presentation |
|-------|-------------------|
| `ringing_outgoing` | **`dock` only** — compact “Calling…” / ringing chrome; **no** stage/fullscreen |
| `ringing_incoming` | Unchanged toast path (overlay already branches) |
| `connecting` / `connected` | Existing `stage` (desktop) / `fullscreen` (mobile) |
| `interrupted` / `ended` | `dock` (compact honesty) |

Video panes on the compact dock during **outgoing ring**: **hidden** (invite is ringing, not in AV). Local preview may still exist in memory from dial preflight; it must not dominate UI until peer join evidence (`connecting`+).

## Non-goals

- Blocking dial when presence says offline (presence is soft; separate charter)  
- Removing dial-time camera permission preflight  
- Changing 30s ring timeout budget this slice  

## Proof

L1: `resolveVoiceCallPresentation({ callType: "video", phase: "ringing_outgoing", … }) === "dock"`.  
Dock: video stage testids absent while ringing_outgoing + video.

_Last updated: 2026-10-19T12:20:00Z_
