# Design — Symmetric video UI for A/B on video invite

**Date (UTC):** 2026-10-19  
**Status:** Implemented · L1 (accept/join path too)  
**Depends:** `video-call-ui-asymmetric-ab-investigation-2026-10.md`

```text
HANDOFF ATOMIC STEP: Symmetric video presentation for invite callType=video
PAUSED / CANCELLED: Claim video usable without M1-L3 · M2 conference
CANONICAL OWNER:     resolveCallTypeFromInvite · handleAccept/Join
PROOF BEFORE DONE:   L1 honesty tests · both profiles show stage when invite is video
```

## Contract

| Layer | Rule |
|-------|------|
| UI `callType` | Follows invite wire (`video`/`av` or `capabilities.video`) on **both** host and joiner |
| Media | Camera fail → `audio_only_fallback` + honesty banner; still `callType: video` |
| Accept toast | Must not clear `callType` when moving to connecting |
| Join card | Explicitly sets `callType` from invite before RTC setup |
| Dual profile / one device | Camera may be exclusive (unavailable on one or both) — **not** a reason to show voice dock |
| Strict both-peer gate | Kept on `resolveSupportedCallType` for CRDT/preflight only |

_Last updated: 2026-10-20T06:20:00Z_
