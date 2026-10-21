# Design — M1 video dial UI (DM header)

**Date (UTC):** 2026-10-18  
**Status:** Implemented (L1) · M1-L3 still blocked  
**Parents:** [m1-video-camera-less-engineering-design-2026-10.md](./m1-video-camera-less-engineering-design-2026-10.md)  
**Charter:** Maintainer — add **Video call** beside **Voice call** on DM header; on interact, check devices and request camera permissions. Does **not** unpause M1-L3 / “video usable.”

```text
HANDOFF ATOMIC STEP: S2 blocked — charter: DM Video call dial (structure only)
PAUSED / CANCELLED: Claim video shipped · M1-L3 · Gift fake-video · Soft L3 Fixed
CANONICAL OWNER:     ChatHeader · main-shell invite · realtime-call-local-media
PROOF BEFORE DONE:   L1 — header control · invite callType video · preflight device/camera
SURFACE:             Desktop DM header (mobile overflow optional parity)
```

## Goal

Expose the already-landed M1-A/B callType=`video` path from the DM header so dial is no longer voice-only.

## Behavior

| Step | Action |
|------|--------|
| 1 | User clicks **Video call** (DM only; same enablement gate as Voice call) |
| 2 | Enumerate mic + camera inputs (`listMediaInputDevices`) — log counts |
| 3 | `acquireLocalCallMedia({ wantVideo: true })` — OS/WebView camera + mic prompt |
| 4 | Mic hard-fail → recovery consent (`purpose: video_call`) or abort with toast |
| 5 | Camera fail → continue; `mediaMode: audio_only_fallback`; honesty toast/banner (M1-B) |
| 6 | Send invite with `callType: "video"` + `capabilities.video` from local capability |
| 7 | Host UI status `callType: "video"` so dock panes / banners follow M1-A/B |

Voice call button unchanged (`callType: "voice"`). Shared in-flight lock so both cannot dial at once.

## Mobile header

Desktop keeps labeled pills (Voice call, Video call, Media). The mobile thread header is too narrow for those labels.

| Control | Mobile |
|---------|--------|
| Voice call | Icon-only phone button, 44px, `aria-label` = Voice call |
| Video call | Icon-only camera button, immediately after voice, same size |
| Media, profile, community info | Stay in the existing overflow menu |

Order matches desktop: voice, then video. No second copy of the call actions inside the overflow.

## Call preview

| Surface | Layout |
|---------|--------|
| Mobile product shell, video call | Full-screen stage. Remote pane fills the screen. Local pane is a small corner preview. Name, status, and timer overlay the top. End, return-to-chat, and close sit on a bottom bar with the safe area. Camera-unavailable copy stays visible. |
| Mobile product shell, voice call | Existing compact dock. A voice call does not cover the thread. |
| Desktop | Video uses floating **stage** (R5 · remote fill + local PiP · not full-window). Voice stays compact dock. |

## Non-goals

- M1-L3 dual-profile AV soak / claiming video demoable
- Conference (M2–M3)
- Changing Gift / marketing copy to say video ships

## Proof (L1)

- ChatHeader renders Video call next to Voice call; click invokes handler
- Invite payload helper / dial path sets `callType: "video"`
- Preflight helper: device enumeration + wantVideo acquire (mocked streams)

_Last updated: 2026-10-18T15:55:00Z_
