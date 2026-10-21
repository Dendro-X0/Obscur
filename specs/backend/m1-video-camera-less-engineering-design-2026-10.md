# Design — M1 video engineering without a camera (v2.0.0 attractiveness)

**Date (UTC):** 2026-10-18  
**Status:** Design · **M1-A + M1-B + M1-C Implemented (L1)** · M1-L3 blocked (no camera)  
**Parents:** [realtime-media-post-v2-design-2026-10.md](./realtime-media-post-v2-design-2026-10.md) · [obscur-v2-known-limitations.md](../../docs/program/obscur-v2-known-limitations.md)  
**Maintainer constraint:** No physical camera available to demo video usability.

```text
HANDOFF ATOMIC STEP: M1-C done — wait for hitch / PB1-C / M1-L3 when camera exists
PAUSED / CANCELLED: Claim video shipped · conference as v2.0.0 mandatory · Soft L3 Fixed · M1-L3 · Gift fake-video
CANONICAL OWNER:     messaging voice-call / WebRTC · media-device-consent
PROOF BEFORE DONE:   M1-C L1 — lab flag off by default; production always off
SURFACE:             Desktop DM call dock (lab only)
```

## Product face for public v2.0.0

| Pillar | Evidence |
|--------|----------|
| Attractive / reliable / trustworthy | Existing Gift silent GIFs under `docs/assets/gifs/` (prior client tests) |
| Comms that already work | DM · groups · 1:1 **voice** · relays · profiles · vault (as GIFs show) |
| Honest gap | **Video** and **conferencing** not claimed shipped |

Do **not** withhold v2.0.0 public release solely for camera demos. Do **not** fake video GIFs without a real capture path.

## Gap (engineering)

Voice path is shipped. Attractiveness for some buyers wants **1:1 video (M1)** then **small-group / conference (M2–M3)**. Camera-less maintainer can still land structure before L3 AV soak.

## Camera-less slice ladder (when chartered)

| Slice | Work | Proof without camera |
|-------|------|----------------------|
| **M1-A** | Wire `callType` video/av · capability bits · consent purpose `video_call` · dock layout for local/remote `<video>` panes (placeholder when no device) | **L1 Pass** — reason-honesty · capability · signaling · dock panes · media purpose |
| **M1-B** | WebRTC add video transceiver; if `getUserMedia({ video })` fails → **audio-only** with honest banner (“Camera unavailable — continuing with voice”) | **L1 Pass** — `realtime-call-local-media` · dock banner · recvonly transceiver |
| **M1-C** | Optional fake/canvas track for lab soak (not Gift demo) | **L1 Pass** — off in production; `av_lab_canvas` banner; env or `obscur.dev.lab_canvas_video.v1` in dev only |
| **M1-L3** | Dual-profile AV ≥15s | **Blocked** until a camera (or hitch peer with camera) exists |

**Conference (M2–M3):** separate charter after M1; not required for v2.0.0 Gift face.

## Promotion honesty

| Say | Do not say |
|-----|------------|
| 1:1 encrypted voice available; video on the roadmap | “Video calling shipping in v2.0.0” without M1-L3 |
| Group chat live; multiparty voice/video later | “Conference meetings included” |
| Prior features proven by GIF library + client tests | “Re-record all demos before public” |

## Relation to S2 lock

Business ROADMAP forbids M1–M3 **implementation** while S2 is open unless maintainer **explicitly** unpauses. This doc is the ready charter text; it does not unpause by itself.

_Last updated: 2026-10-18T13:20:00Z_
