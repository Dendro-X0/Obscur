# Investigation — A shows video stage, B shows voice dock on same call

**Date (UTC):** 2026-10-19  
**Status:** Root cause identified · fix next  
**Evidence:** Tester1 video stage (“Camera unavailable”); Tester2 VIDEO CALL INVITE + phone IN CALL bar

```text
HANDOFF ATOMIC STEP: A/B video UI asymmetry on same invite
PAUSED / CANCELLED: Claim video usable · M2 conference
CANONICAL OWNER:     resolveCallTypeFromInvite · voice-call-reason-honesty
PROOF BEFORE DONE:   L1 invite UI type follows wire · both sides stage for video invite
```

## Cause

1. **Host (A)** sets `callType: "video"` from dial request (no remote capability gate).
2. **Joiner (B)** uses `resolveCallTypeFromInvite` → `resolveSupportedCallType`, which requires **both** `localSupportsVideo` and `inviteAdvertisesVideo`. If B’s capability bit is false, UI becomes **voice** while A stays **video**.
3. Result: same room, asymmetric chrome (stage vs phone dock). Camera absence should be `audio_only_fallback` + honesty banner, not silent demotion of call type.

## Fix

`resolveCallTypeFromInvite`: UI call type follows **wire invite intent** (`callType` video/av or `capabilities.video`). Local capability gates media acquisition only, not pane presentation.

_Note:_ B may still be on older shell (1.9.16 vs 1.9.36) — rebuild both after fix.

_Last updated: 2026-10-20T05:25:00Z_
