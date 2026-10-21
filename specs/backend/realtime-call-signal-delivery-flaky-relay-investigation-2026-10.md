# Investigation — Unable to communicate E2E (answer send fail)

**Date (UTC):** 2026-10-19  
**Status:** Root cause identified · fix landed L1 (await operator retest)

## Symptoms (screenshot)

- Red toast: **Could not answer the call. Check relays and try again.**
- Call cards: **CALL TIMED OUT** / **CALL FAILED** (`network_interrupted`)
- Footer: **Connected · 2/3 active relays**
- Peer shown **OFFLINE** with last-active “Just now”

## Trace

| UI | Code |
|----|------|
| Answer toast | `messaging.voiceCallAnswerSendFailed` → `failVoiceAnswerDispatch` |
| Trigger | `sendVoiceSignal` returned `false` after answer SDP publish |
| Prior gate | Only `sent_quorum` / `sent_partial` counted as success |

Under degraded pools, Phase-1 often leaves `pending_ack` or `failed` + `partialWireDelivery` — already accepted for **invites**, not for **signals**. Answer fail → interrupt → no E2E media.

## Fix (smallest)

`isVoiceCallSignalDeliveryAccepted` + one retry in `sendVoiceSignal` (see design).

_Last updated: 2026-10-19T14:20:00Z_
