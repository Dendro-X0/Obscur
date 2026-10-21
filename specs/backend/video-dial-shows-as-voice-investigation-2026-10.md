# Investigation — Video call button looks like a voice call

**Date (UTC):** 2026-10-19  
**Status:** Fixed L1 · await operator retest

```text
HANDOFF ATOMIC STEP: Video dial shows as voice invite / voice dock
PAUSED / CANCELLED: Claim video usable without M1-L3 · M2 conference
CANONICAL OWNER:     voice-call-invite-card · ensureVoicePeerConnection status patch
PROOF BEFORE DONE:   L1 card copy · preserve callType on connecting/connected
```

## Evidence

1. **Invite card** always uses `messaging.voiceCallInvite` — ignores `invite.callType === "video"`.
2. **`ensureVoicePeerConnection`** sets `phase: "connecting"` **without** carrying forward `callType` / `mediaMode` from the dial status → overlay drops to voice dock after accept.
3. Dial path does send `callType: "video"` on wire; toast keys for video exist — wire is not the primary lie.

## Fix slice

- Card honesty from invite.callType (+ capabilities.video)
- Preserve callType/mediaMode whenever UI status is updated for the same room

_Last updated: 2026-10-19T15:50:00Z_
