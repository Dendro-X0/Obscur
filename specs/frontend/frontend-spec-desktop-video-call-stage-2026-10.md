# Frontend spec — Desktop video call stage (R5)

**Date:** 2026-10-19  
**Backend:** [m1-desktop-video-stage-design-2026-10.md](../specs/backend/m1-desktop-video-stage-design-2026-10.md)

## Surfaces

| Component | Change |
|-----------|--------|
| `resolveVoiceCallPresentation` | New pure helper |
| `VoiceCallDock` | `presentation: "dock" \| "fullscreen" \| "stage"`; stage layout |
| `GlobalVoiceCallOverlay` | Desktop + video → `stage` |

## Visual

- Dark stage body (`bg-black`), rounded outer card so it still reads as chrome-over-chat, not a second app window.
- Remote full-bleed inside stage; local PiP top-right.
- Bottom control row: Open chat · End · Dismiss (Accept/Decline only if that phase appears on dock — usually toast handles incoming).
- Preserve amber honesty banners above the control row.

## A11y

- Stage root `data-testid="voice-call-desktop-stage"`.
- Control buttons keep existing `aria-label`s.
- Placeholders remain readable when no live track.

## Out of scope

Full-window desktop video · marketing copy · camera L3.

_Last updated: 2026-10-19T10:10:00Z_
