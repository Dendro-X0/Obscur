# Procedure — M1-L3 dual-profile AV soak (blocked without camera)

**Date (UTC):** 2026-10-18  
**Status:** Procedure shelf · **do not mark Pass** until a physical camera (or hitch peer with camera) completes the soak  
**Parents:** [m1-video-camera-less-engineering-design-2026-10.md](./m1-video-camera-less-engineering-design-2026-10.md) · [realtime-media-post-v2-design-2026-10.md](./realtime-media-post-v2-design-2026-10.md)

```text
HANDOFF ATOMIC STEP: M1-L3 blocked — no camera on maintainer machine
PAUSED / CANCELLED: Claim video usable · Gift fake-video · lab canvas as L3
CANONICAL OWNER:     messaging voice-call / WebRTC
PROOF BEFORE DONE:   Dual-profile AV ≥15s with live camera track (below)
SURFACE:             Packaged desktop · two profiles · open relays
```

## Gate (must all be true)

1. At least one profile has a **real** camera (`getUserMedia({ video })` succeeds).  
2. Relays open (`openRelayCount > 0`).  
3. Lab canvas flag **off** (`NEXT_PUBLIC_OBSCUR_LAB_CANVAS_VIDEO` unset · no `obscur.dev.lab_canvas_video.v1`).  
4. Negotiated `callType === "video"` (both peers advertise `capabilities.video`).

## Soak steps

1. Profile A and Profile B on the same clearnet path (Tor OFF for this soak).  
2. A dials B with **video** call type (when dial UI exposes it) **or** invite wire `callType: "video"` + `capabilities.video: true`.  
3. B accepts.  
4. Confirm local + remote video panes show live camera (not “Camera unavailable”, not “Lab canvas”).  
5. Hold connected AV **≥ 15 seconds**.  
6. Hang up cleanly; dock shows ended honesty, not silent hang.

## Pass criteria

| Check | Required |
|-------|----------|
| Live local video track | Yes |
| Live remote video track (or honest one-sided if peer has no cam) | Prefer both; one-sided OK if peer lacks camera and banner is honest |
| Duration ≥ 15s connected | Yes |
| Lab canvas unused | Yes |
| Gift GIF of this soak | Optional only after Pass — real capture, not canvas |

## Fail / defer

| Condition | Action |
|-----------|--------|
| No camera on either side | Keep **Blocked**; use M1-B audio-only path |
| Mic OK, camera fail | M1-B banner — **not** M1-L3 Pass |
| Lab canvas enabled | Abort L3; turn flag off |

## Evidence to record when Pass

- UTC timestamp · profiles · relay path  
- Screenshot or silent GIF of dual panes with live camera  
- Note in handoff Landed: `M1-L3 dual-profile AV ≥15s · Pass`  
- Flip known-limitations video row only after maintainer accept

_Last updated: 2026-10-18T13:45:00Z_
