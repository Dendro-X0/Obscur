# Design — Desktop video call stage (R5)

**Date (UTC):** 2026-10-19  
**Status:** Implemented (L1) · desktop video floating stage · not full-window · not usable claim  
**Parents:** [m1-video-dial-ui-design-2026-10.md](./m1-video-dial-ui-design-2026-10.md) · [realtime-call-perf-stability-ux-investigation-2026-10.md](./realtime-call-perf-stability-ux-investigation-2026-10.md)  
**UI:** [docs/frontend-spec-desktop-video-call-stage-2026-10.md](../../docs/frontend-spec-desktop-video-call-stage-2026-10.md)

```text
HANDOFF ATOMIC STEP: Maintainer named R5 desktop video stage
PAUSED / CANCELLED: Claim video usable · M1-L3 · full-window desktop takeover · Soft L3 Fixed
CANONICAL OWNER:     VoiceCallDock · GlobalVoiceCallOverlay · resolveVoiceCallPresentation
PROOF BEFORE DONE:   L1 presentation resolver + dock stage testids
SURFACE:             Desktop packaged / web shell — not mobile fullscreen
```

## Goal

Desktop negotiated **video** calls get an enlarged floating **stage** (remote fill + local PiP), not the equal split card and not a full-window takeover. Voice stays on the compact dock.

## Presentation matrix

| Shell | callType | presentation |
|-------|----------|--------------|
| Mobile product | video | `fullscreen` (existing) |
| Mobile product | voice | `dock` |
| Desktop | video | `stage` (**new**) |
| Desktop | voice | `dock` |

## Stage contracts (desktop)

1. Floating panel — fixed, bottom-centered (same anchor offsets as dock); **not** `inset: 0`.  
2. Width `min(36rem, calc(100vw - 2rem))`; stage body height `min(22rem, 48vh)`.  
3. Remote pane fills stage body; local is corner PiP (`frame: pip`).  
4. Name / phase / timer overlay top; End / Open chat / Close on bottom bar.  
5. Camera-unavailable + lab-canvas honesty banners stay visible.  
6. Incoming ring continues to use `IncomingVoiceCallToast` (unchanged).

## Non-goals

- Claiming video demoable / M1-L3  
- Changing mobile fullscreen  
- Desktop full-window immersion  
- Conference UI  

## Proof

L1: `resolveVoiceCallPresentation` cases · dock renders `voice-call-desktop-stage` for `presentation="stage"` + video.

_Last updated: 2026-10-19T10:10:00Z_
