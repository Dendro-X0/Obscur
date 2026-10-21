# Design — Desktop video call window UX (drag / corner / fullscreen)

**Date (UTC):** 2026-10-20  
**Status:** Implemented · L1  
**Frontend:** [frontend-spec-desktop-video-call-window-2026-10.md](../../docs/frontend-spec-desktop-video-call-window-2026-10.md)

```text
HANDOFF ATOMIC STEP: Floating video window does not block chat multitasking
PAUSED / CANCELLED: Claim video usable · Soft L3 Fixed · M2 conference
CANONICAL OWNER:     voice-call-stage-window-position · VoiceCallDock
PROOF BEFORE DONE:   L1 clamp/default · stage drag + fullscreen toggle · vitest
```

## Contract

1. Default floating stage anchor: **bottom-right** with margin ≥ 1rem (safe-area aware via CSS env where possible).
2. Drag updates `{ left, top }`; clamp so window stays fully in viewport.
3. Fullscreen is presentation override inside the overlay; exit restores last floating rect.
4. Voice-only remains center dock widget (no stage drag this slice).

_Last updated: 2026-10-20T06:40:00Z_
