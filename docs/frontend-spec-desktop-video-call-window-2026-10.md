# Frontend spec — Draggable desktop video window + fullscreen

**Date:** 2026-10-20  
**Backend / product:** Extends R5 stage; voice stays compact dock widget.  
**Refs:** Discord/Teams-style floating media · Zoom “pop out” · system PiP corners

```text
HANDOFF ATOMIC STEP: Desktop video stage — drag + corner default + fullscreen toggle
PAUSED / CANCELLED: Claim video usable · M2 conference · native OS PiP API
CANONICAL OWNER:     VoiceCallDock stage chrome · voice-call-stage-window-position
PROOF BEFORE DONE:   L1 position helper · dock tests (drag/fullscreen hooks)
SURFACE:             Desktop presentation=stage only; mobile fullscreen unchanged
```

## Modes

| Mode | When | Behavior |
|------|------|----------|
| **Dock (widget)** | Voice / ring before accept | Compact bottom-center pill (unchanged) |
| **Stage (floating)** | Desktop video + connecting/connected | Default **bottom-right**; drag by header; clamp in viewport |
| **Fullscreen** | User toggle on stage | Covers overlay portal (in-app fullscreen, not OS exclusive) |

## Controls (stage)

- Header drag affordance (cursor grab)
- **Expand** → fullscreen; **Exit fullscreen** → restore last floating position
- Existing: Open chat · End · Dismiss

## Non-goals

OS Picture-in-Picture API · multi-monitor native window · resize handles (v2) · voice dock drag this slice

_Last updated: 2026-10-20T06:40:00Z_
