# Design — PB1-C voice dial relay preflight

**Date (UTC):** 2026-10-18  
**Status:** Implemented · L1 Pass  
**Parents:** [pre-b2b-capability-design-2026-10.md](./pre-b2b-capability-design-2026-10.md) §5 · hitch demo honesty (Offline 0/0)

```text
HANDOFF ATOMIC STEP: PB1-C — refuse voice invite dial when open relay count is 0
PAUSED / CANCELLED:  M1 video · M2 group voice · M3 conference · Soft L3 Fixed · dialects
CANONICAL OWNER:     voice-call-invite-delivery · main-shell handleSendVoiceCallInvite
PROOF BEFORE DONE:   L1 unit + invite path toast when openCount === 0
SURFACE:             DM Voice call button
```

## Goal

When the shell shows **Offline 0/0 active relays**, tapping **Voice call** must not spin a ringing dock or a vague send failure. Stop before `sendDm` with an honest “no open relays” toast that points the operator to Relays.

## Contract

| `openRelayCount` | Behavior |
|------------------|----------|
| `> 0` | Existing invite send path unchanged |
| `≤ 0` | Toast error · no invite EVENT · no outgoing ring UI · log `invite_send_result` status `blocked_no_open_relay` |

Pure helper: `canStartVoiceCallInviteDial({ openRelayCount })` → boolean.

## Non-goals

- Camera / group meetings  
- Changing relay reconnect policy  
- Disabling the Voice call button permanently (toast on tap is enough for this slice)

## Proof

- L1: helper unit tests  
- Manual: Tor OFF · 0 open relays · Voice call → toast · no dock  

_Last updated: 2026-10-18T11:20:00Z_
